"use strict";
/**
 * Read-only access to the compiled data layer. Port of `backend/engine/data.py`.
 *
 * Reads the same `data/sahidwar.sqlite` the Python engine reads, through
 * `node:sqlite` -- no dependency to install, and no second copy of the data to
 * drift. The compiled database is the artefact `scripts/build_db.py` produces
 * from the JSON sources; reading anything else here would be a second opinion
 * about what NSFDC published, which is precisely what this project refuses to
 * have.
 *
 * Loaded once and held in memory: a couple of megabytes, never changes at
 * runtime, and the 300 ms budget for recommend + cost + route does not survive
 * per-request disk reads.
 *
 * Nothing here decides anything. Decisions live in rules.js, cost.js, router.js.
 */

const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { pyFormat } = require("./py");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DB_PATH = process.env.SAHAAY_ENGINE_DB || path.join(ROOT, "data", "sahidwar.sqlite");

class DataMissing extends Error {}

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_PATH)) {
    throw new DataMissing(`${DB_PATH} not found. Build it first: python scripts/build_db.py`);
  }
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const all = (sql) => db.prepare(sql).all();

  const schemes = {};
  for (const row of all("select * from schemes")) schemes[row.id] = JSON.parse(row.json);

  const partners = {};
  for (const row of all("select * from partners")) partners[row.id] = JSON.parse(row.json);

  const utilisation = {};
  for (const row of all("select * from state_utilisation")) {
    utilisation[row.state] = { ...row, has_sca: Boolean(row.has_sca) };
  }

  const courses = {};
  for (const row of all("select * from courses_els")) courses[row.id] = JSON.parse(row.json);

  const aliases = {};
  for (const row of all("select * from scheme_aliases")) aliases[row.alias] = JSON.parse(row.json);

  const strings = {};
  for (const row of all("select key, lang, text from strings")) {
    (strings[row.key] ||= {})[row.lang] = row.text;
  }

  const config = {};
  for (const row of all("select * from config")) config[row.name] = JSON.parse(row.json);

  const adjacency = {};
  for (const row of all("select state, neighbour from state_adjacency")) {
    (adjacency[row.state] ||= []).push(row.neighbour);
  }

  const meta = {};
  for (const row of all("select key, value from meta")) meta[row.key] = row.value;

  db.close();

  // Partners indexed the two ways the router asks for them.
  const partnersByState = {};
  const partnersNational = [];
  for (const p of Object.values(partners)) {
    if (p.state) (partnersByState[p.state] ||= []).push(p);
    if (p.coverage === "national") partnersNational.push(p);
  }

  cache = {
    schemes, partners, partnersByState, partnersNational,
    utilisation, courses, aliases, strings, config, adjacency, meta,
  };
  return cache;
}

const schemes = () => load().schemes;
const scheme = (id) => load().schemes[id];
const partners = () => load().partners;
const partner = (id) => load().partners[id];
const partnersInState = (state) => load().partnersByState[state] || [];
const partnersNational = () => load().partnersNational;
const utilisation = (state) => load().utilisation[state] ?? null;
const utilisationStates = () => Object.keys(load().utilisation);
const courses = () => load().courses;
const adjacency = (state) => load().adjacency[state] || [];
const routerWeights = () => load().config.router_weights;
const servesSchemesConfig = () => load().config.serves_schemes;
const engineVersion = () => load().meta.engine_version || "unknown";

/**
 * A user-facing string. A missing key surfaces as `!key!` rather than throwing:
 * a blank label on stage is worse than a visible one.
 */
function text(key, lang = "en", fmt = null) {
  const entry = load().strings[key];
  if (!entry) return `!${key}!`;
  const s = entry[lang] || entry.en || `!${key}!`;
  return pyFormat(s, fmt);
}

module.exports = {
  DataMissing, DB_PATH,
  schemes, scheme, partners, partner, partnersInState, partnersNational,
  utilisation, utilisationStates, courses, adjacency,
  routerWeights, servesSchemesConfig, text, engineVersion,
};
