"use strict";
/**
 * Every CostSchedule the Python baseline produced, recomputed in Node.
 *
 * 90 cases: each scheme at each channel_rate_key it prices, at four amounts,
 * plus the sector moratorium overrides, both repayment frequencies, both
 * moratorium-interest treatments, and ELS before and after repayment started.
 * A single rupee of drift in any instalment fails this.
 */

const test = require("node:test");
const assert = require("node:assert");

const cost = require("../services/engine/cost");
const { golden, diff, jsonRoundTrip } = require("./parity");

const CASES = golden("cost");

test("cost: every golden schedule reproduces exactly", () => {
  assert.ok(CASES.length >= 40, `expected a broad fixture, found ${CASES.length} cases`);
  for (const row of CASES) {
    const { scheme_id: schemeId, amount_inr: amount, channel_rate_key: key } = row.in;
    const opts = {
      frequency: row.in.frequency ?? null,
      sector: row.in.sector ?? null,
      course: row.in.course ?? null,
      mode: row.in.mode ?? null,
    };
    const label = `${schemeId}/${key}/${amount}`
      + `${opts.frequency ? `/${opts.frequency}` : ""}`
      + `${opts.sector ? `/${opts.sector}` : ""}`
      + `${opts.mode ? `/${opts.mode}` : ""}`;

    if (row.error) {
      assert.throws(() => cost.compute(schemeId, amount, key, opts),
        `${label}: Python refused this ("${row.error}"), Node accepted it`);
      continue;
    }
    const actual = jsonRoundTrip(cost.compute(schemeId, amount, key, opts));
    const d = diff(actual, row.out);
    assert.equal(d, null, `${label}: ${d}`);
  }
});

test("cost: an unknown moratorium mode is refused, not silently repriced", () => {
  assert.throws(() => cost.checkMode("whatever"), /not one of/);
});

test("cost: a channel that does not price a scheme is refused", () => {
  assert.throws(() => cost.compute("TL", 300000, "COOP", {}), /is not offered at/);
});
