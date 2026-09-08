# -*- coding: utf-8 -*-
"""Intake configuration -- the knobs the bake-off pinned.

Spec: BUILD_BRIEFS Phase 2 ("pick the winners on measurement, and pin them in
config"), ARCHITECTURE §4 and §8.

Model choices here are **measured**, not assumed: ``backend/tests/BAKEOFF.md``
holds the WER and field-accuracy numbers behind each one. Every value can be
overridden by environment variable so the demo laptop can be re-pinned without
a code change.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def _env_f(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default


# ------------------------------------------------------------------ ASR
# Winner of the Phase 2 bake-off (BAKEOFF.md §1). ARCHITECTURE §3's ladder is
# large-v3-turbo -> medium -> small; the measurement kept the top rung.
ASR_MODEL = _env("SAHIDWAR_ASR_MODEL", "large-v3-turbo")
ASR_DEVICE = _env("SAHIDWAR_ASR_DEVICE", "cuda")
ASR_COMPUTE_TYPE = _env("SAHIDWAR_ASR_COMPUTE_TYPE", "int8_float16")
ASR_CPU_COMPUTE_TYPE = "int8"
ASR_BEAM_SIZE = int(_env("SAHIDWAR_ASR_BEAM", "5"))
MODELS_DIR = ROOT / "models"

# ARCHITECTURE §4 step 3 -- the silence and noise guard. Whisper hallucinates
# fluent text from silence, so these three gates run *before* the LLM exists.
GUARD_MIN_WORDS = 3
GUARD_MIN_AVG_LOGPROB = _env_f("SAHIDWAR_GUARD_LOGPROB", -1.0)
GUARD_MAX_NO_SPEECH_PROB = _env_f("SAHIDWAR_GUARD_NO_SPEECH", 0.6)

# ------------------------------------------------------------------ LLM
LLM_MODEL = _env("SAHIDWAR_LLM_MODEL", "qwen2.5:3b-instruct")
OLLAMA_URL = _env("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
LLM_TIMEOUT_S = _env_f("SAHIDWAR_LLM_TIMEOUT_S", 6.0)   # ARCHITECTURE §4 step 4
LLM_NUM_CTX = 4096
# Keep the weights resident between questions; a cold load is ~4 s and would
# spend the whole extraction budget before the model reads a word.
LLM_KEEP_ALIVE = _env("SAHIDWAR_LLM_KEEP_ALIVE", "30m")
LLM_WARM_TIMEOUT_S = _env_f("SAHIDWAR_LLM_WARM_TIMEOUT_S", 120.0)
PROMPT_VERSION = "extract_v1"

# --------------------------------------------------------------- cache
# ARCHITECTURE §8: local, gitignored, and cleared on every server start.
CACHE_DIR = ROOT / "data" / "cache"

# -------------------------------------------------- confidence constants
# ENGINE_SPEC §9. The floats are the policy, in one place, named.
#
# C_LLM is a CHOICE and is documented in PHASE2-REPORT §3: a 3B model's
# self-reported probability is not evidence, so every LLM-sourced value carries
# one fixed confidence and the *agreement* with the deterministic parser is what
# moves it. This keeps needs_confirmation reproducible run to run.
C_LLM = 0.8
C_EXACT = 0.9          # §9.5 -- deterministic exact match
C_HEURISTIC = 0.6      # §9.6 -- keyword-matched sector, inferred education
C_DISAGREE = 0.6       # §9.4 -- fallback value kept, field flagged
C_USER = 1.0           # §1 -- anything the confirm screen edited
CONFIRM_BELOW = 0.7    # §1 -- the only numeric gate
AMOUNT_AGREE_TOLERANCE = 0.02   # §9.3/§9.4 -- amounts agree within 2%

# Fields a rule reads, so an absent one is a question rather than a default
# (§1: "when it is absent and a rule needs it"). ``is_sc`` is here for a
# stronger reason -- §1 requires it to be an explicit statement by the
# applicant, always, so it is confirmed even when it was extracted.
ALWAYS_CONFIRM = ["is_sc"]
CONFIRM_IF_ABSENT = [
    "purpose", "amount_inr", "annual_family_income_inr", "state",
    "has_caste_certificate", "has_income_certificate",
]
