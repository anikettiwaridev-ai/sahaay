"use strict";
/**
 * Reason, unblock and warning keys -> the strings in the compiled `strings`
 * table. Port of `backend/engine/explain.py`.
 *
 * Nothing user-facing is written here; this module only chooses a key and fills
 * its placeholders, so the wording lives in one place and in two languages.
 */

const data = require("./data");
const { pyFixed, pyG, pyRound } = require("./py");

/**
 * Indian digit grouping: 1,40,001 rather than 140,001.
 *
 * Worth doing properly. An applicant reading "Rs 140,001" has to stop and count
 * digits; "Rs 1,40,001" they read at a glance, and this product's entire
 * premise is that the numbers land the first time.
 */
function rupees(n) {
  if (n === null || n === undefined) return "—";
  const rounded = pyRound(n);
  const sign = rounded < 0 ? "-" : "";
  const s = String(Math.abs(rounded));
  if (s.length <= 3) return `${sign}₹${s}`;
  let head = s.slice(0, -3);
  const tail = s.slice(-3);
  const parts = [];
  while (head.length > 2) {
    parts.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head) parts.unshift(head);
  return `${sign}₹${parts.join(",")},${tail}`;
}

function years(months) {
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : pyFixed(y, 1);
}

const reason = (reasonId, lang, fmt) => data.text(`reason.${reasonId}`, lang, fmt);
const unblock = (unblockId, lang, fmt) => data.text(`unblock.${unblockId}`, lang, fmt);
const bandText = (band, lang) => data.text(`band.${band}`, lang);
const bandLabel = (band, lang) => data.text(`band_label.${band}`, lang);
const geocodeNote = (method, lang) => data.text(`geocode.${method}`, lang);

function whyDistance(km, lang) {
  if (km === null || km === undefined) return data.text("why.distance_unknown", lang);
  return data.text("why.distance", lang, { value: pyFixed(km, 1) });
}

const whyRate = (rate, lang) => data.text("why.rate", lang, { value: pyG(rate) });
const whyBandPenalty = (penalty, lang) =>
  data.text("why.band_penalty", lang, { value: pyG(penalty) });
const whyScore = (score, lang) => data.text("why.score", lang, { value: pyFixed(score, 1) });

function bandWarning(pct, alternative, lang) {
  if (alternative) {
    return data.text("warning.band_warning", lang, { pct: pyG(pct), alternative });
  }
  return data.text("warning.band_warning_no_alt", lang, { pct: pyG(pct) });
}

function noScaWarning(stateName, alternative, lang) {
  if (alternative) {
    return data.text("warning.no_sca_in_state", lang, { state: stateName, alternative });
  }
  return data.text("warning.no_sca_in_state_no_alt", lang, { state: stateName });
}

const wrongDoorHero = (amount, lang) =>
  data.text("wrong_door.hero", lang, { current: rupees(amount) });

module.exports = {
  rupees, years, reason, unblock, bandText, bandLabel, geocodeNote,
  whyDistance, whyRate, whyBandPenalty, whyScore,
  bandWarning, noScaWarning, wrongDoorHero,
};
