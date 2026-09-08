"use strict";
/**
 * Ranking, near-misses and `wrong_door_cost`. Port of
 * `backend/engine/recommend.py`.
 *
 * This is the only place that sees the whole picture -- eligibility from
 * rules.js, prices from cost.js, reachability from router.js -- which is exactly
 * why `wrong_door_cost` is computed here and nowhere else.
 */

const data = require("./data");
const explain = require("./explain");
const router = require("./router");
const rules = require("./rules");
const { pyRound } = require("./py");

/** /recommend must answer 422 while needs_confirmation is non-empty. */
class ProfileUnconfirmed extends Error {
  constructor(fields) {
    super("profile is unconfirmed");
    this.name = "ProfileUnconfirmed";
    this.fields = fields;
  }
}

const REQUIRED = [
  ["is_sc", (p) => p.is_sc === null || p.is_sc === undefined],
  ["purpose", (p) => p.purpose === null || p.purpose === undefined],
  ["amount_inr", (p) => p.amount_inr === null || p.amount_inr === undefined],
  ["annual_family_income_inr",
    (p) => p.annual_family_income_inr === null || p.annual_family_income_inr === undefined],
  ["state", (p) => !p.state],
];

/**
 * Fields a rule needs and the profile does not have.
 *
 * Merged with whatever intake already put in `needs_confirmation`: the engine
 * refuses to run while either is non-empty, so a low-confidence value and an
 * absent one are gated the same way.
 */
function missingFields(profile) {
  const out = [...(profile.needs_confirmation || [])];
  for (const [field, absent] of REQUIRED) {
    if (absent(profile) && !out.includes(field)) out.push(field);
  }
  return out;
}

function door(schemeId, route) {
  const cs = route.cost_schedule;
  const p = route.partner;
  return {
    scheme_id: schemeId,
    partner_id: p.id,
    partner_name: p.name_en,
    rate: route.rate,
    tenure_total_months: cs.tenure_total_months,
    frequency: cs.frequency,
    total_interest: cs.total_interest,
    band: route.band,
  };
}

/**
 * One definition, in one place.
 *
 * Doors are **comparable** only when they share tenure and frequency. Comparing
 * a 3-year loan to a 5-year one attributes tenure to the channel, and a judge
 * catches that in one question.
 *
 *   best_door  = cheapest among comparable doors whose partner is functioning.
 *   worst_door = dearest among comparable doors, functioning or not -- it is a
 *                door the applicant could actually walk into.
 */
