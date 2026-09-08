# -*- coding: utf-8 -*-
"""Merge. ENGINE_SPEC §9, ARCHITECTURE §4.

Both extractors run on the same text, always and in parallel (§9.1). This
module decides, field by field, which answer survives -- and, more importantly,
which answers a human has to look at before the engine is allowed to run.

The policy in one paragraph: one source only, take it. Both and they agree,
take the more trustworthy of the two and raise the confidence. Both and they
disagree, **keep the deterministic value** and put the field on the confirm
screen (§9.4) -- because the parser is auditable and the disagreement is itself
the signal that a person should look.

No eligibility, no ranking, no scheme. Just fields, confidences, and questions.
"""
from __future__ import annotations

import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intake import config, fallback, llm     # noqa: E402
from intake.fallback import Value            # noqa: E402

log = logging.getLogger("sahidwar.intake")

COURSE_FIELDS = ("category", "level", "is_full_time_recognised",
                 "duration_months", "repayment_started")
MONEY_FIELDS = ("amount_inr", "own_contribution_inr", "annual_family_income_inr")

# Fields that are quantities, so §9.3's "within 2%" applies instead of equality.
NUMERIC_FIELDS = set(MONEY_FIELDS) | {"age", "enterprise_age_months",
                                      "course.duration_months"}


def _llm_fields(values: dict) -> dict[str, Value]:
    """The model's flat output, mapped into profile fields.

    Two of them are *resolved* rather than copied: a place name goes through the
    gazetteer and a course name through the ELS course list. The model names
    things; the data layer decides what they are. That is the difference between
    a hallucinated district and a hallucinated state id reaching the router.
    """
    out: dict[str, Value] = {}
    if not values:
        return out

    def put(field: str, value) -> None:
        if value is not None:
            out[field] = Value(value, config.C_LLM, False, "llm")

    for field in ("name", "is_sc", "purpose", "sector", "education",
                  "amount_inr", "own_contribution_inr",
                  "annual_family_income_inr", "is_woman", "age",
                  "has_existing_enterprise", "enterprise_age_months",
                  "has_udyam", "has_caste_certificate",
                  "has_income_certificate"):
        put(field, values.get(field))

    place = fallback.resolve_place(values.get("place") or "")
    if place:
        put("state", place["state"])
        if place["district"]:
            put("district", place["district"])
        put("location", place["location"])

    if values.get("course_name"):
        resolved = fallback.resolve_course(values["course_name"])
        if "category" in resolved:
            put("course.category", resolved["category"].value)
    put("course.level", values.get("course_level"))
    put("course.duration_months", values.get("course_duration_months"))
    put("course.is_full_time_recognised", values.get("course_is_full_time_recognised"))
    put("course.repayment_started", values.get("repayment_started"))
    return out


def _agree(field: str, a, b) -> bool:
    """§9.3/§9.4. Amounts agree within 2%; everything else is equality."""
    if a == b:
        return True
    if field in NUMERIC_FIELDS and isinstance(a, (int, float)) and isinstance(b, (int, float)):
        biggest = max(abs(a), abs(b))
        return biggest > 0 and abs(a - b) / biggest <= config.AMOUNT_AGREE_TOLERANCE
    if field == "location":                   # resolved from the same gazetteer
        return isinstance(a, dict) and isinstance(b, dict) and a == b
    return False


def merge(fb: dict[str, Value], lm: dict[str, Value]) -> dict[str, dict]:
    """ENGINE_SPEC §9, the whole of it. Returns field -> {value, confidence,
    source, note}."""
    out: dict[str, dict] = {}
    for field in sorted(set(fb) | set(lm)):
        f, m = fb.get(field), lm.get(field)

        # §1: activity_text is the applicant's own words, so it is the
        # transcript itself -- never a model's paraphrase, never a disagreement.
        if field == "activity_text":
            src = f or m
            out[field] = {"value": src.value, "confidence": config.C_EXACT,
                          "source": "fallback" if f else "llm", "note": "verbatim"}
            continue

        if f is None or m is None:                                    # §9.2
            src = f or m
            out[field] = {"value": src.value, "confidence": src.confidence,
                          "source": "fallback" if f else "llm",
                          "note": "only_source"}
            continue

        if _agree(field, f.value, m.value):                           # §9.3
            # Confidence is max(both); the *value* comes from whichever source
            # earned that confidence, so an exactly parsed 120000 is not
            # replaced by a model's 122000 just because they are close enough.
            winner, source = (f, "fallback") if f.confidence >= m.confidence else (m, "llm")
            out[field] = {"value": winner.value,
                          "confidence": max(f.confidence, m.confidence),
                          "source": source, "note": "agreed"}
            continue

        out[field] = {"value": f.value, "confidence": config.C_DISAGREE,   # §9.4
                      "source": "fallback", "note": "disagreed",
                      "llm_said": m.value}
    return out


