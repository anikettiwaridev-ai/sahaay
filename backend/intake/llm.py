# -*- coding: utf-8 -*-
"""Ollama client for extraction. ARCHITECTURE §4 step 2, BUILD_BRIEFS Phase 2.

The model is handed a fixed prompt and a JSON schema and gets 6 seconds. What
comes back is validated by Pydantic before anything else looks at it. If the
model is slow, absent, or returns something that is not the schema, this module
returns ``None`` and ``extract.py`` proceeds on the deterministic fallback --
which is the whole reason the fallback runs in parallel rather than on demand.

The output shape is deliberately **flat and dumb**: a place name, a course name,
free-text enums. Resolving a place to a state id or a course to a category id is
done deterministically against the gazetteer and the course list, so a
hallucinated state code cannot reach the router.
"""
from __future__ import annotations

import hashlib
import json
import logging
import shutil
import sys
import time
from pathlib import Path
from typing import Literal, Optional

import requests
from pydantic import BaseModel, Field, ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intake import config     # noqa: E402

log = logging.getLogger("sahidwar.intake")

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / f"{config.PROMPT_VERSION}.md"


class LlmExtraction(BaseModel):
    """What the model is allowed to say. Every field optional, every field a
    fact about the utterance -- no verdicts, no scheme ids, no thresholds."""

    name: Optional[str] = Field(default=None, description="Applicant name as spoken")
    is_sc: Optional[bool] = Field(
        default=None, description="true only if the person says they are Scheduled Caste")
    place: Optional[str] = Field(
        default=None, description="City, town or district as spoken, in English letters")
    purpose: Optional[Literal["enterprise", "education"]] = Field(
        default=None, description="enterprise if the money is for a business, education if for study")
    sector: Optional[Literal[
        "tailoring", "shop", "transport", "agri_allied", "services",
        "manufacturing", "plantation", "construction", "other"]] = Field(
        default=None, description="Trade of the business")
    activity_text: Optional[str] = Field(
        default=None, description="What they want to do, in their own words and script")
    amount_inr: Optional[int] = Field(
        default=None, ge=0, le=1_000_000_000,
        description="Rupees the person is asking for: project cost, or course fee")
    own_contribution_inr: Optional[int] = Field(
        default=None, ge=0, le=1_000_000_000,
        description="Rupees the person already has to put in")
    annual_family_income_inr: Optional[int] = Field(
        default=None, ge=0, le=1_000_000_000,
        description="What the household earns in a year, in rupees")
    education: Optional[Literal[
        "illiterate", "primary", "middle", "matric", "higher_secondary",
        "graduate"]] = Field(
        default=None, description="The speaker's own completed schooling")
    course_name: Optional[str] = Field(
        default=None, description="Subject of study in plain words")
    course_level: Optional[Literal[
        "diploma", "bachelors", "masters", "doctoral"]] = None
    course_duration_months: Optional[int] = Field(
        default=None, ge=1, le=120, description="Course length in months")
    course_is_full_time_recognised: Optional[bool] = None
    repayment_started: Optional[bool] = None
    is_woman: Optional[bool] = Field(
        default=None, description="From the speaker's stated gender or Hindi verb gender only")
    age: Optional[int] = Field(default=None, ge=10, le=100)
    has_existing_enterprise: Optional[bool] = None
    enterprise_age_months: Optional[int] = Field(
        default=None, ge=0, le=600, description="How long the existing business has run")
    has_udyam: Optional[bool] = None
    has_caste_certificate: Optional[bool] = None
    has_income_certificate: Optional[bool] = None


def prompt_text() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def _sections() -> tuple[str, str]:
    """The SYSTEM and USER halves of the prompt file.

    The prompt lives in Markdown so it is reviewable next to the spec; the
    headings are the contract between that file and this loader.
    """
    body = prompt_text()
    system = body.split("## SYSTEM", 1)[1].split("## USER", 1)[0].strip()
    user = body.split("## USER", 1)[1].strip()
    return system, user


# ------------------------------------------------------------------- cache
def cache_key(text: str) -> str:
    """Transcript hash, ARCHITECTURE §4. The model and prompt version are in the
    key: re-pinning either must not serve a stale answer."""
    raw = f"{config.LLM_MODEL}\x1f{config.PROMPT_VERSION}\x1f{text.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def clear_cache() -> int:
    """ARCHITECTURE §8 (privacy): the extraction cache is cleared on every
    server start. Returns how many entries went."""
    if not config.CACHE_DIR.exists():
        return 0
    n = len(list(config.CACHE_DIR.glob("*.json")))
    shutil.rmtree(config.CACHE_DIR, ignore_errors=True)
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    log.info("intake.cache cleared (%d entries)", n)
    return n


