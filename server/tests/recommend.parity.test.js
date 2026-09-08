"use strict";
/**
 * The twelve personas, end to end, against the Python baseline.
 *
 * This is the parity test that matters most: it exercises the rule table, the
 * collapse rule, ranking, the near-miss wording in both languages, the routes
 * behind each recommendation and `wrong_door_cost` -- the number the pitch leads
 * with. `rules_fired` is compared too, so a rule that silently stopped firing
 * cannot pass by producing the same verdict for a different reason.
 */

const test = require("node:test");
const assert = require("node:assert");

const recommend = require("../services/engine/recommend");
const { golden, diff, jsonRoundTrip } = require("./parity");
const { PERSONAS } = require("./personas");

const GOLDEN = golden("recommend");

test("recommend: all twelve personas reproduce the baseline exactly", () => {
  const ids = Object.keys(PERSONAS);
  assert.equal(ids.length, 12, `expected twelve personas, found ${ids.length}`);

  for (const pid of ids) {
    const profile = PERSONAS[pid];
    const expected = GOLDEN[pid];
    assert.ok(expected, `no golden output for persona ${pid}`);

    if (!expected.ok) {
      assert.throws(
        () => recommend.recommend(profile, profile.lang || "hi"),
        (err) => {
          assert.ok(err instanceof recommend.ProfileUnconfirmed,
            `persona ${pid}: expected ProfileUnconfirmed, got ${err}`);
          assert.deepEqual(err.fields, expected.needs_confirmation,
            `persona ${pid}: wrong needs_confirmation`);
          return true;
        },
        `persona ${pid}: Python refused this profile, Node answered it`);
      continue;
    }

    const actual = jsonRoundTrip(recommend.recommend(profile, profile.lang || "hi"));
    const d = diff(actual, expected.result);
    assert.equal(d, null, `persona ${pid}: ${d}`);
  }
});

test("recommend: persona 1 keeps the wrong-door figure the pitch leads with", () => {
  const result = recommend.recommend(PERSONAS["1"], "hi");
  const expected = GOLDEN["1"].result;
  assert.equal(result.wrong_door_cost, expected.wrong_door_cost);
  assert.ok(result.wrong_door_cost > 0, "wrong_door_cost must be a real spread");
  assert.equal(result.best_door.partner_id, expected.best_door.partner_id);
  assert.equal(result.worst_door.partner_id, expected.worst_door.partner_id);
});

test("recommend: an unconfirmed profile is refused before any decision", () => {
  const profile = { ...PERSONAS["1"], needs_confirmation: ["amount_inr"] };
  assert.throws(() => recommend.recommend(profile), recommend.ProfileUnconfirmed);
});

test("recommend: never more than three ranked recommendations", () => {
  for (const pid of Object.keys(PERSONAS)) {
    if (!GOLDEN[pid].ok) continue;
    const result = recommend.recommend(PERSONAS[pid], "hi");
    const ranked = result.recommendations.filter((r) => r.verdict === "eligible");
    assert.ok(ranked.length <= 3, `persona ${pid} returned ${ranked.length} matches`);
  }
});