function wrongDoor(doors) {
  if (doors.length < 2) return { spread: null, best: null, worst: null };

  const groups = new Map();
  for (const d of doors) {
    const key = `${d.tenure_total_months}|${d.frequency}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }

  let best = null;
  let worst = null;
  let spread = -1;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const functioning = group.filter((d) => d.band !== "weak" && d.band !== "none");
    if (functioning.length === 0) continue;
    const b = minBy(functioning, (d) => d.total_interest);
    const w = maxBy(group, (d) => d.total_interest);
    const gap = w.total_interest - b.total_interest;
    if (gap > spread) {
      best = b;
      worst = w;
      spread = gap;
    }
  }

  if (best === null || worst === null || spread <= 0) {
    return { spread: null, best: null, worst: null };
  }
  return { spread, best, worst };
}

/** Python's `min`/`max` keep the first extreme they meet; so do these. */
function minBy(items, key) {
  let out = items[0];
  for (const item of items.slice(1)) if (key(item) < key(out)) out = item;
  return out;
}

function maxBy(items, key) {
  let out = items[0];
  for (const item of items.slice(1)) if (key(item) > key(out)) out = item;
  return out;
}

function recommend(profile, langIn = null) {
  const lang = langIn || profile.lang || "hi";

  const pending = missingFields(profile);
  if (pending.length) throw new ProfileUnconfirmed(pending);

  const state = profile.state;
  const amount = Math.trunc(profile.amount_inr);
  const loc = profile.location || {};
  const lat = loc.lat ?? null;
  const lon = loc.lon ?? null;
  const sector = profile.sector ?? null;
  const course = profile.course ?? null;

  const { surviving, fired } = rules.survivingSchemes(profile);
  const results = surviving.map((s) => rules.evaluate(profile, s));
  for (const r of results) fired.push(...r.rules_fired);

  // Collapse: one card, not N identical ones.
  const collapsed = rules.collapseKey(results);
  if (collapsed) {
    const rule = rules.RULES.find((r) => r.id === collapsed);
    const scheme = surviving[0];
    const nm = rules.nearMissPayload(profile, scheme, rule);
    if (collapsed === "R_SC") {
      nm.unblock_id = "out_of_scope_pointer_not_sc";
    } else if (collapsed === "R_INCOME") {
      // Persona 6 needs both the certificate check and the pointer.
      nm.unblock_text_en += " " + explain.unblock("out_of_scope_pointer_income", "en");
      nm.unblock_text_hi += " " + explain.unblock("out_of_scope_pointer_income", "hi");
    }
    return {
      recommendations: [],
      near_misses: [nm],
      wrong_door_cost: null,
      best_door: null,
      worst_door: null,
      collapsed: rule.reasonId,
      engine_version: data.engineVersion(),
      rules_fired: fired,
    };
  }

  const eligible = results.filter((r) => r.verdict === "eligible");
  const near = results.filter((r) => r.verdict === "near_miss");

  // Routes first: ranking key 1 is the lowest rate *reachable*, so reachability
  // has to be known before anything can be ordered.
  const routesByScheme = {};
  for (const r of eligible) {
    routesByScheme[r.scheme.id] = router.routesFor(
      r.scheme.id, state, lat, lon, amount,
      { frequency: profile.frequency ?? null, sector, course, lang });
  }

  const ranked = [];
  const noChannel = [];
  for (const r of eligible) {
    (routesByScheme[r.scheme.id].length ? ranked : noChannel).push(r);
  }

  const sortKey = (r) => {
    const sch = r.scheme;
    const bestRate = Math.min(...routesByScheme[sch.id].map((x) => x.rate));
    const coverage = Math.min(pyRound((amount * sch.loan_pct) / 100), sch.loan_cap);
    return [
      bestRate,                                     // 1 lowest reachable rate
      -coverage,                                    // 2 highest coverage
      -(sch.tenure_total_months || 0),              // 3 longest tenure
      -r.readiness,                                 // 4 higher readiness
      rules.SCHEME_TIEBREAK.indexOf(sch.id),        // tie-break
    ];
  };

  const keyed = ranked.map((r) => ({ r, key: sortKey(r) }));
  keyed.sort((a, b) => compareTuples(a.key, b.key));
  const rankedSorted = keyed.map((x) => x.r);

  const recommendations = [];
  const doors = [];
  // "One 'your match' and at most two 'also possible'. Never more than three."
  rankedSorted.slice(0, 3).forEach((r, index) => {
    const sid = r.scheme.id;
    const routes = routesByScheme[sid];
    for (const rt of routes) doors.push(door(sid, rt));
    recommendations.push({
      scheme: r.scheme,
      verdict: "eligible",
      rank: index + 1,
      readiness: r.readiness,
      reasons: [data.text("verdict.eligible", lang)],
      cost: routes[0].cost_schedule,
      routes,
    });
  });

  for (const r of noChannel) {
    const sid = r.scheme.id;
    const name = lang === "en" ? r.scheme.name_en : r.scheme.name_hi;
    recommendations.push({
      scheme: r.scheme,
      verdict: "eligible_no_channel",
      rank: recommendations.length + 1,
      readiness: r.readiness,
      reasons: [explain.reason("no_partner_in_state", lang, { scheme: name })],
      cost: null,
      routes: [],
      no_channel_reason: "no_partner_in_state",
      nearest_out_of_state_partner_id: nearestOutOfState(sid, state),
    });
  }

  const nearMisses = near.map((r) => rules.nearMissPayload(profile, r.scheme, r.hard_fails[0]));

  const { spread, best, worst } = wrongDoor(doors);

  return {
    recommendations,
    near_misses: nearMisses,
    wrong_door_cost: spread,
    best_door: best,
    worst_door: worst,
    collapsed: null,
    engine_version: data.engineVersion(),
    rules_fired: fired,
  };
}

/** Python tuple ordering: first differing element decides. */
function compareTuples(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Adjacency is used only for this fallback, never for primary routing. */
function nearestOutOfState(schemeId, state) {
  for (const neighbour of data.adjacency(state)) {
    for (const p of data.partnersInState(neighbour)) {
      if (p.serves_schemes.includes(schemeId) && p.type !== "SCA") return p.id;
    }
  }
  return null;
}

module.exports = {
  ProfileUnconfirmed, REQUIRED, missingFields, wrongDoor, recommend, nearestOutOfState,
};
