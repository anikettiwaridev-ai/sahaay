"use strict";
/**
 * The router. Port of `backend/engine/router.py`.
 *
 * Ranks the doors an applicant can actually walk through, by distance *and* by
 * whether the channel is functioning, and prices each one. Weights live in
 * `data/router_weights.json` and are printed in the "why" panel, so the ranking
 * is arguable rather than mysterious.
 *
 * One scoring mechanism, and only one:
 *
 *     score = distance_km + rate_weight * (rate - best_rate_for_scheme) + band_penalty
 *
 * The band penalty applies **only to SCAs**. State utilisation measures the
 * state channel, which the SCA dominates; attributing a state's band to a
 * national bank would be an unsupported claim about that bank. There is no hard
 * demotion rule -- the penalty is the whole mechanism, and the cheaper door is
 * always shown with its warning so the applicant chooses.
 */

const cost = require("./cost");
const data = require("./data");
const explain = require("./explain");
const { pyRound, median } = require("./py");

const radians = (deg) => (deg * Math.PI) / 180;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dp = radians(lat2 - lat1);
  const dl = radians(lon2 - lon1);
  const h = Math.sin(dp / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dl / 2) ** 2;
  return pyRound(2 * R * Math.asin(Math.sqrt(h)), 1);
}

/**
 * Partners that serve this scheme and can be reached from this state.
 *
 * In-state partners always. Plus partners whose reach extends beyond their
 * listed office -- see `unknown_distance.applies_to_types` in
 * data/router_weights.json, which is a config flag precisely because the spec's
 * wording ("a bank or RRB partner") is narrower than the data needs and
 * widening it is a decision, not an implementation detail.
 *
 * SCAs are never reachable from outside their own state: a state corporation
 * does not exist elsewhere.
 */
function candidates(schemeId, state) {
  const weights = data.routerWeights();
  const reachableTypes = new Set(
    weights.unknown_distance.applies_to_types || ["PSB", "RRB"]);

  const util = data.utilisation(state);
  const hasSca = util ? Boolean(util.has_sca) : true;

  const out = [];
  const seen = new Set();

  for (const p of data.partnersInState(state)) {
    if (!p.serves_schemes.includes(schemeId)) continue;
    if (p.type === "SCA" && !hasSca) continue;      // excluded, not demoted
    out.push(p);
    seen.add(p.id);
  }

  for (const p of Object.values(data.partners())) {
    if (seen.has(p.id) || p.state === state) continue;
    if (!p.serves_schemes.includes(schemeId)) continue;
    if (p.type === "SCA") continue;
    if (reachableTypes.has(p.type)) out.push(p);
  }

  return out;
}

/** `null` means excluded, not merely demoted (the spec's infinity). */
function bandPenalty(partner, util, weights) {
  const appliesTo = weights.band_penalty_applies_to_types || ["SCA"];
  if (!appliesTo.includes(partner.type)) return 0.0;
  if (!util) return 0.0;
  if (util.sca_status === "per_committee_non_performing") {
    return Number(weights.per_committee_non_performing_penalty);
  }
  const value = weights.band_penalty[util.band];
  return value === null || value === undefined ? null : Number(value);
}

function routesFor(schemeId, state, lat, lon, amountInr, opts = {}) {
  const {
    frequency = null, sector = null, course = null, lang = "hi", limit: limitIn = null,
  } = opts;

  const weights = data.routerWeights();
  const util = data.utilisation(state);
  const pool = candidates(schemeId, state);
  if (pool.length === 0) return [];

  const sch = data.scheme(schemeId);
  const rateWeight = Number(weights.rate_weight);
  const limit = limitIn || Number(weights.max_routes_per_scheme ?? 3);

  // Distances first, so the median is available for the unknown-distance rule.
  const known = new Map();
  for (const p of pool) {
    const inState = p.state === state;
    if (inState && lat !== null && lat !== undefined && lon !== null && lon !== undefined
        && p.lat !== null && p.lat !== undefined) {
      known.set(p.id, haversineKm(lat, lon, p.lat, p.lon));
    }
  }
  const medianKm = known.size ? median([...known.values()]) : 50.0;

  const rates = [];
  for (const p of pool) {
    try {
      rates.push(cost.resolveRate(sch, p.channel_rate_key));
    } catch {
      /* this partner does not price this scheme; it simply is not a door */
    }
  }
  if (rates.length === 0) return [];
  const bestRate = Math.min(...rates);

  const rows = [];
  for (const p of pool) {
    let rate;
    try {
      rate = cost.resolveRate(sch, p.channel_rate_key);
    } catch {
      continue;
    }

    const penalty = bandPenalty(p, util, weights);
    if (penalty === null) continue;                  // band "none" -> excluded entirely

    const distanceKm = known.has(p.id) ? known.get(p.id) : null;
    let distanceNote = null;
    let scoringDistance;
    if (distanceKm === null) {
      // Never silently placed at its head office.
      distanceNote = weights.unknown_distance[
        lang === "hi" ? "distance_note_hi" : "distance_note_en"];
      scoringDistance = medianKm;
    } else {
      scoringDistance = distanceKm;
    }

    const score = pyRound(
      scoringDistance * Number(weights.distance_km_weight ?? 1)
      + rateWeight * (rate - bestRate)
      + penalty, 2);

    const schedule = cost.compute(schemeId, amountInr, p.channel_rate_key,
      { frequency, sector, course });

    const why = [explain.whyDistance(distanceKm, lang), explain.whyRate(rate, lang)];
    if (penalty) why.push(explain.whyBandPenalty(penalty, lang));
    if (rate === bestRate) why.push(data.text("why.cheapest", lang));
    why.push(explain.whyScore(score, lang));
    why.push(explain.geocodeNote(p.geocode.method, lang));

    rows.push({
      partner: p,
      distance_km: distanceKm,
      distance_note: distanceNote,
      rate,
      cost_schedule: schedule,
      band: util && p.type === "SCA" ? util.band : null,
      score,
      warnings: [],
      why,
    });
  }

  rows.sort(byScoreThenId);
  const picked = select(rows, state, limit);

  // Warnings last, so "the alternative" can name a route we are actually
  // returning. Every warning carries its alternative in the same sentence.
  attachWarnings(picked, util, lang);
  return picked;
}

