"use strict";
/**
 * Every number the catalogue shows, derived from `data/schemes.json`.
 * Port of `backend/portal/figures.py`.
 *
 * The brief is blunt about it: *"The five with has_full_logic must use the exact
 * figures already in data/schemes.json -- do not retype a rate."*
 *
 * So this module is the only place in the portal layer allowed to know a figure,
 * and it does not know any either: it reads them. `data/catalogue.json` writes
 * `{rate}` and `{loan_cap}`; `resolve()` fills them in. A placeholder with no
 * value behind it throws at load time rather than rendering an empty string,
 * which is the point -- a missing rate must be a crash, not a blank.
 *
 * Nothing here decides anything. It formats.
 */

const fs = require("node:fs");
const path = require("node:path");
const { pyG, pyRound } = require("./engine/py");

const ROOT = path.resolve(__dirname, "..", "..");
const SCHEMES_JSON = path.join(ROOT, "data", "schemes.json");
const ALIASES_JSON = path.join(ROOT, "data", "scheme_aliases.json");

const PLACEHOLDER = /\{([a-z_]+)\}/g;

/** A placeholder in catalogue.json has no figure behind it. */
class FigureMissing extends Error {}

let schemesCache = null;
let commonCache = null;
let aliasCache = null;

function readSchemesFile() {
  if (!fs.existsSync(SCHEMES_JSON)) throw new FigureMissing(`${SCHEMES_JSON} not found`);
  return JSON.parse(fs.readFileSync(SCHEMES_JSON, "utf8"));
}

/**
 * `data/schemes.json` keyed by id. The engine reads the same file through its
 * compiled SQLite, and a parity test asserts the two agree, so the JSON cannot
 * drift away from what the rules actually use.
 */
function schemes() {
  if (!schemesCache) {
    schemesCache = {};
    for (const s of readSchemesFile().schemes) schemesCache[s.id] = s;
  }
  return schemesCache;
}

function commonEligibility() {
  if (!commonCache) commonCache = readSchemesFile()._meta.common_eligibility;
  return commonCache;
}

/**
 * `data/scheme_aliases.json` keyed by alias -- where the four closed schemes get
 * their names, so the catalogue does not hold a second copy.
 */
function aliases() {
  if (!aliasCache) {
    aliasCache = {};
    for (const a of JSON.parse(fs.readFileSync(ALIASES_JSON, "utf8")).aliases) {
      aliasCache[a.alias] = a;
    }
  }
  return aliasCache;
}

const LAKH = 100000;

