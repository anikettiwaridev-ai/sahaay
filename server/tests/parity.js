"use strict";
/**
 * Shared helpers for the parity suite.
 *
 * The standard for this migration was not "the Node route returns something
 * sensible", it was "the Node route returns what the Python baseline returned,
 * for the same input". Before the Python engine was retired, it was run over
 * every persona, scheme, channel and state, and its answers were saved into
 * `fixtures/*.golden.json`; everything in `*.parity.test.js` compares against
 * those files and nothing else.
 *
 * Key order is ignored (JSON objects are unordered and the two languages build
 * their payloads in different orders); array order is not, because ranking order
 * is the product.
 */

const fs = require("node:fs");
const path = require("node:path");

const FIXTURES = path.join(__dirname, "fixtures");

function golden(name) {
  const file = path.join(FIXTURES, `${name}.golden.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `${file} is missing. It was generated once from the retired Python `
      + `engine and is now the pinned parity standard -- it should not need `
      + `regenerating. If it must be, restore backend/engine/ and `
      + `backend/tests/personas.py from git history first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Deep comparison that reports the first differing path rather than dumping two
 * multi-megabyte objects at a reader who then has to find the one changed rupee.
 * Returns null when equal, otherwise a human-readable difference.
 */
function diff(actual, expected, at = "$") {
  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined
      ? null : `${at}: expected null, got ${JSON.stringify(actual)}`;
  }
  if (typeof expected === "number") {
    if (typeof actual !== "number") return `${at}: expected number ${expected}, got ${JSON.stringify(actual)}`;
    if (Object.is(actual, expected) || actual === expected) return null;
    return `${at}: expected ${expected}, got ${actual} (delta ${actual - expected})`;
  }
  if (typeof expected !== "object") {
    return actual === expected
      ? null : `${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${at}: expected an array of ${expected.length}`;
    if (actual.length !== expected.length) {
      return `${at}: expected ${expected.length} items, got ${actual.length}`;
    }
    for (let i = 0; i < expected.length; i += 1) {
      const d = diff(actual[i], expected[i], `${at}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
    return `${at}: expected an object, got ${JSON.stringify(actual)}`;
  }
  const missing = Object.keys(expected).filter((k) => !(k in actual));
  if (missing.length) return `${at}: missing key(s) ${missing.join(", ")}`;
  const extra = Object.keys(actual).filter((k) => !(k in expected));
  if (extra.length) return `${at}: unexpected key(s) ${extra.join(", ")}`;
  for (const key of Object.keys(expected)) {
    const d = diff(actual[key], expected[key], `${at}.${key}`);
    if (d) return d;
  }
  return null;
}

/** Strip the fields a JSON round-trip through Python would have dropped. */
function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { golden, diff, jsonRoundTrip, FIXTURES };
