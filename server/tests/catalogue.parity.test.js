"use strict";
/**
 * The catalogue, against the Python baseline.
 *
 * Two guardrails ride on this file. The catalogue contains **fourteen** entries
 * -- five open with full eligibility and cost logic, five informational, four
 * closed but intentionally discoverable -- and no entry may show a figure that
 * is not in `data/schemes.json`. Both are asserted here as well as compared.
 */

const test = require("node:test");
const assert = require("node:assert");

const catalogue = require("../services/catalogue-service");
const figures = require("../services/figures");
const engineData = require("../services/engine/data");
const { golden, diff, jsonRoundTrip } = require("./parity");

const GOLDEN = golden("catalogue");

test("catalogue: the browse cards reproduce the baseline exactly", () => {
  const d = diff(jsonRoundTrip(catalogue.cards()), GOLDEN.cards);
  assert.equal(d, null, String(d));
});

test("catalogue: every detail page reproduces the baseline in both languages", () => {
  for (const [key, expected] of Object.entries(GOLDEN.detail)) {
    const [sid, lang] = key.split(":");
    const d = diff(jsonRoundTrip(catalogue.detail(sid, lang)), expected);
    assert.equal(d, null, `${key}: ${d}`);
  }
});

test("catalogue: fourteen entries, five of them with full logic", () => {
  const cards = catalogue.cards();
  assert.equal(cards.length, 14, "the catalogue is fourteen entries, not five");
  assert.equal(cards.filter((c) => c.has_full_logic).length, 5);
  assert.equal(cards.filter((c) => c.status === "open").length, 5);
  assert.equal(cards.filter((c) => c.status === "informational").length, 5);
  assert.equal(cards.filter((c) => c.status === "closed").length, 4);
});

test("catalogue: an entry without verified figures shows none", () => {
  for (const card of catalogue.cards()) {
    if (card.has_full_logic) continue;
    assert.equal(card.rate_text, null, `${card.id} invented a rate`);
    assert.equal(card.max_amount_inr, null, `${card.id} invented a ceiling`);
  }
});

test("catalogue: an unknown id is absent, not guessed at", () => {
  assert.equal(catalogue.detail("NOT_A_SCHEME"), null);
});

test("figures: data/schemes.json agrees with the compiled engine database", () => {
  const fromJson = figures.schemes();
  const fromDb = engineData.schemes();
  assert.deepEqual(Object.keys(fromJson).sort(), Object.keys(fromDb).sort());
  for (const id of Object.keys(fromJson)) {
    const d = diff(fromJson[id], fromDb[id], `$.${id}`);
    assert.equal(d, null, `schemes.json and sahidwar.sqlite disagree: ${d}`);
  }
});
