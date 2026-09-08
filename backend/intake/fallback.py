# -*- coding: utf-8 -*-
"""The deterministic half of intake. ARCHITECTURE §4 step 4.

Regex and lookup tables over the same text the LLM sees, run **in parallel with
it, always** (ENGINE_SPEC §9.1). Two jobs:

1. When the LLM is slow, absent or wrong, this is what the applicant gets. A
   demo laptop with Ollama killed still produces a usable profile.
2. When the LLM is fine, this is the auditor. Agreement raises confidence;
   disagreement keeps *this* value and sends the field to the confirm screen
   (§9.4) -- the deterministic parser is the one a judge can read.

Nothing here decides eligibility. It reads numbers, places and keywords.

Tables live here rather than in ``data/`` because ARCHITECTURE §4 puts the
fallback tables in ``backend/intake/`` and versions them with the prompt.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import data                            # noqa: E402
from intake.config import C_EXACT, C_HEURISTIC     # noqa: E402


@dataclass(frozen=True)
class Value:
    """One extracted field, with the evidence that produced it.

    ``exact`` is the §9.5/§9.6 distinction: a deterministic match (a number, a
    gazetteer place) or a heuristic one (a keyword guess at sector).
    """

    value: object
    confidence: float
    exact: bool
    matched: str = ""

    @property
    def kind(self) -> str:
        return "exact" if self.exact else "heuristic"


def _exact(v, matched: str = "") -> Value:
    return Value(v, C_EXACT, True, matched)


def _guess(v, matched: str = "") -> Value:
    return Value(v, C_HEURISTIC, False, matched)


# ===================================================================== numbers
# Hindi 1-99 in words. Written out rather than generated because Hindi numerals
# are irregular above ten and a generator would invent forms nobody says.
HI_UNITS: dict[str, int] = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
    "छह": 6, "छः": 6, "छे": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "पन्द्रह": 15,
    "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
    "इक्कीस": 21, "बाईस": 22, "तेईस": 23, "चौबीस": 24, "पच्चीस": 25,
    "छब्बीस": 26, "सत्ताईस": 27, "अट्ठाईस": 28, "उनतीस": 29, "तीस": 30,
    "इकतीस": 31, "बत्तीस": 32, "तैंतीस": 33, "चौंतीस": 34, "पैंतीस": 35,
    "छत्तीस": 36, "सैंतीस": 37, "अड़तीस": 38, "उनतालीस": 39, "चालीस": 40,
    "इकतालीस": 41, "बयालीस": 42, "तैंतालीस": 43, "चवालीस": 44, "पैंतालीस": 45,
    "छियालीस": 46, "सैंतालीस": 47, "अड़तालीस": 48, "उनचास": 49, "पचास": 50,
    "इक्यावन": 51, "बावन": 52, "तिरेपन": 53, "चौवन": 54, "पचपन": 55,
    "छप्पन": 56, "सत्तावन": 57, "अट्ठावन": 58, "उनसठ": 59, "साठ": 60,
    "इकसठ": 61, "बासठ": 62, "तिरेसठ": 63, "चौंसठ": 64, "पैंसठ": 65,
    "छियासठ": 66, "सड़सठ": 67, "अड़सठ": 68, "उनहत्तर": 69, "सत्तर": 70,
    "इकहत्तर": 71, "बहत्तर": 72, "तिहत्तर": 73, "चौहत्तर": 74, "पचहत्तर": 75,
    "छिहत्तर": 76, "सतहत्तर": 77, "अठहत्तर": 78, "उन्यासी": 79, "अस्सी": 80,
    "इक्यासी": 81, "बयासी": 82, "तिरासी": 83, "चौरासी": 84, "पचासी": 85,
    "छियासी": 86, "सत्तासी": 87, "अट्ठासी": 88, "नवासी": 89, "नब्बे": 90,
    "इक्यानवे": 91, "बानवे": 92, "तिरानवे": 93, "चौरानवे": 94, "पंचानवे": 95,
    "छियानवे": 96, "सत्तानवे": 97, "अट्ठानवे": 98, "निन्यानवे": 99,
}

EN_UNITS: dict[str, int] = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fourty": 40, "fifty": 50, "sixty": 60,
    "seventy": 70, "eighty": 80, "ninety": 90,
}

# Multipliers, largest first so a shorter token never eats a longer one.
MULTIPLIERS: dict[str, int] = {
    "करोड़": 10_000_000, "करोड": 10_000_000, "crore": 10_000_000,
    "crores": 10_000_000,
    "लाख": 100_000, "लाख़": 100_000, "lakh": 100_000, "lakhs": 100_000,
    "lac": 100_000, "lacs": 100_000,
    "हज़ार": 1_000, "हजार": 1_000, "thousand": 1_000,
    "सौ": 100, "hundred": 100,
    # Spellings Whisper actually produces, from BAKEOFF.md's transcripts rather
    # than from imagination: it drops the aspirate in लाख and the nukta in
    # हज़ार. A table that only knows the dictionary spelling loses the amount
    # on a third of the Hindi clips.
    "लाक": 100_000, "लांख": 100_000, "हजा़र": 1_000, "हज़ाार": 1_000,
}

# The fraction words a person actually uses for money. "डेढ़ लाख" is not a
# rounding of 1.5 -- it is the word for it, and Phase 2 acceptance names it.
HI_FRACTIONS: dict[str, float] = {
    "डेढ़": 1.5, "डेढ": 1.5, "ढाई": 2.5, "ढ़ाई": 2.5, "आधा": 0.5, "आधी": 0.5,
    # Again from measured ASR output: "देड" and "धाई" are what the transcript
    # says when a person says डेढ़ and ढाई.
    "देड": 1.5, "देढ़": 1.5, "धाई": 2.5, "ढाइ": 2.5,
}
# Modifiers that apply to the number that follows them.
HI_MODIFIERS: dict[str, float] = {
    "सवा": 0.25, "साढ़े": 0.5, "साढे": 0.5, "पौने": -0.25,
}

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

_MULT_RE = "|".join(sorted(map(re.escape, MULTIPLIERS), key=len, reverse=True))
_HI_NUM_RE = "|".join(sorted(map(re.escape, HI_UNITS), key=len, reverse=True))
_EN_NUM_RE = "|".join(sorted(map(re.escape, EN_UNITS), key=len, reverse=True))
_FRAC_RE = "|".join(sorted(map(re.escape, HI_FRACTIONS), key=len, reverse=True))
_MOD_RE = "|".join(sorted(map(re.escape, HI_MODIFIERS), key=len, reverse=True))

# A word-ish number: digits, a Hindi/English number word, a fraction word, or a
# modifier plus a number. The repeated group is what lets "एक लाख बीस हज़ार"
# parse as one amount instead of two.
_NUMWORD = (rf"(?:\d[\d,]*(?:\.\d+)?|{_FRAC_RE}|{_MOD_RE}|{_HI_NUM_RE}"
            rf"|{_EN_NUM_RE}|and|a|half)")
# Longest form first: "रु\.?" would otherwise eat the "रु" of "रुपये".
_CURRENCY = r"(?:₹|रुपयों|रुपये|रुपए|रुपया|रु\.?|rupees|rupee|rs\.?|inr)"
# The outer repetition is what makes "एक लाख बीस हज़ार" one amount of 120000
# rather than two of 100000 and 20000 -- Hindi builds numbers by addition, and
# splitting them is how an applicant asks for a tenth of what they meant.
AMOUNT_RE = re.compile(
    rf"{_CURRENCY}?\s*(?:(?:{_NUMWORD}[\s\-]*)+(?:{_MULT_RE})?[\s\-]*)+"
    rf"\s*{_CURRENCY}?", re.IGNORECASE)

# Things that look like money but are not: ages, durations, standards, rates.
NOT_MONEY_AFTER = re.compile(
    r"^\s*(?:साल|वर्ष|महीने|महीना|माह|वीं|वी|years?|months?|yrs?|"
    r"standard|class|percent|%|st\b|nd\b|rd\b|th\b|बजे|किलोमीटर|km)",
    re.IGNORECASE)


def _words_to_number(chunk: str) -> Optional[float]:
    """Turn one matched number-ish chunk into a number. None if it is not one."""
    if chunk is None:
        return None
    chunk = chunk.translate(DEVANAGARI_DIGITS)
    # Indian digit grouping is part of the number, not a separator: strip the
    # commas inside "3,50,000" before anything splits on them.
    chunk = re.sub(r"(?<=\d),(?=\d)", "", chunk)
    tokens = [t for t in re.split(r"[\s\-,]+", chunk.strip().lower()) if t]
    if not tokens:
        return None

    total = 0.0         # completed groups: "एक लाख" plus "बीस हज़ार"
    current = 0.0       # the group being built
    pending_mod = 0.0   # सवा / साढ़े / पौने apply to what follows
    half_pending = False
    seen_any = False

    for tok in tokens:
        raw = tok.strip(".।,")
        if raw in ("and", "a", ""):
            continue
        if raw == "half":
            half_pending = True     # "two and a half lakh"
            seen_any = True
            continue
        if raw in HI_MODIFIERS:
            pending_mod = HI_MODIFIERS[raw]
            seen_any = True
            continue
        if raw in HI_FRACTIONS:
            current += HI_FRACTIONS[raw]
            seen_any = True
            continue
        if raw in MULTIPLIERS:
            base = current if current else (1.0 if seen_any else 0.0)
            if half_pending:
                base += 0.5
                half_pending = False
            if pending_mod:
                base += pending_mod
                pending_mod = 0.0
            if base == 0.0:
                return None
            total += base * MULTIPLIERS[raw]
            current = 0.0
            seen_any = True
            continue
        num = None
        if re.fullmatch(r"\d+(?:\.\d+)?", raw.replace(",", "")):
            num = float(raw.replace(",", ""))
        elif raw in HI_UNITS:
            num = float(HI_UNITS[raw])
        elif raw in EN_UNITS:
            num = float(EN_UNITS[raw])
        if num is None:
            return None
        if pending_mod:
            num += pending_mod
            pending_mod = 0.0
        current += num
        seen_any = True

    if half_pending:
        current += 0.5
    if pending_mod:
        current += pending_mod
    value = total + current
    return value if seen_any and value else None


def _has_multiplier(chunk: str) -> bool:
    low = chunk.lower()
    return any(re.search(rf"(?<![\wऀ-ॿ]){re.escape(m)}(?![\wऀ-ॿ])", low)
               for m in MULTIPLIERS)


@dataclass(frozen=True)
class Amount:
    value: int
    start: int
    end: int
    text: str


def parse_amounts(text: str) -> list[Amount]:
    """Every money quantity in the text, in order, with where it was found.

    A number counts as money only if it carries a multiplier (लाख / हज़ार /
    lakh / thousand) or reaches four figures on its own. That one rule is what
    keeps "आठवीं", "35 साल" and "two years" out of the amount fields.
    """
    out: list[Amount] = []
    for m in AMOUNT_RE.finditer(text):
        chunk, end = m.group(0).strip(), m.end()
        # "2 lakh 40 thousand a year" ends the match on the "a", which would
        # then read "year" as the unit and throw the amount away. Give the
        # filler word back before deciding what follows the number.
        trimmed = re.sub(r"(?:\s|^)(?:and|a)\s*$", "", chunk, flags=re.IGNORECASE)
        end -= len(chunk) - len(trimmed)
        chunk = trimmed
        if not chunk or not re.search(r"[\dऀ-ॿa-z]", chunk, re.IGNORECASE):
            continue
        if NOT_MONEY_AFTER.match(text[end:end + 12]):
            continue
        value = _words_to_number(re.sub(_CURRENCY, " ", chunk, flags=re.IGNORECASE))
        if value is None:
            continue
        if not _has_multiplier(chunk) and value < 1000:
            continue
        out.append(Amount(int(round(value)), m.start(), end, chunk))
    return out


# ------------------------------------------------------- what an amount is for
INCOME_CUES = [
    "आय", "आमदनी", "कमाई", "कमाते", "कमाती", "सालाना", "वार्षिक", "प्रति वर्ष",
    "साल में", "इनकम", "income", "earn", "earns", "earning", "per year",
    "annually", "yearly", "annual", "a year", "salary",
]
OWN_CUES = [
    "अपने पास", "खुद के", "खुद का", "स्वयं", "मार्जिन", "जमा है",
    "own contribution", "my own", "savings", "margin money", "i can put",
]


# "आय प्रमाण पत्र" and "income certificate" contain an income word and mean a
# document. A cue followed by one of these is not talking about money.
CUE_CANCEL = re.compile(r"^\s*(?:प्रमाण|प्रमाणपत्र|certificate)", re.IGNORECASE)


def _cue_positions(text: str, cues: list[str]) -> list[int]:
    low = text.lower()
    out = []
    for cue in cues:
        start = low.find(cue)
        while start >= 0:
            if not CUE_CANCEL.match(text[start + len(cue):start + len(cue) + 14]):
                out.append(start)
            start = low.find(cue, start + 1)
    return sorted(out)


SENTENCE_END = re.compile(r"[।.?!\n]")


def _cue_gap(text: str, pos: int, amt: Amount) -> Optional[float]:
    """Distance from a cue to an amount, or None if the cue cannot mean it.

    Two corrections to raw distance, both from real sentences in the test set:

    * A full stop or `।` between them ends the reference. "कुल लागत सवा लाख
      रुपये। सालाना आय एक लाख बीस हज़ार" puts the income cue two characters
      after the *project cost*, and without this the applicant's costs and
      earnings swap places.
    * A cue normally precedes its amount ("सालाना आय X", "family income is X");
      reading backwards ("X per year") is possible but rarer, so it pays a
      penalty rather than being forbidden.
    """
    if amt.start <= pos <= amt.end:
        return 0.0
    forward = pos < amt.start
    lo, hi = (pos, amt.start) if forward else (amt.end, pos)
    if SENTENCE_END.search(text[lo:hi]):
        return None
    gap = float(hi - lo)
    return gap if forward else gap * 3 + 5


def label_amounts(text: str, amounts: list[Amount]) -> dict[str, Amount]:
    """Decide which amount is the ask and which is the household income.

    Binding is by *nearest cue*, not by a window around each number. A window
    gets utterance 1 wrong -- "मुझे एक लाख बीस हज़ार चाहिए। सालाना आय दो लाख
    चालीस हज़ार है" puts an income cue within reach of both numbers, and the
    first one wins, so the applicant asks for their income and declares their
    loan. Each cue instead claims the amount closest to it, and whatever is left
    over is what the person is asking for.
    """
    out: dict[str, Amount] = {}
    if not amounts:
        return out
    claimed: set[int] = set()
    for field, cues, reach in (("annual_family_income_inr", INCOME_CUES, 80),
                               ("own_contribution_inr", OWN_CUES, 60)):
        if field in out:
            continue
        best: tuple[float, int] | None = None
        for pos in _cue_positions(text, cues):
            for i, amt in enumerate(amounts):
                if i in claimed:
                    continue
                gap = _cue_gap(text, pos, amt)
                if gap is not None and gap <= reach and (best is None or gap < best[0]):
                    best = (gap, i)
        if best is not None:
            claimed.add(best[1])
            out[field] = amounts[best[1]]
    for i, amt in enumerate(amounts):
        if i not in claimed:
            out["amount_inr"] = amt
            break
    return out


# ====================================================================== places
# Devanagari city names the gazetteer only knows in Latin script. GeoNames gave
# us English district names; a Hindi-first product has to meet the applicant in
# the script they speak. This covers the persona states plus the largest cities
# elsewhere -- anything outside it still resolves through the LLM, which is
# asked to write place names in English.
HI_PLACES: dict[str, str] = {
    "भोपाल": "Bhopal", "इंदौर": "Indore", "जबलपुर": "Jabalpur", "ग्वालियर": "Gwalior",
    "रीवा": "Rewa", "सागर": "Sagar", "उज्जैन": "Ujjain", "सतना": "Satna",
    "पटना": "Patna", "गया": "Gaya", "मुज़फ़्फ़रपुर": "Muzaffarpur",
    "मुजफ्फरपुर": "Muzaffarpur", "भागलपुर": "Bhagalpur", "दरभंगा": "Darbhanga",
    "मुंबई": "Mumbai", "बंबई": "Mumbai", "पुणे": "Pune", "नागपुर": "Nagpur",
    "नासिक": "Nashik", "नाशिक": "Nashik", "ठाणे": "Thane", "सोलापुर": "Solapur",
    "कोल्हापुर": "Kolhapur", "अमरावती": "Amravati",
    "चेन्नई": "Chennai", "मद्रास": "Chennai", "कोयंबटूर": "Coimbatore",
    "मदुरै": "Madurai", "सेलम": "Salem",
    "हैदराबाद": "Hyderabad", "वारंगल": "Warangal", "निज़ामाबाद": "Nizamabad",
    "करीमनगर": "Karimnagar", "खम्मम": "Khammam",
    "दिल्ली": "New Delhi", "नई दिल्ली": "New Delhi",
    "कोलकाता": "Kolkata", "कलकत्ता": "Kolkata", "हावड़ा": "Howrah",
    "बांकुड़ा": "Bankura", "दार्जिलिंग": "Darjeeling",
    "जयपुर": "Jaipur", "जोधपुर": "Jodhpur", "उदयपुर": "Udaipur", "कोटा": "Kota",
    "अजमेर": "Ajmer", "बीकानेर": "Bikaner", "अलवर": "Alwar",
    "बेंगलुरु": "Bengaluru", "बंगलुरु": "Bengaluru", "बैंगलोर": "Bengaluru",
    "मैसूर": "Mysuru", "मैसूरु": "Mysuru", "कुर्ग": "Kodagu", "कोडागु": "Kodagu",
    "लखनऊ": "Lucknow", "कानपुर": "Kanpur Nagar", "वाराणसी": "Varanasi",
    "बनारस": "Varanasi", "आगरा": "Agra", "प्रयागराज": "Prayagraj",
    "इलाहाबाद": "Prayagraj", "मेरठ": "Meerut", "गोरखपुर": "Gorakhpur",
    "लुधियाना": "Ludhiana", "अमृतसर": "Amritsar", "जालंधर": "Jalandhar",
    "चंडीगढ़": "Chandigarh", "अहमदाबाद": "Ahmedabad", "सूरत": "Surat",
    "वडोदरा": "Vadodara", "राजकोट": "Rajkot", "रायपुर": "Raipur",
    "रांची": "Ranchi", "धनबाद": "Dhanbad", "कटक": "Cuttack",
    "देहरादून": "Dehradun", "हरिद्वार": "Haridwar", "शिमला": "Shimla",
    "गुड़गांव": "Gurugram", "गुरुग्राम": "Gurugram", "फरीदाबाद": "Faridabad",
    "तिरुवनंतपुरम": "Thiruvananthapuram", "कोच्चि": "Ernakulam",
    "विशाखापत्तनम": "Visakhapatnam", "गुवाहाटी": "Kamrup",
}


@lru_cache(maxsize=1)
def _place_index() -> dict:
    """Gazetteer folded into lookup tables, once.

    Districts beat towns and towns beat nothing; a name shared by two states is
    dropped rather than guessed, because a wrong state routes the applicant to a
    partner in the wrong half of the country.
    """
    path = data.ROOT / "data" / "gazetteer.json"
    if not path.exists():
        raise data.DataMissing(
            f"{path} not found. Build it: python scripts/build_gazetteer.py")
    gz = json.loads(path.read_text(encoding="utf-8"))

    districts: dict[str, list[dict]] = {}
    towns: dict[str, list[dict]] = {}
    states: dict[str, str] = {}
    coords: dict[str, dict] = {}
    for st in gz["states"]:
        states[st["name_en"].lower()] = st["id"]
        states[st["name_hi"]] = st["id"]
        coords[st["id"]] = {"lat": st["lat"], "lon": st["lon"]}
        for d in st["districts"]:
            districts.setdefault(d["name"].lower(), []).append(
                {"state": st["id"], "district": d["name"],
                 "lat": d["lat"], "lon": d["lon"]})
            for t in d.get("towns", []):
                towns.setdefault(t["name"].lower(), []).append(
                    {"state": st["id"], "district": d["name"],
                     "lat": t["lat"], "lon": t["lon"]})
    return {"districts": districts, "towns": towns, "states": states,
            "state_coords": coords, "aliases": gz.get("place_aliases", {})}


def _norm(s: str) -> str:
    return unicodedata.normalize("NFC", s)


# Where a place name sits in a sentence: Hindi marks it after, English before.
HI_PLACE_AFTER = {"में", "मे", "से", "का", "की", "के", "वाली", "वाला"}
EN_PLACE_BEFORE = {"in", "from", "near", "at", "of", "to"}


def _edits_within(a: str, b: str, limit: int) -> bool:
    """Levenshtein distance <= limit, abandoned early. Small strings only."""
    if abs(len(a) - len(b)) > limit:
        return False
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > limit:
            return False
        prev = cur
    return prev[-1] <= limit


def _squash(s: str) -> str:
    return re.sub(r"[\s.\-]", "", s.lower())


@lru_cache(maxsize=1)
def _fuzzy_targets() -> list[tuple[str, str]]:
    """(squashed name, canonical district name) for everything worth matching.

    Districts and the Devanagari city table only. Towns are excluded: there are
    1,829 of them, many share a name with a common word, and a fuzzy hit on one
    would route an applicant to the wrong state on the strength of a typo.
    """
    idx = _place_index()
    out = [(_squash(name), rows[0]["district"])
           for name, rows in idx["districts"].items()
           if len({(r["state"], r["district"]) for r in rows}) == 1]
    out += [(_squash(hi), en) for hi, en in HI_PLACES.items()]
    return [(sq, canon) for sq, canon in out if len(sq) >= 4]


def place_positions(text: str, floor: int = 3) -> set[str]:
    """Squashed one- and two-word windows that sit where a place name belongs.

    Hindi marks a place with a postposition after it ("भोपाल **में**"), English
    with a preposition before it ("**in** Bhopal"). Every place name in the
    twenty-utterance set carries one, and so does every place name in ordinary
    speech, because that is how you say where you live.

    This is what stops the router acting on a coincidence: Whisper hears "poly
    house" as "**Pali** house", and Pali is a real district in Rajasthan, so an
    exact search over the sentence sends a Karnataka applicant 1,500 km west
    with confidence 0.9 and no question asked.
    """
    words = re.findall(r"[ऀ-ॿA-Za-z][ऀ-ॿA-Za-z.\-]*", text)
    lowered = [w.lower() for w in words]
    out: set[str] = set()
    for i, _ in enumerate(words):
        for span in (1, 2):
            j = i + span
            if j > len(words):
                continue
            after = lowered[j] if j < len(words) else ""
            before = lowered[i - 1] if i else ""
            if after not in HI_PLACE_AFTER and before not in EN_PLACE_BEFORE:
                continue
            sq = _squash("".join(words[i:j]))
            if floor <= len(sq) <= 20:
                out.add(sq)
    return out


def fuzzy_place(text: str) -> Optional[str]:
    """A place name the ASR got *nearly* right, or None.

    Whisper writes "कुल काता" for कोलकाता, "Putna" for Patna, "Bangaluru" for
    Bengaluru and "Kodogu" for Kodagu -- a space, a vowel, a consonant. Exact
    matching drops the district on those, and with it the router's entire
    answer, so a near match is offered instead. It is marked heuristic (§9.6)
    and goes to the confirm screen: the applicant is asked "Kolkata?" rather
    than told.

    Only looks at place positions, refuses to answer when two districts are
    equally close, and never matches anything under four characters.
    """
    hits: set[str] = set()
    for cand in place_positions(text, floor=4):
        # Four, not five: a Devanagari place name carries more in fewer code
        # points -- लखनऊ is five characters, चेनई is four.
        limit = 1 if len(cand) <= 7 else 2
        for target, canonical in _fuzzy_targets():
            if abs(len(target) - len(cand)) > limit or target == cand:
                continue
            if _edits_within(cand, target, limit):
                hits.add(canonical)
    return next(iter(hits)) if len(hits) == 1 else None


def _positioned(name: str, positions: set[str]) -> bool:
    """Was this canonical name actually spoken in a place position?

    A Devanagari city counts through its alias: the sentence says कोलकाता and
    the gazetteer says Kolkata.
    """
    if _squash(name) in positions:
        return True
    return any(_squash(hi) in positions for hi, en in HI_PLACES.items()
               if en.lower() == name.lower())


def resolve_place(text: str, allow_fuzzy: bool = True) -> Optional[dict]:
    """Text -> {state, district, location, exact}. Deterministic, gazetteer only.

    Used twice: on the raw utterance, and on whatever place name the LLM wrote
    down. The LLM never picks a state id -- it names a place and this resolves
    it, so a hallucinated "MP" cannot reach the router.

    Three passes, best first:

    1. an exact name in a place position -- confidence 0.9;
    2. a near miss in a place position -- 0.6, so the confirm screen asks;
    3. an exact name anywhere else in the sentence -- also 0.6, because "a Pali
       house" is how a mishearing becomes a district.
    """
    if not text:
        return None
    idx = _place_index()
    hay = _norm(" " + text.lower() + " ")

    for hi_name in sorted(HI_PLACES, key=len, reverse=True):
        if _norm(hi_name.lower()) in hay:
            hay += " " + HI_PLACES[hi_name].lower() + " "
    for alias, canonical in idx["aliases"].items():
        if re.search(rf"(?<![\w]){re.escape(alias.lower())}(?![\w])", hay):
            hay += " " + canonical.lower() + " "

    def found(name: str) -> bool:
        return bool(re.search(rf"(?<![\wऀ-ॿ]){re.escape(name)}(?![\wऀ-ॿ])", hay))

    positions = place_positions(text) if allow_fuzzy else None

    def lookup(require_position: bool) -> Optional[dict]:
        state_hits = {sid for name, sid in idx["states"].items()
                      if found(_norm(name.lower()))
                      and (not require_position or _positioned(name, positions))}
        for table in ("districts", "towns"):
            candidates: list[dict] = []
            for name in sorted(idx[table], key=len, reverse=True):
                if not found(name):
                    continue
                if require_position and not _positioned(name, positions):
                    continue
                candidates.extend(idx[table][name])
            if not candidates:
                continue
            if len(state_hits) == 1:
                narrowed = [c for c in candidates if c["state"] in state_hits]
                candidates = narrowed or candidates
            # One name in two states with no state named: refuse to guess.
            if len({(c["state"], c["district"]) for c in candidates}) != 1:
                continue
            c = candidates[0]
            return {"state": c["state"], "district": c["district"],
                    "location": {"lat": c["lat"], "lon": c["lon"],
                                 "source": "gazetteer"}}
        if len(state_hits) == 1:
            sid = next(iter(state_hits))
            co = idx["state_coords"][sid]
            return {"state": sid, "district": None,
                    "location": {"lat": co["lat"], "lon": co["lon"],
                                 "source": "gazetteer"}}
        return None

    if positions is None:                       # resolving an LLM place name
        hit = lookup(require_position=False)
        if hit:
            hit["exact"] = True
        return hit

    hit = lookup(require_position=True)         # 1
    if hit:
        hit["exact"] = True
        return hit

    near = fuzzy_place(text)                    # 2
    if near:
        hit = resolve_place(near, allow_fuzzy=False)
        if hit:
            hit["exact"] = False
            return hit

    hit = lookup(require_position=False)        # 3
    if hit:
        hit["exact"] = False
    return hit


# ==================================================================== keywords
# Order is precedence: the first table that matches wins. "दुकान" is last
# because it turns up inside half the other trades.
SECTOR_KEYWORDS: list[tuple[str, list[str]]] = [
    ("tailoring", ["सिलाई", "दर्जी", "कढ़ाई", "बुटीक",
                   "tailor", "tailoring", "stitch", "sewing", "boutique",
                   "garment", "embroidery"]),
    ("transport", ["ऑटो", "रिक्शा", "टेम्पो", "टैक्सी", "ट्रक", "वैन", "ढुलाई",
                   "auto", "rickshaw", "tempo", "taxi", "truck", "van",
                   "transport", "goods carrier", "loading"]),
    ("agri_allied", ["डेयरी", "दूध", "पशुपालन", "बकरी", "मुर्गी", "मत्स्य", "मछली",
                     "खेती", "ट्रैक्टर", "बागवानी", "मधुमक्खी", "पॉली हाउस",
                     "dairy", "milk", "poultry", "goat", "fishery", "fish farm",
                     "agri", "farming", "tractor", "poly house", "polyhouse",
                     "horticulture", "beekeeping", "growing vegetables"]),
    ("services", ["ब्यूटी", "पार्लर", "सैलून", "मरम्मत", "रिपेयर", "सर्विस",
                  "कोचिंग", "फोटोकॉपी", "धुलाई", "खानपान",
                  "beauty", "parlour", "parlor", "salon", "repair", "servicing",
                  "laundry", "catering", "coaching", "tutoring", "photocopy",
                  "xerox", "cyber cafe"]),
    ("manufacturing", ["फैक्ट्री", "कारखाना", "यूनिट", "उत्पादन",
                       "factory", "manufacturing", "moulding", "molding",
                       "fabrication", "workshop", "processing unit",
                       "production unit"]),
    ("plantation", ["बागान", "रबर", "कॉफ़ी",
                    "plantation", "tea garden", "rubber", "coffee estate"]),
    ("construction", ["ठेकेदारी", "निर्माण कार्य", "राजमिस्त्री",
                      "construction", "contractor", "building work", "masonry"]),
    ("shop", ["दुकान", "किराना", "किराने", "सब्ज़ी", "सब्जी", "ठेला",
              "shop", "store", "kirana", "grocery", "retail", "stall",
              "vending", "canteen"]),
]

EDUCATION_KEYWORDS: list[tuple[str, list[str]]] = [
    ("illiterate", ["निरक्षर", "अनपढ़", "पढ़ी लिखी नहीं", "पढ़ा लिखा नहीं",
                    "illiterate", "never went to school", "no schooling"]),
    ("graduate", ["स्नातक", "ग्रेजुएट", "बी.ए", "बीए पास", "डिग्री पास",
                  "graduate", "graduation", "b.a.", "b.com"]),
    ("higher_secondary", ["बारहवीं", "१२वीं", "12वीं", "इंटरमीडिएट",
                          "12th", "twelfth", "intermediate", "higher secondary",
                          "hsc", "plus two"]),
    ("matric", ["दसवीं", "१०वीं", "10वीं", "मैट्रिक", "हाई स्कूल",
                "10th", "tenth", "matric", "ssc", "high school"]),
    ("middle", ["आठवीं", "८वीं", "8वीं", "सातवीं", "मिडिल",
                "8th", "eighth", "middle school", "class 8"]),
    ("primary", ["पांचवीं", "पाँचवीं", "५वीं", "5वीं", "प्राथमिक",
                 "5th", "fifth", "primary school", "class 5"]),
]

PURPOSE_EDUCATION_CUES = [
    "कोर्स", "फीस", "दाखिला", "एडमिशन", "कॉलेज", "विश्वविद्यालय", "सेमेस्टर",
    "course", "college", "university", "fee", "fees", "tuition", "admission",
    "semester", "mba", "b.sc", "bsc", "diploma",
]
PURPOSE_ENTERPRISE_CUES = [
    "काम शुरू", "धंधा", "व्यवसाय", "बिज़नेस", "बिजनेस", "दुकान", "मशीन",
    "यूनिट", "लोन चाहिए", "खरीदने", "शुरू करना", "बड़ी करनी",
    "business", "shop", "start", "buy", "purchase", "machine", "unit",
    "expand", "enterprise", "self employment",
]

COURSE_LEVEL_KEYWORDS: list[tuple[str, list[str]]] = [
    ("doctoral", ["पीएचडी", "एम.फिल", "phd", "ph.d", "m.phil", "mphil",
                  "doctoral"]),
    ("masters", ["परास्नातक", "एमबीए", "एम.एससी", "masters", "mba", "m.sc",
                 "msc", "m.tech", "mtech", "post graduate"]),
    ("bachelors", ["स्नातक", "बी.एससी", "बीएससी", "बी.टेक", "बी.ए",
                   "bachelor", "bachelors", "b.sc", "bsc", "b.tech", "btech",
                   "b.e", "bba", "bca", "degree", "undergraduate"]),
    ("diploma", ["डिप्लोमा", "पॉलिटेक्निक", "diploma", "polytechnic", "iti"]),
]

SC_CUES = ["अनुसूचित जाति", "एससी वर्ग", "एस.सी", "scheduled caste",
           "sc category", "sc community", "dalit"]

# First-person feminine and masculine verb endings. Hindi marks the speaker's
# gender in the verb, so this is a deterministic read of what was *said*. Names
# are never used for it, in either direction -- ENGINE_SPEC §1 keeps this field
# for the application form, and no rule may read it.
FEMININE_RE = re.compile(
    r"(?:रहती|करती|चाहती|कर रही|चला रही|लेती|पढ़ती|बनाती|वाली)\s*हूँ|"
    r"मैं\s+(?:एक\s+)?(?:महिला|औरत|लड़की)|"
    r"\bi am a (?:woman|female|lady)\b", re.IGNORECASE)
MASCULINE_RE = re.compile(
    r"(?:रहता|करता|चाहता|कर रहा|चला रहा|लेता|पढ़ता|बनाता|वाला)\s*हूँ|"
    r"मैं\s+(?:एक\s+)?(?:पुरुष|आदमी)|"
    r"\bi am a (?:man|male)\b", re.IGNORECASE)

NAME_RE = re.compile(
    r"(?:मेरा\s+नाम\s+(?P<hi>[ऀ-ॿ\s]{2,40}?)\s*(?:है|हूँ)|"
    r"\bmy name is\s+(?P<en>[A-Za-z][A-Za-z .]{1,40}?)\s*(?:[.,]|and|$))",
    re.IGNORECASE)

AGE_RE = re.compile(
    rf"(?:उम्र\s*(?:है|:)?\s*(?P<hi_pre>\d{{1,2}}|{_HI_NUM_RE})\s*(?:साल|वर्ष)|"
    rf"(?P<hi_post>\d{{1,2}}|{_HI_NUM_RE})\s*(?:साल|वर्ष)\s*(?:की|का|कि)?\s*उम्र|"
    rf"\bi am\s+(?P<en>\d{{1,2}})\s*years?\s*old|"
    rf"\bage\s*(?:is)?\s*(?P<en2>\d{{1,2}})\b)", re.IGNORECASE)

ENTERPRISE_AGE_RE = re.compile(
    rf"(?P<n>\d{{1,2}}|{_HI_NUM_RE})\s*(?:साल|वर्ष)\s*से[^।.]{{0,40}}?"
    rf"(?:दुकान|काम|धंधा|व्यवसाय|चला|चल रह)", re.IGNORECASE)
ENTERPRISE_AGE_EN_RE = re.compile(
    rf"(?:been\s+running|running\s+it|run(?:ning)?\s+\w+\s+for)\s*"
    rf"(?:it\s*)?(?:for\s*)?(?P<n>\d{{1,2}}|{_EN_NUM_RE})\s*years?",
    re.IGNORECASE)

COURSE_DURATION_RE = re.compile(
    rf"(?P<n>\d{{1,2}}|{_HI_NUM_RE}|{_EN_NUM_RE})[\s\-]*"
    rf"(?:साल|वर्ष|years?)[\s\-]*(?:का|की|के)?[\s\-]*"
    rf"(?:कोर्स|पाठ्यक्रम|डिग्री|course|degree|programme|program|mba|diploma|"
    rf"बी\.?एससी|b\.?sc|engineering)", re.IGNORECASE)

NEGATION = ["नहीं", "not ", "no ", "without", "yet to", "बिना"]


def _first_keyword(text: str,
                   table: list[tuple[str, list[str]]]) -> Optional[tuple[str, str]]:
    low = text.lower()
    for value, words in table:
        for w in words:
            if w in low:
                return value, w
    return None


def _has_cue(text: str, cues: list[str]) -> Optional[str]:
    low = text.lower()
    for c in cues:
        if c in low:
            return c
    return None


def _negated(text: str, span: tuple[int, int]) -> bool:
    """Was the thing just mentioned denied? Looks left only -- "but not the
    income certificate" negates what follows it; "I have the caste certificate"
    does not."""
    before = text[max(0, span[0] - 40):span[0]].lower()
    return any(n in before for n in NEGATION)


def _certificate(text: str, words: list[str]) -> Optional[Value]:
    low = text.lower()
    for w in words:
        i = low.find(w)
        if i >= 0:
            return _exact(not _negated(text, (i, i + len(w))), w)
    return None


def resolve_course(text: str) -> dict[str, Value]:
    """Course category and level from the ELS course list's own keywords.

    Category ids come from ``data/courses_els.json``; this never invents one,
    and it never decides whether the course qualifies -- R_COURSE does that, in
    the engine.
    """
    low = text.lower()
    out: dict[str, Value] = {}
    for cid, course in data.courses().items():
        for kw in course.get("keywords", []):
            if kw.lower().strip() and kw.lower() in low:
                out["category"] = _guess(cid, kw)
                break
        if "category" in out:
            break
    lvl = _first_keyword(text, COURSE_LEVEL_KEYWORDS)
    if lvl:
        out["level"] = _guess(lvl[0], lvl[1])
    m = COURSE_DURATION_RE.search(text)
    if m:
        n = _words_to_number(m.group("n"))
        if n and 1 <= n <= 10:
            out["duration_months"] = _exact(int(n) * 12, m.group(0))
    return out


# ======================================================================= parse
def parse(text: str, lang: str = "hi") -> dict[str, Value]:
    """Everything the deterministic side can say about this utterance.

    Returns only the fields it actually found. Confidence is §9.5 (0.9) for an
    exact match and §9.6 (0.6) for a keyword guess -- the distinction that keeps
    a correctly parsed amount out of ``needs_confirmation`` while an inferred
    sector goes into it.
    """
    text = _norm(text or "")
    out: dict[str, Value] = {}
    if not text.strip():
        return out

    # --- money, and what each one is for
    for field, amt in label_amounts(text, parse_amounts(text)).items():
        out[field] = _exact(amt.value, amt.text.strip())

    # --- place
    place = resolve_place(text)
    if place:
        # A near match is a question, not a fact (§9.6): confidence 0.6 puts it
        # on the confirm screen as "Kolkata?" instead of routing on a guess.
        mark = _exact if place.get("exact", True) else _guess
        out["state"] = mark(place["state"], place["state"])
        if place["district"]:
            out["district"] = mark(place["district"], place["district"])
        out["location"] = mark(place["location"], place["state"])

    # --- purpose, sector, education
    edu_cue = _has_cue(text, PURPOSE_EDUCATION_CUES)
    ent_cue = _has_cue(text, PURPOSE_ENTERPRISE_CUES)
    if edu_cue:
        out["purpose"] = _guess("education", edu_cue)
    elif ent_cue:
        out["purpose"] = _guess("enterprise", ent_cue)

    is_education = out.get("purpose") is not None and out["purpose"].value == "education"
    sector = _first_keyword(text, SECTOR_KEYWORDS)
    if sector and not is_education:
        out["sector"] = _guess(sector[0], sector[1])
        # Naming a trade is a statement of purpose. Without this, "मुझे ढाई लाख
        # चाहिए अपनी फैक्ट्री के लिए" carries no purpose cue at all and the
        # Ollama-killed path cannot even tell business from study.
        out.setdefault("purpose", _guess("enterprise", sector[1]))

    edu = _first_keyword(text, EDUCATION_KEYWORDS)
    if edu and not is_education:
        out["education"] = _guess(edu[0], edu[1])

    if is_education:
        for key, val in resolve_course(text).items():
            out[f"course.{key}"] = val

    # --- the person
    m = NAME_RE.search(text)
    if m:
        name = (m.group("hi") or m.group("en") or "").strip(" .,")
        if name:
            out["name"] = _exact(name, m.group(0))

    if FEMININE_RE.search(text):
        out["is_woman"] = _exact(True, "feminine verb form")
    elif MASCULINE_RE.search(text):
        out["is_woman"] = _exact(False, "masculine verb form")

    m = AGE_RE.search(text)
    if m:
        raw = next((g for g in m.groupdict().values() if g), None)
        n = _words_to_number(raw)
        if n and 14 <= n <= 100:
            out["age"] = _exact(int(n), m.group(0))

    m = ENTERPRISE_AGE_RE.search(text) or ENTERPRISE_AGE_EN_RE.search(text)
    if m:
        n = _words_to_number(m.group("n"))
        if n and 1 <= n <= 60:
            out["has_existing_enterprise"] = _exact(True, m.group(0))
            out["enterprise_age_months"] = _exact(int(n) * 12, m.group(0))

    sc = _has_cue(text, SC_CUES)
    if sc:
        i = text.lower().find(sc)
        out["is_sc"] = _exact(not _negated(text, (i, i + len(sc))), sc)

    cert = _certificate(text, ["जाति प्रमाण", "caste certificate"])
    if cert:
        out["has_caste_certificate"] = cert
    cert = _certificate(text, ["आय प्रमाण", "income certificate"])
    if cert:
        out["has_income_certificate"] = cert
    if _has_cue(text, ["उद्यम", "udyam", "udyog aadhaar"]):
        out["has_udyam"] = _exact(True, "udyam")

    out["activity_text"] = Value(text.strip(), C_EXACT, True, "verbatim")
    return out