def _cache_read(key: str) -> Optional[dict]:
    path = config.CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _cache_write(key: str, payload: dict) -> None:
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        (config.CACHE_DIR / f"{key}.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except OSError as e:                      # a full disk must not fail intake
        log.warning("intake.cache write failed: %s", e)


# --------------------------------------------------------------------- call
def health() -> dict:
    """Is Ollama up and is the pinned model pulled? Used by /meta/health."""
    try:
        r = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=2.0)
        r.raise_for_status()
        names = [m.get("name", "") for m in r.json().get("models", [])]
        return {"ok": config.LLM_MODEL in names, "models": names,
                "model": config.LLM_MODEL}
    except requests.RequestException as e:
        return {"ok": False, "models": [], "model": config.LLM_MODEL,
                "error": type(e).__name__}


def warm(model: Optional[str] = None) -> dict:
    """Load the model into VRAM before the first applicant speaks.

    A cold Ollama spends ~4 s mapping weights, which lands the *first*
    extraction outside ARCHITECTURE §8's 6 s budget and makes the demo's first
    question the slowest one. The server calls this at startup; it is the only
    place intake is allowed to exceed the timeout, and it blocks nothing.
    """
    model = model or config.LLM_MODEL
    t0 = time.perf_counter()
    try:
        r = requests.post(
            f"{config.OLLAMA_URL}/api/chat",
            json={"model": model, "messages": [], "stream": False,
                  "keep_alive": config.LLM_KEEP_ALIVE},
            timeout=config.LLM_WARM_TIMEOUT_S)
        r.raise_for_status()
        ms = (time.perf_counter() - t0) * 1000
        log.info("intake.llm warmed %s in %.0f ms", model, ms)
        return {"ok": True, "ms": ms, "model": model}
    except requests.RequestException as e:
        ms = (time.perf_counter() - t0) * 1000
        log.warning("intake.llm warm-up failed (%s) -- the fallback still works",
                    type(e).__name__)
        return {"ok": False, "ms": ms, "model": model, "error": type(e).__name__}


def extract(text: str, lang: str = "hi", model: Optional[str] = None,
            use_cache: bool = True) -> tuple[Optional[dict], dict]:
    """Text -> the model's flat extraction, or ``None``.

    Returns ``(values, meta)``. ``meta`` always carries ``status`` -- one of
    ``ok``, ``cached``, ``timeout``, ``unreachable``, ``invalid_json``,
    ``schema_error``, ``empty_input`` -- plus the elapsed milliseconds. Nothing
    raises: intake must degrade, not fail.
    """
    model = model or config.LLM_MODEL
    t0 = time.perf_counter()
    if not text or not text.strip():
        return None, {"status": "empty_input", "ms": 0.0, "model": model}

    key = cache_key(text) if model == config.LLM_MODEL else None
    if use_cache and key:
        hit = _cache_read(key)
        if hit is not None:
            ms = (time.perf_counter() - t0) * 1000
            log.info("intake.cache HIT %s (%.1f ms, no LLM call)", key, ms)
            return hit, {"status": "cached", "ms": ms, "model": model,
                         "cache_key": key}

    system, user = _sections()
    payload = {
        "model": model,
        "stream": False,
        "format": LlmExtraction.model_json_schema(),
        "options": {"temperature": 0.0, "seed": 0, "num_ctx": config.LLM_NUM_CTX},
        "keep_alive": config.LLM_KEEP_ALIVE,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user.format(lang=lang, text=text.strip())},
        ],
    }

    try:
        r = requests.post(f"{config.OLLAMA_URL}/api/chat", json=payload,
                          timeout=config.LLM_TIMEOUT_S)
        r.raise_for_status()
        content = r.json()["message"]["content"]
    except requests.Timeout:
        ms = (time.perf_counter() - t0) * 1000
        log.warning("intake.llm timeout after %.0f ms -- falling back", ms)
        return None, {"status": "timeout", "ms": ms, "model": model}
    except (requests.RequestException, KeyError, ValueError) as e:
        ms = (time.perf_counter() - t0) * 1000
        log.warning("intake.llm unreachable (%s) -- falling back", type(e).__name__)
        return None, {"status": "unreachable", "ms": ms, "model": model,
                      "error": type(e).__name__}

    ms = (time.perf_counter() - t0) * 1000
    try:
        raw = json.loads(content)
    except json.JSONDecodeError:
        log.warning("intake.llm returned non-JSON -- falling back")
        return None, {"status": "invalid_json", "ms": ms, "model": model}
    try:
        values = LlmExtraction.model_validate(raw).model_dump()
    except ValidationError as e:
        log.warning("intake.llm failed the schema (%d errors) -- falling back",
                    e.error_count())
        return None, {"status": "schema_error", "ms": ms, "model": model}

    if use_cache and key:
        _cache_write(key, values)
    log.info("intake.llm MISS %s ok in %.0f ms", key, ms)
    return values, {"status": "ok", "ms": ms, "model": model, "cache_key": key}
