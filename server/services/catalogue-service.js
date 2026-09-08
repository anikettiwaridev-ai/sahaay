"use strict";
/**
 * The fourteen-entry catalogue. Port of `backend/portal/catalogue.py`.
 *
 * `data/catalogue.json` holds the prose and nothing else. This module joins it
 * to the figures in `data/schemes.json` (via figures.js) and to the legacy names
 * in `data/scheme_aliases.json`, and hands out entries in the exact shape the
 * contract fixes.
 *
 * Built once and cached: it is fourteen rows and it never changes at runtime.
 * Every figure is resolved here, so nothing downstream -- not the API, not the
 * assistant -- ever has to know a rate.
 */

const fs = require("node:fs");
const path = require("node:path");
const figures = require("./figures");

const ROOT = path.resolve(__dirname, "..", "..");
const CATALOGUE_JSON = path.join(ROOT, "data", "catalogue.json");

// Anything outside these lists is a data bug, and build() says so.
const CATEGORIES = new Set(["loan", "education", "subsidy", "training", "marketing"]);
const STATUSES = new Set(["open", "informational", "closed"]);
const LANGS = ["en", "hi"];

class CatalogueError extends Error {}

/** A list of sentences, or `@block` naming a shared one. */
function resolveList(raw, shared, lang, values, where) {
  let lines = raw;
  if (typeof raw === "string") {
    if (!raw.startsWith("@")) throw new CatalogueError(`${where}: expected a list or an @block`);
    const block = shared[raw.slice(1)];
    if (block === undefined) throw new CatalogueError(`${where}: no shared block ${raw}`);
    lines = block[lang];
  }
  return lines.map((line) => figures.resolve(line, values, where));
}

/**
 * Fill name_en/name_hi from whichever file already holds the name.
 *
 * Three sources, in order of authority: data/schemes.json for the five the
 * engine decides, data/scheme_aliases.json for the four closed ones, and
 * catalogue.json itself only for the five that appear nowhere else.
 */
function fillNames(entry, row) {
  if (entry.figures_from) {
    const s = figures.schemes()[entry.id];
    row.name_en = s.name_en;
    row.name_hi = s.name_hi;
  } else if (entry.name_from) {
    const a = figures.aliases()[entry.alias];
    row.name_en = a.name_en;
    row.name_hi = a.name_hi || entry.name_hi || a.name_en;
  } else {
    row.name_en = entry.name_en;
    row.name_hi = entry.name_hi;
  }
}

let built = null;

function build() {
  if (built) return built;
  const raw = JSON.parse(fs.readFileSync(CATALOGUE_JSON, "utf8"));
  const shared = raw.shared;
  const out = {};

  for (const entry of raw.schemes) {
    const sid = entry.id;
    const where = `catalogue.json[${sid}]`;
    if (!CATEGORIES.has(entry.category)) {
      throw new CatalogueError(
        `${where}: category '${entry.category}' is not one of ${[...CATEGORIES].sort().join(", ")}`);
    }
    if (!STATUSES.has(entry.status)) {
      throw new CatalogueError(
        `${where}: status '${entry.status}' is not one of ${[...STATUSES].sort().join(", ")}`);
    }

    const hasLogic = Boolean(entry.figures_from);
    const row = {
      id: sid,
      category: entry.category,
      status: entry.status,
      has_full_logic: hasLogic,
    };
    fillNames(entry, row);

    if (hasLogic) {
      const s = figures.schemes()[sid];
      row.rate_text = figures.rateSpan(Object.values(s.beneficiary_rate_pct));
      row.max_amount_inr = s.loan_cap;
    } else {
      // No verified figures exist for these nine. A number here would be one we
      // invented, and the contract would rather show none.
      row.rate_text = null;
      row.max_amount_inr = null;
    }

    for (const lang of LANGS) {
      const values = { ...figures.globalValues(lang) };
      if (hasLogic) Object.assign(values, figures.schemeValues(sid, lang));
      row[`one_line_${lang}`] = figures.resolve(
        entry[`one_line_${lang}`], values, `${where}.one_line_${lang}`);
      for (const field of ["eligibility_text", "documents", "how_to_apply"]) {
        row[`${field}_${lang}`] = resolveList(
          entry[`${field}_${lang}`], shared, lang, values, `${where}.${field}_${lang}`);
      }
    }
    out[sid] = row;
  }

  const n = Object.keys(out).length;
  if (n !== 14) throw new CatalogueError(`expected 14 entries, found ${n}`);
  const withLogic = Object.values(out).filter((r) => r.has_full_logic).length;
  if (withLogic !== 5) throw new CatalogueError("expected exactly 5 entries with full logic");

  built = out;
  return built;
}

const CARD_FIELDS = ["id", "name_en", "name_hi", "category", "status",
  "one_line_en", "one_line_hi", "has_full_logic", "rate_text", "max_amount_inr"];

/** The browse list -- exactly the ten contract fields, in contract order. */
function cards() {
  return Object.values(build()).map((row) => {
    const card = {};
    for (const k of CARD_FIELDS) card[k] = row[k];
    return card;
  });
}

/**
 * One entry, plus the three lists the contract names on GET /catalogue/:id.
 *
 * Both languages always ride along so the page can switch without a refetch;
 * `eligibility_text` / `documents` / `how_to_apply` are the requested language,
 * which is what the contract's field names refer to.
 */
function detail(schemeId, langIn = "en") {
  const row = build()[schemeId];
  if (row === undefined) return null;
  const lang = LANGS.includes(langIn) ? langIn : "en";
  const out = { ...row };
  for (const field of ["eligibility_text", "documents", "how_to_apply"]) {
    out[field] = row[`${field}_${lang}`];
  }

  // The scheme page's fact strip shows repayment period and moratorium beside
  // the rate and the ceiling. The contract's entry shape has no field for
  // either, so they are added here rather than on the card. Same rule as every
  // other figure in this file: read out of data/schemes.json through figures.js,
  // never typed. `null` for the nine entries we hold prose but no terms for --
  // the page prints a dash, which is the honest answer.
  const known = Object.prototype.hasOwnProperty.call(figures.schemes(), schemeId);
  for (const lg of LANGS) {
    const values = known ? figures.schemeValues(schemeId, lg) : {};
    out[`tenure_text_${lg}`] = values.tenure ?? null;
    out[`moratorium_text_${lg}`] = values.moratorium ?? null;
  }
  out.tenure_text = out[`tenure_text_${lang}`];
  out.moratorium_text = out[`moratorium_text_${lang}`];

  out.lang = lang;
  return out;
}

const ids = () => Object.keys(build());
const get = (schemeId) => build()[schemeId] ?? null;

module.exports = { CatalogueError, CARD_FIELDS, LANGS, cards, detail, ids, get };