def _profile_skeleton(lang: str) -> dict:
    return {
        "lang": lang, "name": None, "is_sc": None, "state": None,
        "district": None, "location": None, "purpose": None, "sector": None,
        "activity_text": None, "amount_inr": None, "own_contribution_inr": None,
        "annual_family_income_inr": None, "education": None,
        "course": {"category": None, "level": None,
                   "is_full_time_recognised": None, "duration_months": None,
                   "repayment_started": False},
        "is_woman": None, "age": None, "has_existing_enterprise": None,
        "enterprise_age_months": None, "has_udyam": None,
        "has_caste_certificate": None, "has_income_certificate": None,
        "field_meta": {}, "needs_confirmation": [],
    }


def build_profile(merged: dict[str, dict], lang: str) -> dict:
    """Merged fields -> a ``StructuredProfile`` (ENGINE_SPEC §1), with
    ``needs_confirmation`` computed as the only gate."""
    profile = _profile_skeleton(lang)
    for field, rec in merged.items():
        if field.startswith("course."):
            profile["course"][field.split(".", 1)[1]] = rec["value"]
        elif field in profile:
            profile[field] = rec["value"]
        profile["field_meta"][field] = {"confidence": round(rec["confidence"], 2),
                                        "source": rec["source"]}

    confirm: list[str] = []

    # §1: is_sc is confirmed always -- all eligibility rests on it, so it has to
    # be an explicit statement by the applicant rather than something we read.
    for field in config.ALWAYS_CONFIRM:
        confirm.append(field)

    # §1: below the confidence gate, or the two extractors disagreed.
    for field, rec in sorted(merged.items()):
        if field in confirm:
            continue
        if rec["confidence"] < config.CONFIRM_BELOW:
            confirm.append(field)

    # §1: absent, and a rule needs it.
    for field in config.CONFIRM_IF_ABSENT:
        if field in confirm:
            continue
        if merged.get(field, {}).get("value") is None:
            confirm.append(field)

    profile["needs_confirmation"] = confirm
    return profile


def extract(text: str, lang: str = "hi", use_cache: bool = True,
            model: Optional[str] = None) -> tuple[dict, dict]:
    """The intake endpoint's whole job. Returns ``(profile, meta)``.

    The two extractors run in parallel because §9.1 says "always": the fallback
    is not a retry after the LLM fails, it is the auditor that runs beside it.
    Serialising them would add the fallback's cost to every request and would
    still leave the LLM's 6 s on the clock.
    """
    t0 = time.perf_counter()

    # ARCHITECTURE §4 step 3, applied to text as well as audio: under three
    # words there is nothing to extract, and asking a generative model to fill
    # a 22-field schema from two words is asking it to invent an applicant.
    if len((text or "").split()) < config.GUARD_MIN_WORDS:
        fb = fallback.parse(text or "", lang)
        profile = build_profile(merge(fb, {}), lang)
        ms = (time.perf_counter() - t0) * 1000
        log.info("intake.extract guard=too_short (%d words) -- no LLM call",
                 len((text or "").split()))
        return profile, {"ms": round(ms, 1), "llm_used": False,
                         "llm": {"status": "skipped_guard", "ms": 0.0,
                                 "model": model or config.LLM_MODEL},
                         "fallback_fields": len(fb), "disagreements": []}

    with ThreadPoolExecutor(max_workers=2) as pool:
        fb_future = pool.submit(fallback.parse, text, lang)
        lm_future = pool.submit(llm.extract, text, lang, model, use_cache)
        fb = fb_future.result()
        lm_values, lm_meta = lm_future.result()

    merged = merge(fb, _llm_fields(lm_values or {}))
    profile = build_profile(merged, lang)
    ms = (time.perf_counter() - t0) * 1000

    meta = {
        "ms": round(ms, 1),
        "llm": lm_meta,
        "llm_used": lm_values is not None,
        "fallback_fields": len(fb),
        "disagreements": sorted(f for f, r in merged.items()
                                if r["note"] == "disagreed"),
    }
    log.info("intake.extract %.0f ms  llm=%s  fields=%d  confirm=%d  disagree=%s",
             ms, lm_meta["status"], len(merged),
             len(profile["needs_confirmation"]), meta["disagreements"] or "none")
    return profile, meta
