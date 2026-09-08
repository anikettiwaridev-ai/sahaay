# -*- coding: utf-8 -*-
"""Every number the catalogue shows, derived from ``data/schemes.json``.

docs/03-BUILD-BRIEFS.md Track A: *"The five with has_full_logic must use the
exact figures already in data/schemes.json -- do not retype a rate."*

So this module is the only place in Track A that is allowed to know a figure,
and it does not know any either: it reads them. ``data/catalogue.json`` writes
``{rate}`` and ``{loan_cap}``; ``resolve()`` fills them in. A placeholder with
no value behind it raises at load time rather than rendering an empty string,
which is the point -- a missing rate must be a crash, not a blank.

Nothing here decides anything. It formats.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMES_JSON = ROOT / "data" / "schemes.json"
ALIASES_JSON = ROOT / "data" / "scheme_aliases.json"

PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")


class FigureMissing(RuntimeError):
    """A placeholder in catalogue.json has no figure behind it."""


# ------------------------------------------------------------ raw sources
@lru_cache(maxsize=1)
def schemes() -> dict[str, dict]:
    """``data/schemes.json`` keyed by id. The engine reads the same file
    through its compiled SQLite; ``test_portal.py`` asserts the two agree, so
    the JSON cannot drift away from what the rules actually use."""
    if not SCHEMES_JSON.exists():
        raise FigureMissing(f"{SCHEMES_JSON} not found")
    raw = json.loads(SCHEMES_JSON.read_text(encoding="utf-8"))
    return {s["id"]: s for s in raw["schemes"]}


@lru_cache(maxsize=1)
def common_eligibility() -> dict:
    raw = json.loads(SCHEMES_JSON.read_text(encoding="utf-8"))
    return raw["_meta"]["common_eligibility"]


@lru_cache(maxsize=1)
def aliases() -> dict[str, dict]:
    """``data/scheme_aliases.json`` keyed by alias -- where the four closed
    schemes get their names, so the catalogue does not hold a second copy."""
    raw = json.loads(ALIASES_JSON.read_text(encoding="utf-8"))
    return {a["alias"]: a for a in raw["aliases"]}


# --------------------------------------------------------------- formatting
LAKH = 100_000


def indian_commas(n: int) -> str:
    """1234567 -> '12,34,567'. The last three digits, then pairs."""
    s = str(abs(int(n)))
    if len(s) <= 3:
        body = s
    else:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        body = ",".join(groups) + "," + tail
    return ("-" if n < 0 else "") + body


def money(n: int, lang: str = "en") -> str:
    """Rupees, the way the number wants to be read.

    A round lakh is spoken as a lakh -- '1.25 lakh' is how the applicant and
    the scheme page both say it. Anything that does not land on two decimal
    places of a lakh keeps every digit, because 1,40,001 is a threshold and
    rounding it would be a lie.
    """
    n = int(n)
    if n >= LAKH:
        lakhs = n / LAKH
        if abs(round(lakhs, 2) * LAKH - n) < 0.5:
            text = f"{round(lakhs, 2):g}"
            return f"₹{text} " + ("लाख" if lang == "hi" else "lakh")
    return "₹" + indian_commas(n)


def pct(value: float) -> str:
    """6.5 -> '6.5%', 8.0 -> '8%'."""
    return f"{value:g}%"


def rate_span(rates: list[float]) -> str:
    """One rate reads as itself; several read as the range the applicant is
    actually choosing between (UNY is 13% at a cooperative, 15% at an SFB)."""
    uniq = sorted(set(rates))
    if len(uniq) == 1:
        return pct(uniq[0])
    return f"{pct(uniq[0])}–{pct(uniq[-1])}"


def months(n: int, lang: str = "en") -> str:
    if n % 12 == 0 and n >= 12:
        years = n // 12
        if lang == "hi":
            return f"{years} वर्ष"
        return f"{years} year" if years == 1 else f"{years} years"
    if lang == "hi":
        return f"{n} महीने"
    return f"{n}-month"


FREQUENCY = {
    "quarterly": {"en": "quarterly", "hi": "तिमाही"},
    "half_yearly": {"en": "half-yearly", "hi": "अर्धवार्षिक"},
}

# Words, not figures: what a channel type is called in a sentence.
CHANNEL = {
    "SCA": {"en": "State Channelizing Agency",
            "hi": "राज्य चैनलाइज़िंग एजेंसी"},
    "PSB": {"en": "public sector bank",
            "hi": "सार्वजनिक क्षेत्र के बैंक"},
    "RRB": {"en": "regional rural bank",
            "hi": "क्षेत्रीय ग्रामीण बैंक"},
    "NBFC_MFI": {"en": "micro-finance company (NBFC-MFI)",
                 "hi": "माइक्रो-फाइनेंस कंपनी (NBFC-MFI)"},
    "COOP_BANK": {"en": "cooperative bank",
                  "hi": "सहकारी बैंक"},
    "COOP_SOCIETY": {"en": "cooperative society",
                     "hi": "सहकारी समिति"},
    "SFB": {"en": "small finance bank",
            "hi": "स्मॉल फाइनेंस बैंक"},
    "OTHER": {"en": "listed agency", "hi": "सूचीबद्ध एजेंसी"},
}


def _join(parts: list[str], lang: str) -> str:
    if len(parts) == 1:
        return parts[0]
    tail = " या " if lang == "hi" else " or "
    return ", ".join(parts[:-1]) + tail + parts[-1]


# ----------------------------------------------------------- the value table
def scheme_values(scheme_id: str, lang: str) -> dict[str, str]:
    """Every placeholder a scheme's own prose may use, already formatted."""
    s = schemes()[scheme_id]
    rates = list(s["beneficiary_rate_pct"].values())
    v: dict[str, str] = {
        "rate": rate_span(rates),
        "rate_min": pct(min(rates)),
        "rate_max": pct(max(rates)),
        "nsfdc_rate": pct(s["nsfdc_to_ca_rate_pct"]),
        "loan_cap": money(s["loan_cap"], lang),
        "amount_min": money(s["amount_min"], lang) if s["amount_min"] else None,
        "amount_max": money(s["amount_max"], lang),
        "loan_pct": str(s["loan_pct"]),
        "frequency": FREQUENCY[s["frequency_default"]][lang],
        "channels": _join([CHANNEL[c][lang] for c in s["channel_types"]], lang),
    }
    if s.get("tenure_total_months"):
        v["tenure"] = months(s["tenure_total_months"], lang)
    if s.get("moratorium_months"):
        v["moratorium"] = months(s["moratorium_months"], lang)
    return {k: val for k, val in v.items() if val is not None}


def global_values(lang: str) -> dict[str, str]:
    """Placeholders any entry may use -- the criteria common to all five
    schemes, and the two open schemes a closed entry points people towards."""
    ce = common_eligibility()
    mfs, tl = schemes()["MFS"], schemes()["TL"]
    return {
        "income_max": money(ce["annual_family_income_inr_max"], lang),
        "mfs_rate": rate_span(list(mfs["beneficiary_rate_pct"].values())),
        "mfs_loan_cap": money(mfs["loan_cap"], lang),
        "tl_rate": rate_span(list(tl["beneficiary_rate_pct"].values())),
        "tl_amount_min": money(tl["amount_min"], lang),
    }


def resolve(text: str, values: dict[str, str], where: str) -> str:
    """Fill ``{placeholders}``. An unknown one is a crash, by design."""
    def sub(m: re.Match) -> str:
        key = m.group(1)
        if key not in values:
            raise FigureMissing(
                f"{where}: no figure for {{{key}}} in data/schemes.json. "
                f"Known: {', '.join(sorted(values))}")
        return values[key]
    return PLACEHOLDER.sub(sub, text)
