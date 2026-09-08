# -*- coding: utf-8 -*-
"""Speech to text, with the guard that stops a hallucination becoming a profile.

ARCHITECTURE §4 steps 1 and 3, §8 (transcribe <= 4 s for 20 s of audio).

Whisper is a language model with a microphone attached: given silence it will
happily produce a fluent, confident, entirely invented sentence -- and that
sentence, fed to extraction, becomes a fluent, confident, entirely invented
applicant. So three gates run before the LLM is allowed to exist:

* VAD found no speech at all;
* the transcript is under three words;
* the model's own average log-probability is below the floor.

Any of them and ``speech_ok`` is False, the caller never calls the LLM, and S2
asks the person to say it again or type it.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional, Union

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intake import config          # noqa: E402

log = logging.getLogger("sahidwar.intake")

_MODEL = None
_MODEL_KEY: tuple[str, str, str] | None = None


def _add_cuda_dll_dirs() -> list[str]:
    """Put the cuBLAS/cuDNN DLLs from the nvidia-*-cu12 wheels on the search path.

    ctranslate2 dlopens ``cublas64_12.dll`` by name; the wheels install it
    inside site-packages rather than on PATH, so CUDA silently fails without
    this. Same fix as ``scripts/setup_models.py`` -- duplicated deliberately,
    because the backend must not import from ``scripts/``.
    """
    found: list[str] = []
    if sys.platform != "win32":
        return found
    for base in map(Path, sys.path):
        nvidia = base / "nvidia"
        if not nvidia.is_dir():
            continue
        for binpath in sorted(nvidia.glob("*/bin")):
            if any(binpath.glob("*.dll")):
                os.add_dll_directory(str(binpath))
                os.environ["PATH"] = str(binpath) + os.pathsep + os.environ["PATH"]
                found.append(str(binpath))
    return found


_CUDA_DIRS = _add_cuda_dll_dirs()


def load(model_name: Optional[str] = None, device: Optional[str] = None,
         compute_type: Optional[str] = None):
    """The ASR model, loaded once and kept. Falls back to CPU rather than
    failing: a slow demo beats a dead one."""
    global _MODEL, _MODEL_KEY
    from faster_whisper import WhisperModel

    name = model_name or config.ASR_MODEL
    dev = device or config.ASR_DEVICE
    ct = compute_type or config.ASR_COMPUTE_TYPE
    key = (name, dev, ct)
    if _MODEL is not None and _MODEL_KEY == key:
        return _MODEL

    t0 = time.perf_counter()
    try:
        model = WhisperModel(name, device=dev, compute_type=ct,
                             download_root=str(config.MODELS_DIR))
    except Exception as e:                      # noqa: BLE001 - any CUDA failure
        log.warning("intake.asr cuda load failed (%s) -- using cpu", e)
        model = WhisperModel(name, device="cpu",
                             compute_type=config.ASR_CPU_COMPUTE_TYPE,
                             download_root=str(config.MODELS_DIR))
        key = (name, "cpu", config.ASR_CPU_COMPUTE_TYPE)
    log.info("intake.asr loaded %s (%s/%s) in %.1f s", key[0], key[1], key[2],
             time.perf_counter() - t0)
    _MODEL, _MODEL_KEY = model, key
    return model


def loaded() -> Optional[tuple[str, str, str]]:
    return _MODEL_KEY


def transcribe(audio: Union[str, Path], lang: Optional[str] = None,
               model_name: Optional[str] = None) -> dict:
    """Audio file -> transcript, language, and whether it may go any further.

    ``lang`` forces a language; ``None`` lets Whisper detect, which is what the
    UI does -- ARCHITECTURE §3 wants hi/en auto-detect rather than a language
    switch the applicant has to find first.
    """
    model = load(model_name)
    t0 = time.perf_counter()
    segments, info = model.transcribe(
        str(audio),
        language=lang,
        beam_size=config.ASR_BEAM_SIZE,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,
    )
    segs = list(segments)
    text = " ".join(s.text.strip() for s in segs).strip()
    elapsed_ms = (time.perf_counter() - t0) * 1000

    # Duration-weighted, because one short confident segment must not rescue
    # twenty seconds of noise.
    total_s = sum(max(s.end - s.start, 1e-6) for s in segs)
    avg_logprob = (sum(s.avg_logprob * (s.end - s.start) for s in segs) / total_s
                   if segs and total_s > 0 else None)
    no_speech = (max((s.no_speech_prob for s in segs), default=1.0) if segs else 1.0)

    guard = None
    if not segs or not text:
        guard = "no_speech"
    elif len(text.split()) < config.GUARD_MIN_WORDS:
        guard = "too_short"
    elif avg_logprob is not None and avg_logprob < config.GUARD_MIN_AVG_LOGPROB:
        guard = "low_confidence"
    elif no_speech > config.GUARD_MAX_NO_SPEECH_PROB:
        guard = "no_speech"

    detected = (info.language or lang or "hi").lower()
    if detected not in ("hi", "en"):
        # The corpus is two languages; anything else is a detection error, and
        # Devanagari output is far likelier to be Hindi than the alternative.
        detected = "hi" if any("ऀ" <= c <= "ॿ" for c in text) else "en"

    if guard:
        log.info("intake.asr guard=%s (%d words, avg_logprob=%s) -- no LLM call",
                 guard, len(text.split()),
                 f"{avg_logprob:.2f}" if avg_logprob is not None else "n/a")

    return {
        "transcript": text,
        "lang": detected,
        "duration_ms": int(round(info.duration * 1000)),
        "speech_ok": guard is None,
        "guard_reason": guard,
        "avg_logprob": round(avg_logprob, 3) if avg_logprob is not None else None,
        "elapsed_ms": round(elapsed_ms, 1),
        "model": (_MODEL_KEY or ("", "", ""))[0],
    }


def health() -> dict:
    """Is the pinned ASR model on disk? Loading it is a four-second job, so
    /meta/health checks for the weights rather than loading them."""
    name = config.ASR_MODEL
    hits = list(config.MODELS_DIR.glob(f"models--*{name.replace('/', '--')}*"))
    return {"ok": bool(hits) or _MODEL is not None,
            "model": name,
            "device": (_MODEL_KEY[1] if _MODEL_KEY else config.ASR_DEVICE),
            "loaded": _MODEL is not None,
            "cuda_dll_dirs": len(_CUDA_DIRS)}
