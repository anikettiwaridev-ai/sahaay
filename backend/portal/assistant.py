# -*- coding: utf-8 -*-
"""The grounded assistant. docs/00-CONTRACTS.md §2, docs/03-BUILD-BRIEFS.md Track A.

docs/01-ARCHITECTURE.md §3 makes one claim about this endpoint and the whole
demo rests on it: *"Cannot invent an interest rate, because it is only allowed
to quote ours."* Asking a 3B model nicely is not that claim. So the guarantee
is built out of three things, in this order, and only the middle one involves a
model at all:

1. **Retrieval is a gate, not a hint.** If the question does not reach any
   catalogue entry, the model is never called and the refusal is returned. That
   is why "What is the capital of France?" is refused with Ollama running,
   stopped, or uninstalled -- the refusal is not a behaviour we hope for.
2. **The prompt carries those entries and nothing else.** No scheme the
   retriever did not pick can be quoted, because it is not in the context.
3. **Every figure in the answer is checked back against the context.** A rate
   or an amount that is not in the entries we supplied means the model invented
   it; the answer is dropped and the deterministic summary is sent instead.

``grounded`` in the response is therefore a fact about how the answer was made,
not a label the model applied to itself.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

import requests

from intake import config as intake_config
from portal import catalogue

log = logging.getLogger("sahaay.assistant")

# Same Ollama and same pinned model as intake, on its own timeout: writing four
# sentences takes longer than filling a JSON schema, and ARCHITECTURE §8's 6 s
# budget is about the applicant waiting mid-sentence, not about a chat reply.
MODEL = os.environ.get("SAHAAY_ASSISTANT_MODEL", intake_config.LLM_MODEL).strip()
try:
    TIMEOUT_S = float(os.environ["SAHAAY_ASSISTANT_TIMEOUT_S"])
except (KeyError, ValueError):
    TIMEOUT_S = 25.0
MAX_CITED = 5

# What the assistant says when the question does not reach the catalogue. It
# is deliberately the same sentence every time: a refusal that varies reads as
# a model improvising, which is the thing this endpoint promises not to do.
REFUSAL = {
    "en": ("I can only answer from NSFDC's scheme information on this site. "
           "I could not find anything about that here. Try asking about a "
           "scheme, its interest rate, who is eligible, which documents you "
           "need, or how to apply."),
    "hi": ("मैं केवल इस साइट पर मौजूद NSFDC की योजना जानकारी से जवाब दे सकता हूँ। "
           "इस बारे में यहाँ कुछ नहीं मिला। किसी योजना, उसकी ब्याज दर, पात्रता, "
           "ज़रूरी कागज़ात या आवेदन के तरीके के बारे में पूछें।"),
}

LEAD_IN = {
    "en": "From NSFDC's scheme information on this site:",
    "hi": "इस साइट पर मौजूद NSFDC की योजना जानकारी से:",
}

CLOSED_NOTE = {
    "en": "closed to new applications",
    "hi": "नए आवेदनों के लिए बंद",
}

INFO_NOTE = {
    "en": "information only — this site does not check eligibility for it",
    "hi": "केवल जानकारी — इस पर पात्रता की जाँच यह साइट नहीं करती",
}


# --------------------------------------------------------------- retrieval
# Words that mean "a scheme in this catalogue". Nothing outside this vocabulary
# can reach the model, which is what makes the refusal deterministic.
TOPIC_TERMS: dict[str, tuple[str, ...]] = {
    "rate": ("interest", "rate", "percent", "%", "ब्याज", "दर", "प्रतिशत", "byaj"),
    "amount": ("amount", "how much", "maximum", "limit", "lakh", "loan amount",
               "रकम", "कितना", "कितनी", "अधिकतम", "सीमा", "लाख", "kitna"),
    "eligibility": ("eligible", "eligibility", "qualify", "who can", "income",
                    "caste", "criteria", "पात्र", "पात्रता", "योग्य", "आय",
                    "जाति", "शर्त", "मिल सकती", "मिलेगा", "मिलेगी"),
    "documents": ("document", "papers", "certificate", "proof",
                  "दस्तावेज़", "दस्तावेज", "कागज़", "कागज", "प्रमाण"),
    "apply": ("apply", "application", "where", "office", "bank", "branch",
              "आवेदन", "कहाँ", "कहां", "दफ़्तर", "कार्यालय", "बैंक", "शाखा"),
    "repay": ("repay", "instalment", "installment", "emi", "moratorium",
              "tenure", "years", "किस्त", "चुकाना", "मोहलत", "अवधि", "वर्ष"),
    "general": ("scheme", "schemes", "nsfdc", "yojana", "loan", "business",
                "education", "study", "training", "subsidy", "stall",
                "योजना", "योजनाएँ", "योजनाओं", "कर्ज़", "कर्ज", "ऋण",
                "कारोबार", "व्यवसाय", "पढ़ाई", "शिक्षा", "प्रशिक्षण",
                "सब्सिडी", "स्टॉल"),
}

CATEGORY_TERMS: dict[str, tuple[str, ...]] = {
    "loan": ("loan", "kraj", "कर्ज़", "कर्ज", "ऋण", "business", "कारोबार",
             "व्यवसाय", "enterprise"),
    "education": ("education", "study", "course", "college", "student", "fee",
                  "शिक्षा", "पढ़ाई", "कोर्स", "कॉलेज", "छात्र", "फीस"),
    "training": ("training", "skill", "प्रशिक्षण", "कौशल", "ट्रेनिंग"),
    "subsidy": ("subsidy", "subvention", "सब्सिडी", "अनुदान"),
    "marketing": ("marketing", "stall", "exhibition", "sell", "विपणन",
                  "स्टॉल", "प्रदर्शनी", "बेच"),
}

# Extra names people search by that are not the entry's own name.
EXTRA_NAMES: dict[str, tuple[str, ...]] = {
    "MFS": ("micro finance", "microfinance", "mfs", "सूक्ष्म वित्त"),
    "TL": ("term loan", "मियादी"),
    "AMY": ("aajeevika", "ajeevika", "amy", "आजीविका"),
    "UNY": ("udyam nidhi", "uny", "उद्यम निधि"),
    "ELS": ("education loan", "els", "शिक्षा ऋण"),
    "MSY": ("mahila samriddhi", "mahila", "msy", "महिला समृद्धि", "महिला"),
    "LVY": ("laghu", "lvy", "लघु"),
    "UTKARSH": ("utkarsh", "उत्कर्ष"),
    "SUVIDHA": ("suvidha", "सुविधा"),
    "VISVAS": ("visvas", "vishwas", "विश्वास"),
    "SEED": ("seed", "self help", "self-help", "shg", "स्वयं सहायता", "सीड"),
    "NFSC": ("fellowship", "nfsc", "research", "phd", "फेलोशिप", "शोध"),
    "SKILL": ("skill development", "कौशल विकास"),
    "MARKET": ("marketing support", "विपणन सहायता"),
}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _contains(question: str, term: str) -> bool:
    """Substring, except for short Latin terms, which need word boundaries.

    ``TL`` is a scheme id and also two letters inside "gently". A short id
    matching mid-word would let an unrelated question through the gate, which
    is the one failure this module is not allowed to have.
    """
    term = term.lower().strip()
    if not term:
        return False
    if len(term) <= 4 and re.fullmatch(r"[a-z][a-z\-]*", term):
        return re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])",
                         question) is not None
    return term in question


def analyse(question: str, profile: Optional[dict] = None
            ) -> tuple[list[str], list[str]]:
    """``(cited entry ids, topics)``. An empty id list means refuse.

    Scored, not ranked by a model: a named scheme outweighs a category, a
    category outweighs a bare topic word. The scores are only there to choose
    which five entries go in the prompt when the question is broad. The topics
    come back too, because they decide how much of each entry the prompt needs
    to carry -- see ``entry_notes``.
    """
    q = _norm(question)
    if not q:
        return [], []

    scores: dict[str, int] = {}
    for row in catalogue.cards():
        sid = row["id"]
        score = 0
        names = (row["name_en"], row["name_hi"], sid) + EXTRA_NAMES.get(sid, ())
        if any(_contains(q, n) for n in names):
            score += 100
        if any(_contains(q, t) for t in CATEGORY_TERMS.get(row["category"], ())):
            score += 10
        if score:
            scores[sid] = score

    topics = [name for name, terms in TOPIC_TERMS.items()
              if any(_contains(q, t) for t in terms)]

    if not scores and not topics:
        return [], []      # the gate: nothing here is about our catalogue

    if not scores:
        # A topic with no scheme named -- "what is the interest rate?". Answer
        # from the entries we can actually stand behind: the five the engine
        # decides, which are the only ones carrying a rate or a ceiling.
        for row in catalogue.cards():
            if row["has_full_logic"]:
                scores[row["id"]] = 1

    for sid in scores:
        scores[sid] += len(topics)

    # A saved profile is a tie-breaker, never a filter: an education profile
    # should not stop someone reading about a loan.
    if profile:
        purpose = profile.get("purpose")
        for sid in scores:
            row = catalogue.get(sid)
            if purpose == "education" and row["category"] == "education":
                scores[sid] += 3
            if purpose == "enterprise" and row["category"] == "loan":
                scores[sid] += 3
            if row["status"] == "open":
                scores[sid] += 1

    order = sorted(scores, key=lambda s: (-scores[s], catalogue.ids().index(s)))
    return order[:MAX_CITED], topics


def retrieve(question: str, profile: Optional[dict] = None) -> list[str]:
    """Just the ids. Empty means the question never reaches a model."""
    return analyse(question, profile)[0]


# ------------------------------------------------------------------ context
# Which of an entry's lists a topic actually needs. Everything else is left
# out, which is not only tidiness: the context has to fit inside the same
# ``num_ctx`` intake pins, or Ollama reloads the model on every alternation
# between the two callers and both get slower and less reliable. Measured --
# it cost four extraction tests in a full-suite run before this was fixed.
TOPIC_SECTIONS = {
    "eligibility": ("eligibility_text",),
    "amount": ("eligibility_text",),
    "documents": ("documents",),
    "apply": ("how_to_apply",),
    "repay": ("how_to_apply",),
    "general": ("eligibility_text",),
}

SECTION_LABEL = {
    "eligibility_text": {"en": "eligibility", "hi": "पात्रता"},
    "documents": {"en": "documents", "hi": "दस्तावेज़"},
    "how_to_apply": {"en": "how to apply", "hi": "आवेदन कैसे करें"},
}


def entry_notes(scheme_id: str, lang: str,
                topics: Optional[list[str]] = None) -> str:
    """One catalogue entry, flattened into the lines the model may quote.

    ``topics=None`` means the whole entry. Otherwise only the lists the
    question asked for -- and always the whole entry when it is the only one
    cited, because a question about one named scheme deserves all of it.
    """
    d = catalogue.detail(scheme_id, lang)
    name = d["name_hi"] if lang == "hi" else d["name_en"]
    lines = [f"[{scheme_id}] {name}"]
    if d["status"] == "closed":
        lines.append(f"- {CLOSED_NOTE[lang]}")
    elif d["status"] == "informational":
        lines.append(f"- {INFO_NOTE[lang]}")
    lines.append("- " + d[f"one_line_{lang}"])
    if d["rate_text"]:
        lines.append(("- ब्याज दर: " if lang == "hi" else "- interest rate: ")
                     + d["rate_text"])

    if topics is None:
        wanted = ("eligibility_text", "documents", "how_to_apply")
    else:
        wanted = tuple(dict.fromkeys(
            field for topic in topics for field in TOPIC_SECTIONS.get(topic, ())))
    for field in wanted:
        lines.append(f"- {SECTION_LABEL[field][lang]}:")
        lines.extend(f"  · {line}" for line in d[field])
    return "\n".join(lines)


def build_context(scheme_ids: list[str], lang: str,
                  topics: Optional[list[str]] = None) -> str:
    if len(scheme_ids) == 1:
        topics = None                       # one scheme named: give it all
    return "\n\n".join(entry_notes(sid, lang, topics) for sid in scheme_ids)


# The CANNOT_ANSWER rule is last and narrowly worded on purpose. Written first
# and broadly ("if the notes do not contain the answer"), a 3B model reads it
# as permission to give up and refuses questions the notes plainly do answer --
# measured, in Hindi, on qwen2.5:3b-instruct. The gate above is what makes
# refusal reliable; this line only catches the case where retrieval was too
# generous, and ``ask`` treats it as "nothing to add", not as a refusal.
SYSTEM = {
    "en": (
        "You explain NSFDC's government schemes to applicants, many of whom "
        "left school early.\n"
        "RULES:\n"
        "1. Answer ONLY from the SCHEME NOTES below. They are the whole of what "
        "you know.\n"
        "2. Copy every figure — interest rate, rupee amount, percentage, number "
        "of years — exactly as it appears in the notes. Never write a figure "
        "that is not there.\n"
        "3. Name the scheme you are quoting.\n"
        "4. Plain short sentences. At most four. One number per sentence. No "
        "greeting, no sign-off, no invented offices or dates.\n"
        "5. Only if the notes say nothing at all about the subject of the "
        "question, reply with exactly: CANNOT_ANSWER"),
    "hi": (
        "आप NSFDC की सरकारी योजनाओं की जानकारी देने वाले सहायक हैं। पूछने वाले "
        "अक्सर कम पढ़े-लिखे हैं।\n"
        "नियम:\n"
        "1. केवल नीचे दिए गए योजना नोट्स से जवाब दें। आपकी जानकारी बस इतनी ही है।\n"
        "2. आँकड़े — ब्याज दर, रकम, प्रतिशत, वर्ष — हूबहू वैसे ही लिखें जैसे नोट्स में "
        "हैं। कोई नया आँकड़ा न बनाएँ।\n"
        "3. जिस योजना से बता रहे हैं उसका नाम लिखें।\n"
        "4. सरल छोटे वाक्य, ज़्यादा से ज़्यादा चार। एक वाक्य में एक ही संख्या। कोई "
        "अभिवादन नहीं, कोई मनगढ़ंत कार्यालय या तारीख़ नहीं।\n"
        "5. अगर सवाल का विषय नोट्स में बिल्कुल नहीं है, तभी सिर्फ़ लिखें: "
        "CANNOT_ANSWER"),
}

USER = {
    "en": "SCHEME NOTES\n============\n{context}\n\nQUESTION: {question}\n\nANSWER:",
    "hi": "योजना नोट्स\n============\n{context}\n\nसवाल: {question}\n\nजवाब:",
}


# ------------------------------------------------------- the grounding guard
# A figure is anything that reads as money, a rate or a decimal. List markers
# ("1.", "2.") and bare small integers are not figures and are not policed --
# the guard exists to catch an invented rate or ceiling, not to fight
# punctuation.
FIGURE = re.compile(
    r"(?:₹\s*|rs\.?\s*)(\d[\d,]*(?:\.\d+)?)"          # ₹1,25,000 / Rs 45
    r"|(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)"    # 6.5% / 15 percent
    r"|(\d[\d,]*(?:\.\d+)?)\s*(?:lakh|crore|लाख|करोड़)"  # 1.25 lakh
    r"|(\d[\d,]*\.\d+)",                              # any bare decimal
    re.IGNORECASE)


def _figures(text: str) -> set[str]:
    out = set()
    for match in FIGURE.finditer(text or ""):
        raw = next(g for g in match.groups() if g)
        value = raw.replace(",", "").rstrip(".")
        if value.endswith(".0"):
            value = value[:-2]
        out.add(value)
    return out


def ungrounded_figures(answer: str, context: str) -> set[str]:
    """Figures in the answer that are not in the notes it was given."""
    return _figures(answer) - _figures(context)


# ------------------------------------------------------------------ compose
def compose(scheme_ids: list[str], lang: str) -> str:
    """The answer when no model is involved: the entries, read back.

    Used when Ollama is absent, slow, or has just been caught inventing a
    figure. It is grounded by construction -- every sentence is a line from the
    catalogue -- so the endpoint degrades to a duller answer rather than to a
    wrong one, the same way intake degrades to its deterministic fallback.
    """
    parts = [LEAD_IN[lang]]
    for sid in scheme_ids:
        d = catalogue.detail(sid, lang)
        name = d["name_hi"] if lang == "hi" else d["name_en"]
        line = f"• {name} — {d[f'one_line_{lang}']}"
        if d["status"] == "closed":
            line += f" ({CLOSED_NOTE[lang]})"
        parts.append(line)
    return "\n".join(parts)


def _ask_model(question: str, context: str, lang: str) -> Optional[str]:
    payload = {
        "model": MODEL,
        "stream": False,
        # Same num_ctx as intake pins (intake/config.py). Ollama keys a loaded
        # model on its load options: a different value here would evict and
        # reload the weights on every alternation between intake and this
        # endpoint, on the one laptop the demo runs on.
        "options": {"temperature": 0.0, "seed": 0,
                    "num_ctx": intake_config.LLM_NUM_CTX},
        "keep_alive": intake_config.LLM_KEEP_ALIVE,
        "messages": [
            {"role": "system", "content": SYSTEM[lang]},
            {"role": "user", "content": USER[lang].format(context=context,
                                                          question=question)},
        ],
    }
    try:
        r = requests.post(f"{intake_config.OLLAMA_URL}/api/chat",
                          json=payload, timeout=TIMEOUT_S)
        r.raise_for_status()
        return (r.json()["message"]["content"] or "").strip()
    except (requests.RequestException, KeyError, ValueError) as e:
        log.warning("assistant: ollama unavailable (%s) -- composing from the "
                    "catalogue instead", type(e).__name__)
        return None


DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def detect_lang(question: str) -> str:
    """Used only when the caller did not say. A question in Devanagari gets a
    Hindi answer -- including a Hindi refusal, which is the part that matters:
    being turned away in a language you cannot read is being turned away
    twice."""
    return "hi" if DEVANAGARI.search(question or "") else "en"


def ask(question: str, lang: Optional[str] = None,
        profile: Optional[dict] = None) -> dict:
    """``{answer, cited_scheme_ids, grounded, source}``. §2 plus ``source``,
    which says which of the three paths produced the answer."""
    lang = lang if lang in ("hi", "en") else detect_lang(question)
    cited, topics = analyse(question, profile)

    if not cited:
        return {"answer": REFUSAL[lang], "cited_scheme_ids": [],
                "grounded": True, "refused": True, "source": "refusal"}

    context = build_context(cited, lang, topics)
    raw = _ask_model(question, context, lang)

    if raw is None:
        return {"answer": compose(cited, lang), "cited_scheme_ids": cited,
                "grounded": True, "refused": False, "source": "catalogue"}

    if "CANNOT_ANSWER" in raw.upper():
        # Retrieval, not the model, decides whether we hold relevant material.
        # It found these entries, so they are read back rather than thrown
        # away because a 3B model lost its nerve. The only true refusal is the
        # gate above.
        log.info("assistant: model declined; composing from %s", ", ".join(cited))
        return {"answer": compose(cited, lang), "cited_scheme_ids": cited,
                "grounded": True, "refused": False, "source": "catalogue"}

    invented = ungrounded_figures(raw, context)
    if invented:
        log.warning("assistant: model produced figures not in the notes (%s) "
                    "-- dropping the answer", ", ".join(sorted(invented)))
        return {"answer": compose(cited, lang), "cited_scheme_ids": cited,
                "grounded": True, "refused": False, "source": "catalogue",
                "dropped_figures": sorted(invented)}

    return {"answer": raw, "cited_scheme_ids": cited, "grounded": True,
            "refused": False, "source": "model"}