/** 1234567 -> '12,34,567'. The last three digits, then pairs. */
function indianCommas(n) {
  const value = Math.trunc(n);
  const s = String(Math.abs(value));
  let body;
  if (s.length <= 3) {
    body = s;
  } else {
    let head = s.slice(0, -3);
    const tail = s.slice(-3);
    const groups = [];
    while (head.length > 2) {
      groups.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    if (head) groups.unshift(head);
    body = `${groups.join(",")},${tail}`;
  }
  return (value < 0 ? "-" : "") + body;
}

/**
 * Rupees, the way the number wants to be read.
 *
 * A round lakh is spoken as a lakh -- '1.25 lakh' is how the applicant and the
 * scheme page both say it. Anything that does not land on two decimal places of
 * a lakh keeps every digit, because 1,40,001 is a threshold and rounding it
 * would be a lie.
 */
function money(n, lang = "en") {
  const value = Math.trunc(n);
  if (value >= LAKH) {
    const lakhs = value / LAKH;
    const rounded = pyRound(lakhs, 2);
    if (Math.abs(rounded * LAKH - value) < 0.5) {
      return `₹${pyG(rounded)} ` + (lang === "hi" ? "लाख" : "lakh");
    }
  }
  return "₹" + indianCommas(value);
}

/** 6.5 -> '6.5%', 8.0 -> '8%'. */
const pct = (value) => `${pyG(value)}%`;

/**
 * One rate reads as itself; several read as the range the applicant is actually
 * choosing between (UNY is 13% at a cooperative, 15% at an SFB).
 */
function rateSpan(rates) {
  const uniq = [...new Set(rates)].sort((a, b) => a - b);
  if (uniq.length === 1) return pct(uniq[0]);
  return `${pct(uniq[0])}–${pct(uniq[uniq.length - 1])}`;
}

function months(n, lang = "en") {
  if (n % 12 === 0 && n >= 12) {
    const years = Math.floor(n / 12);
    if (lang === "hi") return `${years} वर्ष`;
    return years === 1 ? `${years} year` : `${years} years`;
  }
  if (lang === "hi") return `${n} महीने`;
  return `${n}-month`;
}

const FREQUENCY = {
  quarterly: { en: "quarterly", hi: "तिमाही" },
  half_yearly: { en: "half-yearly", hi: "अर्धवार्षिक" },
};

// Words, not figures: what a channel type is called in a sentence.
const CHANNEL = {
  SCA: { en: "State Channelizing Agency", hi: "राज्य चैनलाइज़िंग एजेंसी" },
  PSB: { en: "public sector bank", hi: "सार्वजनिक क्षेत्र के बैंक" },
  RRB: { en: "regional rural bank", hi: "क्षेत्रीय ग्रामीण बैंक" },
  NBFC_MFI: { en: "micro-finance company (NBFC-MFI)", hi: "माइक्रो-फाइनेंस कंपनी (NBFC-MFI)" },
  COOP_BANK: { en: "cooperative bank", hi: "सहकारी बैंक" },
  COOP_SOCIETY: { en: "cooperative society", hi: "सहकारी समिति" },
  SFB: { en: "small finance bank", hi: "स्मॉल फाइनेंस बैंक" },
  OTHER: { en: "listed agency", hi: "सूचीबद्ध एजेंसी" },
};

function join(parts, lang) {
  if (parts.length === 1) return parts[0];
  const tail = lang === "hi" ? " या " : " or ";
  return parts.slice(0, -1).join(", ") + tail + parts[parts.length - 1];
}

/** Every placeholder a scheme's own prose may use, already formatted. */
function schemeValues(schemeId, lang) {
  const s = schemes()[schemeId];
  const rates = Object.values(s.beneficiary_rate_pct);
  const v = {
    rate: rateSpan(rates),
    rate_min: pct(Math.min(...rates)),
    rate_max: pct(Math.max(...rates)),
    nsfdc_rate: pct(s.nsfdc_to_ca_rate_pct),
    loan_cap: money(s.loan_cap, lang),
    amount_min: s.amount_min ? money(s.amount_min, lang) : null,
    amount_max: money(s.amount_max, lang),
    loan_pct: String(s.loan_pct),
    frequency: FREQUENCY[s.frequency_default][lang],
    channels: join(s.channel_types.map((c) => CHANNEL[c][lang]), lang),
  };
  if (s.tenure_total_months) v.tenure = months(s.tenure_total_months, lang);
  if (s.moratorium_months) v.moratorium = months(s.moratorium_months, lang);

  const out = {};
  for (const [k, val] of Object.entries(v)) if (val !== null && val !== undefined) out[k] = val;
  return out;
}

/**
 * Placeholders any entry may use -- the criteria common to all five schemes, and
 * the two open schemes a closed entry points people towards.
 */
function globalValues(lang) {
  const ce = commonEligibility();
  const mfs = schemes().MFS;
  const tl = schemes().TL;
  return {
    income_max: money(ce.annual_family_income_inr_max, lang),
    mfs_rate: rateSpan(Object.values(mfs.beneficiary_rate_pct)),
    mfs_loan_cap: money(mfs.loan_cap, lang),
    tl_rate: rateSpan(Object.values(tl.beneficiary_rate_pct)),
    tl_amount_min: money(tl.amount_min, lang),
  };
}

/** Fill `{placeholders}`. An unknown one is a crash, by design. */
function resolve(text, values, where) {
  return String(text).replace(PLACEHOLDER, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new FigureMissing(
        `${where}: no figure for {${key}} in data/schemes.json. `
        + `Known: ${Object.keys(values).sort().join(", ")}`);
    }
    return values[key];
  });
}

module.exports = {
  FigureMissing, LAKH, FREQUENCY, CHANNEL,
  schemes, commonEligibility, aliases,
  indianCommas, money, pct, rateSpan, months,
  schemeValues, globalValues, resolve,
};
