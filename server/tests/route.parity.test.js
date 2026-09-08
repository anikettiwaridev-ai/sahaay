"use strict";
/**
 * Every routing answer the Python baseline produced, recomputed in Node.
 *
 * Covers each persona's state in both languages, plus the two states with no
 * SCA (Telangana, Ladakh). Compares the full row: which partners were selected,
 * in what order, at what distance and score, with which why-lines, which band
 * warning, and the priced schedule attached to each door.
 */

const test = require("node:test");
const assert = require("node:assert");

const router = require("../services/engine/router");
const { golden, diff, jsonRoundTrip } = require("./parity");

const CASES = golden("route");

test("route: every golden routing answer reproduces exactly", () => {
  assert.ok(CASES.length >= 10, `expected a broad fixture, found ${CASES.length} cases`);
  for (const row of CASES) {
    const q = row.in;
    const label = `persona ${q.persona ?? "-"} / ${q.state} / ${q.lang}`;

    const byScheme = {};
    const routes = [];
    for (const sid of q.scheme_ids) {
      const rows = router.routesFor(sid, q.state, q.lat, q.lon, q.amount_inr, {
        sector: q.sector, course: q.course, lang: q.lang,
      });
      byScheme[sid] = rows;
      routes.push(...rows);
    }
    const actual = jsonRoundTrip({
      routes,
      warnings: router.stateWarnings(q.state, byScheme, q.lang),
    });
    const d = diff(actual, row.out);
    assert.equal(d, null, `${label}: ${d}`);
  }
});

test("route: an SCA is never reachable from outside its own state", () => {
  const pool = router.candidates("MFS", "MP");
  for (const p of pool) {
    if (p.type === "SCA") assert.equal(p.state, "MP", `${p.id} is an out-of-state SCA`);
  }
});

test("route: haversine matches the baseline's rounding", () => {
  // Reference values taken from backend/engine/router.py, not recomputed by hand.
  assert.equal(router.haversineKm(23.2599, 77.4126, 23.25, 77.41), 1.1);
  assert.equal(router.haversineKm(23.2599, 77.4126, 25.5941, 85.1376), 823.9);
});
