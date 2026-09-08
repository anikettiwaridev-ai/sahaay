# -*- coding: utf-8 -*-
"""The fourteen-entry catalogue. docs/00-CONTRACTS.md §5.

``data/catalogue.json`` holds the prose and nothing else. This module joins it
to the figures in ``data/schemes.json`` (via ``figures.py``) and to the legacy
names in ``data/scheme_aliases.json``, and hands out ``CatalogueEntry`` objects
in the exact shape §5 fixes.

Built once at import and cached: it is fourteen rows and it never changes at
runtime. Every figure is resolved here, so nothing downstream -- not the API,
not the assistant -- ever has to know a rate.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from portal import figures

ROOT = Path(__file__).resolve().parent.parent.parent
CATALOGUE_JSON = ROOT / "data" / "catalogue.json"

# §5. Anything outside these lists is a data bug, and _build says so.
CATEGORIES = {"loan", "education", "subsidy", "training", "marketing"}
STATUSES = {"open", "informational", "closed"}
LANGS = ("en", "hi")


class CatalogueError(RuntimeError):
    pass


def _resolve_list(raw: Any, shared: dict, lang: str, values: dict,
                  where: str) -> list[str]:
    """A list of sentences, or ``@block`` naming a shared one."""
    if isinstance(raw, str):
        if not raw.startswith("@"):
            raise CatalogueError(f"{where}: expected a list or an @block")
        block = shared.get(raw[1:])
        if block is None:
            raise CatalogueError(f"{where}: no shared block {raw}")
        raw = block[lang]
    return [figures.resolve(line, values, where) for line in raw]


def _names(entry: dict, lang_pair: dict[str, str]) -> None:
    """Fill name_en/name_hi from whichever file already holds the name.

    Three sources, in order of authority: data/schemes.json for the five the
    engine decides, data/scheme_aliases.json for the four closed ones, and
    catalogue.json itself only for the five that appear nowhere else.
    """
    sid = entry["id"]
    if entry.get("figures_from"):
        s = figures.schemes()[sid]
        lang_pair["name_en"] = s["name_en"]
        lang_pair["name_hi"] = s["name_hi"]
    elif entry.get("name_from"):
        a = figures.aliases()[entry["alias"]]
        lang_pair["name_en"] = a["name_en"]
        lang_pair["name_hi"] = a.get("name_hi") or entry.get("name_hi") or a["name_en"]
    else:
        lang_pair["name_en"] = entry["name_en"]
        lang_pair["name_hi"] = entry["name_hi"]


@lru_cache(maxsize=1)
def _build() -> dict[str, dict]:
    raw = json.loads(CATALOGUE_JSON.read_text(encoding="utf-8"))
    shared = raw["shared"]
    out: dict[str, dict] = {}

    for entry in raw["schemes"]:
        sid = entry["id"]
        where = f"catalogue.json[{sid}]"
        if entry["category"] not in CATEGORIES:
            raise CatalogueError(f"{where}: category {entry['category']!r} "
                                 f"is not one of {sorted(CATEGORIES)}")
        if entry["status"] not in STATUSES:
            raise CatalogueError(f"{where}: status {entry['status']!r} "
                                 f"is not one of {sorted(STATUSES)}")

        has_logic = bool(entry.get("figures_from"))
        row: dict[str, Any] = {"id": sid,
                               "category": entry["category"],
                               "status": entry["status"],
                               "has_full_logic": has_logic}
        _names(entry, row)

        if has_logic:
            s = figures.schemes()[sid]
            rates = list(s["beneficiary_rate_pct"].values())
            row["rate_text"] = figures.rate_span(rates)
            row["max_amount_inr"] = s["loan_cap"]
        else:
            # No verified figures exist for these nine. A number here would be
            # one we invented, and §5 would rather show none.
            row["rate_text"] = None
            row["max_amount_inr"] = None

        for lang in LANGS:
            values = {**figures.global_values(lang)}
            if has_logic:
                values.update(figures.scheme_values(sid, lang))
            row[f"one_line_{lang}"] = figures.resolve(
                entry[f"one_line_{lang}"], values, f"{where}.one_line_{lang}")
            for field in ("eligibility_text", "documents", "how_to_apply"):
                row[f"{field}_{lang}"] = _resolve_list(
                    entry[f"{field}_{lang}"], shared, lang, values,
                    f"{where}.{field}_{lang}")
        out[sid] = row

    if len(out) != 14:
        raise CatalogueError(f"expected 14 entries, found {len(out)}")
    if sum(1 for r in out.values() if r["has_full_logic"]) != 5:
        raise CatalogueError("expected exactly 5 entries with full logic")
    return out


# ------------------------------------------------------------------ public
CARD_FIELDS = ("id", "name_en", "name_hi", "category", "status",
               "one_line_en", "one_line_hi", "has_full_logic",
               "rate_text", "max_amount_inr")


def cards() -> list[dict]:
    """The browse list -- exactly the ten §5 fields, in §5 order."""
    return [{k: row[k] for k in CARD_FIELDS} for row in _build().values()]


def detail(scheme_id: str, lang: str = "en") -> dict | None:
    """One entry, plus the three lists §2 names on GET /catalogue/{id}.

    Both languages always ride along so the page can switch without a refetch;
    ``eligibility_text`` / ``documents`` / ``how_to_apply`` are the requested
    language, which is what the contract's field names refer to.
    """
    row = _build().get(scheme_id)
    if row is None:
        return None
    lang = lang if lang in LANGS else "en"
    out = dict(row)
    for field in ("eligibility_text", "documents", "how_to_apply"):
        out[field] = row[f"{field}_{lang}"]

    # The scheme page's fact strip shows repayment period and moratorium
    # beside the rate and the ceiling (docs/02-PAGES.md, scheme.html). The
    # CatalogueEntry shape in contracts §5 has no field for either, so they
    # are added here rather than on the card. Same rule as every other figure
    # in this file: read out of data/schemes.json through figures.py, never
    # typed. ``None`` for the nine entries we hold prose but no terms for --
    # the page prints a dash, which is the honest answer.
    known = scheme_id in figures.schemes()
    for lg in LANGS:
        values = figures.scheme_values(scheme_id, lg) if known else {}
        out[f"tenure_text_{lg}"] = values.get("tenure")
        out[f"moratorium_text_{lg}"] = values.get("moratorium")
    out["tenure_text"] = out[f"tenure_text_{lang}"]
    out["moratorium_text"] = out[f"moratorium_text_{lang}"]

    out["lang"] = lang
    return out


def ids() -> list[str]:
    return list(_build().keys())


def get(scheme_id: str) -> dict | None:
    return _build().get(scheme_id)
