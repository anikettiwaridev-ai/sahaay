# -*- coding: utf-8 -*-
"""Sahaay's local Python AI service.

This process intentionally owns only the components which need the local
Python Whisper/Ollama stack. Express owns all browser-facing pages, profiles,
catalogue, deterministic scheme matching, costs and routing.

Run from the repository root:
  .venv\\Scripts\\python.exe -m uvicorn python-ai.app:app --host 127.0.0.1 --port 8001
"""
from __future__ import annotations

import logging
import os
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from intake import config as intake_config  # noqa: E402
from intake import extract as intake_extract  # noqa: E402
from intake import llm as intake_llm, whisper as intake_whisper  # noqa: E402
from models import ExtractRequest, StructuredProfile, TranscribeResponse  # noqa: E402
from portal import assistant  # noqa: E402

log = logging.getLogger("sahaay.ai")


class AskRequest(BaseModel):
    question: str
    lang: Optional[str] = None
    profile: Optional[dict[str, Any]] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Keep the existing privacy behaviour: extraction cache is cleared at start.

    Models continue to lazy-load/warm through the retained implementation, so
    a missing local model degrades to its proven deterministic fallback rather
    than preventing the conventional Express portal from starting.
    """
    intake_llm.clear_cache()
    yield


app = FastAPI(title="Sahaay local AI service", version="1.0", lifespan=lifespan)


@app.post("/intake/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...), lang: str | None = None) -> dict:
    suffix = Path(audio.filename or "clip.wav").suffix or ".wav"
    handle, name = tempfile.mkstemp(suffix=suffix, prefix="sahaay_")
    temp = Path(name)
    try:
        with os.fdopen(handle, "wb") as file_handle:
            file_handle.write(await audio.read())
        forced_lang = lang if lang in ("hi", "en") else None
        return intake_whisper.transcribe(temp, lang=forced_lang)
    except Exception as exc:  # noqa: BLE001
        log.exception("transcription failed")
        raise HTTPException(status_code=500, detail=f"transcription failed: {exc}") from exc
    finally:
        temp.unlink(missing_ok=True)


@app.post("/intake/extract", response_model=StructuredProfile)
def extract(request: ExtractRequest) -> dict:
    profile, _meta = intake_extract.extract(request.text, request.lang)
    return profile


@app.post("/assistant/ask")
def ask(request: AskRequest) -> dict:
    return assistant.ask(request.question, request.lang, request.profile)


@app.get("/meta/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "python-ai",
        "ollama": intake_llm.health(),
        "whisper": intake_whisper.health(),
        "prompt": intake_config.PROMPT_VERSION
    }