function byScoreThenId(a, b) {
  if (a.score !== b.score) return a.score - b.score;
  if (a.partner.id < b.partner.id) return -1;
  if (a.partner.id > b.partner.id) return 1;
  return 0;
}

/**
 * Choose which scored routes survive the three-slot limit.
 *
 * Scoring is untouched -- the formula and weights are LOCKED and the order below
 * is still score order. This decides *which rows get shown*, which the spec
 * leaves open beyond "up to three routes per scheme", and two things go wrong if
 * it is a plain truncation:
 *
 * 1. Eleven public-sector banks are indistinguishable at unknown distance. They
 *    all score median-distance plus zero penalty, so the top three becomes three
 *    arbitrary head offices sorted by id. An applicant needs three *different*
 *    doors, not the same door three times. So at most one unknown-distance
 *    partner takes a slot -- the best-scoring one.
 * 2. The applicant's own SCA can be pushed out entirely by those banks, because
 *    its band penalty is 60 (slow) or 200 (weak). That contradicts "the cheaper
 *    door is always shown, with its warning, and the applicant chooses", which
 *    requires both doors on screen. It also makes the band warning unemittable,
 *    and four personas state that warning as an expectation. So the in-state SCA
 *    always keeps a slot when it is a candidate at all.
 *
 * Neither rule reorders anything or touches a weight.
 */
function select(rows, state, limit) {
  const picked = [];
  let usedUnknown = false;

  const sca = rows.find((r) => r.partner.type === "SCA" && r.partner.state === state) || null;

  for (const r of rows) {
    if (picked.length >= limit) break;
    if (r === sca) continue;                      // placed explicitly below
    if (r.distance_km === null) {
      if (usedUnknown) continue;
      usedUnknown = true;
    }
    picked.push(r);
  }

  if (sca !== null && !picked.includes(sca)) {
    if (picked.length >= limit) picked.pop();     // drop the weakest to make room
    picked.push(sca);
  }

  picked.sort(byScoreThenId);
  return picked;
}

function attachWarnings(rows, util, lang) {
  if (rows.length === 0) return;
  const altRow = rows.find((r) => r.partner.type !== "SCA");
  const altPartner = altRow ? altRow.partner : null;

  for (const r of rows) {
    const p = r.partner;
    if (p.type !== "SCA" || !util) continue;
    // Widened to `slow`, because personas 1, 2 and 5 are all slow states and
    // all three expect a warning.
    if (["slow", "weak", "none"].includes(util.band)
        || util.sca_status === "per_committee_non_performing") {
      r.warnings.push({
        id: "band_warning",
        // Each language names the alternative in that language. Passing one
        // pre-chosen name into both produces an English sentence with a
        // Devanagari bank name inside it.
        text_en: explain.bandWarning(util.pct, altPartner ? altPartner.name_en : null, "en"),
        text_hi: explain.bandWarning(util.pct, altPartner ? altPartner.name_hi : null, "hi"),
        alternative_partner_id: altPartner ? altPartner.id : null,
      });
    }
  }
}

/**
 * Warnings about the state rather than a single route -- currently just
 * `no_sca_in_state` for Telangana and Ladakh.
 */
function stateWarnings(state, rowsByScheme, lang) {
  const util = data.utilisation(state);
  if (!util || util.has_sca) return [];

  let alt = null;
  for (const rows of Object.values(rowsByScheme)) {
    const row = rows.find((r) => r.partner.type !== "SCA");
    alt = row ? row.partner : null;
    if (alt) break;
  }

  return [{
    id: "no_sca_in_state",
    // Same rule as band_warning: name the alternative in the language of the
    // sentence it sits in, not in whichever language the caller asked for.
    text_en: explain.noScaWarning(util.state_name_en, alt ? alt.name_en : null, "en"),
    text_hi: explain.noScaWarning(
      util.state_name_hi || util.state_name_en, alt ? alt.name_hi : null, "hi"),
    alternative_partner_id: alt ? alt.id : null,
  }];
}

module.exports = {
  haversineKm, candidates, bandPenalty, routesFor, stateWarnings,
};
