# -*- coding: utf-8 -*-
"""Read-only access to the compiled data layer.

Everything the engine knows comes from ``data/sahidwar.sqlite``, which
``scripts/build_db.py`` compiles from the JSON sources. Loaded once at import
and held in memory: it is a couple of megabytes, it never changes at runtime,
and ENGINE_SPEC §8's latency budget (recommend + cost + route <= 300 ms) does
not survive per-request disk reads.

Nothing here decides anything. Decisions live in rules.py, cost.py and router.py.
"""
from __future__ import annotations

import json
import sqlite3
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DB = ROOT / "data" / "sahidwar.sqlite"


class DataMissing(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _db() -> dict:
    if not DB.exists():
        raise DataMissing(
            f"{DB} not found. Build it first:  python scripts/build_db.py"
        )
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row

    schemes = {r["id"]: json.loads(r["json"]) for r in con.execute("select * from schemes")}
    partners = {r["id"]: json.loads(r["json"]) for r in con.execute("select * from partners")}
    util = {
        r["state"]: dict(r)
        for r in con.execute("select * from state_utilisation")
    }
    for u in util.values():
        u["has_sca"] = bool(u["has_sca"])

    courses = {r["id"]: json.loads(r["json"]) for r in con.execute("select * from courses_els")}
    aliases = {r["alias"]: json.loads(r["json"]) for r in con.execute("select * from scheme_aliases")}

    strings: dict[str, dict[str, str]] = {}
    for r in con.execute("select key, lang, text from strings"):
        strings.setdefault(r["key"], {})[r["lang"]] = r["text"]

    config = {r["name"]: json.loads(r["json"]) for r in con.execute("select * from config")}

    adjacency: dict[str, list[str]] = {}
    for r in con.execute("select state, neighbour from state_adjacency"):
        adjacency.setdefault(r["state"], []).append(r["neighbour"])

    meta = {r["key"]: r["value"] for r in con.execute("select key, value from meta")}
    con.close()

    # Partners indexed the two ways the router asks for them.
    by_state: dict[str, list[dict]] = {}
    national: list[dict] = []
    for p in partners.values():
        if p["state"]:
            by_state.setdefault(p["state"], []).append(p)
        if p["coverage"] == "national":
            national.append(p)

    return {
        "schemes": schemes,
        "partners": partners,
        "partners_by_state": by_state,
        "partners_national": national,
        "utilisation": util,
        "courses": courses,
        "aliases": aliases,
        "strings": strings,
        "config": config,
        "adjacency": adjacency,
        "meta": meta,
    }


def schemes() -> dict[str, dict]:
    return _db()["schemes"]


def scheme(scheme_id: str) -> dict:
    return _db()["schemes"][scheme_id]


def partners() -> dict[str, dict]:
    return _db()["partners"]


def partner(partner_id: str) -> dict:
    return _db()["partners"][partner_id]


def partners_in_state(state: str) -> list[dict]:
    return _db()["partners_by_state"].get(state, [])


def partners_national() -> list[dict]:
    return _db()["partners_national"]


def utilisation(state: str) -> dict | None:
    return _db()["utilisation"].get(state)


def courses() -> dict[str, dict]:
    return _db()["courses"]


def adjacency(state: str) -> list[str]:
    return _db()["adjacency"].get(state, [])


def router_weights() -> dict:
    return _db()["config"]["router_weights"]


def serves_schemes_config() -> dict:
    return _db()["config"]["serves_schemes"]


def text(key: str, lang: str = "en", **fmt) -> str:
    """A user-facing string. Missing keys surface as ``!key!`` rather than
    raising -- a blank label on stage is worse than a visible one, and
    ENGINE_SPEC §8's build-time check is what catches these properly."""
    entry = _db()["strings"].get(key)
    if not entry:
        return f"!{key}!"
    s = entry.get(lang) or entry.get("en") or f"!{key}!"
    if fmt:
        try:
            return s.format(**fmt)
        except (KeyError, IndexError):
            return s
    return s


def engine_version() -> str:
    return _db()["meta"].get("engine_version", "unknown")
