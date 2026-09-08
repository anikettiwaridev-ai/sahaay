"use strict";
/**
 * Eligibility, verdicts and near-misses. Port of `backend/engine/rules.py`.
 *
 * The rule table is **data**, not control flow: a row per rule, evaluated in
 * order per surviving scheme. That is what makes `rules_fired` free and what
 * lets a judge argue with a rule rather than with the code.
 *
 * Ranking and `wrong_door_cost` are not here -- they need the router's
 * reachability answer, so they live in recommend.js.
 */

const data = require("./data");
const explain = require("./explain");
const { pyRound, pyStr, pyG } = require("./py");

const INCOME_CEILING = 500000;

const amountOf = (p) => (p.amount_inr === undefined ? null : p.amount_inr);
const courseOf = (p) => p.course || {};

/** In evaluation order. Editing this table is how the engine changes. */
const RULES = [
  {
    id: "R_SC", scope: "all",
    reasonId: "not_sc", unblockId: "out_of_scope_pointer_not_sc",
    terminal: true, soft: false,
    test: (p) => p.is_sc === true,
    seen: (p) => pyStr(p.is_sc ?? null),
    threshold: () => "True",
  },
  {
    id: "R_INCOME", scope: "all",
    reasonId: "income_above_ceiling", unblockId: "income_certificate_check",
    terminal: false, soft: false,
    test: (p) => (p.annual_family_income_inr || 0) <= INCOME_CEILING,
    seen: (p) => pyStr(p.annual_family_income_inr ?? null),
    threshold: () => String(INCOME_CEILING),
  },
  {
    id: "R_AMOUNT_MIN", scope: "enterprise",
    reasonId: "amount_below_min", unblockId: "raise_to_next_band",
    terminal: false, soft: false,
    test: (p, s) => (amountOf(p) || 0) >= s.amount_min,
    seen: (p) => pyStr(amountOf(p)),
    threshold: (p, s) => pyStr(s.amount_min),
  },
  {
    id: "R_AMOUNT_MAX", scope: "enterprise",
    reasonId: "amount_above_max", unblockId: "phase_project",
    terminal: false, soft: false,
    test: (p, s) => (amountOf(p) || 0) <= s.amount_max,
    seen: (p) => pyStr(amountOf(p)),
    threshold: (p, s) => pyStr(s.amount_max),
  },
  {
    id: "R_COURSE", scope: "ELS",
    reasonId: "course_not_covered", unblockId: "check_course_list",
    terminal: false, soft: false,
    test: (p) => {
      const c = courseOf(p);
      const category = c.category ?? null;
      return Object.prototype.hasOwnProperty.call(data.courses(), String(category))
        && c.is_full_time_recognised === true;
    },
    seen: (p) => pyStr(courseOf(p).category ?? null),
    threshold: () => "an approved full-time course",
  },
  {
    id: "R_DOCS", scope: "all",
    reasonId: "docs_missing", unblockId: "get_docs",
    terminal: false, soft: true,
    test: (p) => Boolean(p.has_caste_certificate) && Boolean(p.has_income_certificate),
    seen: (p) =>
      "caste=" + pyStr(p.has_caste_certificate ?? null)
      + ",income=" + pyStr(p.has_income_certificate ?? null),
    threshold: () => "both certificates",
  },
];

function applies(rule, scheme) {
  if (rule.scope === "all") return true;
  if (rule.scope === "enterprise" || rule.scope === "education") {
    return scheme.purpose === rule.scope;
  }
  return scheme.id === rule.scope;
}

/** Tie-break order. */
const SCHEME_TIEBREAK = ["MFS", "TL", "UNY", "AMY", "ELS"];

/**
 * Purpose is a filter, not a rule. Schemes of the wrong purpose are discarded
 * before anything runs: never eligible, never a near-miss, never ineligible.
 */
function survivingSchemes(profile) {
  const purpose = profile.purpose ?? null;
  const fired = [];
  const out = [];
  for (const sch of Object.values(data.schemes())) {
    const ok = sch.purpose === purpose;
    fired.push({
      scheme_id: sch.id, rule_id: "F_PURPOSE",
      result: ok ? "pass" : "fail",
      value_seen: pyStr(purpose), threshold: sch.purpose,
    });
    if (ok) out.push(sch);
  }
  out.sort((a, b) => SCHEME_TIEBREAK.indexOf(a.id) - SCHEME_TIEBREAK.indexOf(b.id));
  return { surviving: out, fired };
}

/** Run the table against one scheme. */
function evaluate(profile, scheme) {
  const hardFails = [];
  const softFails = [];
  const fired = [];
  for (const rule of RULES) {
    if (!applies(rule, scheme)) continue;
    const ok = rule.test(profile, scheme);
    fired.push({
      scheme_id: scheme.id, rule_id: rule.id,
      result: ok ? "pass" : "fail",
      value_seen: rule.seen(profile, scheme),
      threshold: rule.threshold(profile, scheme),
    });
    if (ok) continue;
    (rule.soft ? softFails : hardFails).push(rule);
  }

  let verdict;
  if (hardFails.length === 0) {
    verdict = "eligible";
  } else if (hardFails.length === 1 && !hardFails[0].terminal && hardFails[0].unblockId) {
    verdict = "near_miss";
  } else {
    verdict = "ineligible";
  }

  const nSoft = RULES.filter((r) => r.soft && applies(r, scheme)).length;
  const readiness = nSoft === 0 ? 1.0 : pyRound(1.0 - softFails.length / nSoft, 2);

  return {
    scheme, verdict,
    hard_fails: hardFails, soft_fails: softFails,
    readiness, rules_fired: fired,
  };
}

/** One sentence for the reason, one for the unblock. Both languages, always. */
function nearMissPayload(profile, scheme, rule) {
  // Each language must be formatted with the scheme's own name in that
  // language -- otherwise the Hindi sentence carries an English scheme name and
  // the translation is half done.
  const names = { en: scheme.name_en, hi: scheme.name_hi };

  const texts = (fn, keyId, fmt) =>
    ["en", "hi"].map((lg) => {
      const merged = { ...fmt };
      if (Object.prototype.hasOwnProperty.call(fmt, "scheme")) merged.scheme = names[lg];
      return fn(keyId, lg, merged);
    });

  let delta = null;
  let reasonFmt = {};
  let unblockFmt = {};

  if (rule.id === "R_AMOUNT_MIN") {
    const need = scheme.amount_min;
    const cur = amountOf(profile);
    delta = { field: "amount_inr", current: cur, needed: need };
    const rates = Object.values(scheme.beneficiary_rate_pct);
    reasonFmt = { scheme: names.en, threshold: explain.rupees(need), current: explain.rupees(cur) };
    unblockFmt = {
      scheme: names.en, threshold: explain.rupees(need),
      rate: pyG(Math.min(...rates)),
      years: explain.years(scheme.tenure_total_months),
    };
  } else if (rule.id === "R_AMOUNT_MAX") {
    const cap = scheme.amount_max;
    const cur = amountOf(profile);
    delta = { field: "amount_inr", current: cur, needed: cap };
    reasonFmt = { scheme: names.en, threshold: explain.rupees(cap), current: explain.rupees(cur) };
    unblockFmt = { scheme: names.en, threshold: explain.rupees(scheme.loan_cap) };
  } else if (rule.id === "R_INCOME") {
    const cur = profile.annual_family_income_inr ?? null;
    delta = { field: "annual_family_income_inr", current: cur, needed: INCOME_CEILING };
    reasonFmt = { threshold: explain.rupees(INCOME_CEILING), current: explain.rupees(cur) };
    unblockFmt = { threshold: explain.rupees(INCOME_CEILING) };
  } else if (rule.id === "R_COURSE") {
    reasonFmt = { scheme: names.en };
    // Name a real category rather than gesturing at "the list".
    const nearest = Object.values(data.courses())[0];
    unblockFmt = { category: nearest.name_en };
  }

  const [rEn, rHi] = texts(explain.reason, rule.reasonId, reasonFmt);
  const [uEn, uHi] = texts(explain.unblock, rule.unblockId, unblockFmt);
  return {
    scheme_id: scheme.id,
    blocking_rule: rule.id,
    reason_id: rule.reasonId,
    reason_text_en: rEn,
    reason_text_hi: rHi,
    unblock_id: rule.unblockId,
    unblock_text_en: uEn,
    unblock_text_hi: uHi,
    delta,
  };
}

/**
 * When the *same* rule fails for every surviving scheme, the answer is one
 * card, not N. Four identical near-miss cards is precisely the flood this
 * product exists to prevent.
 */
function collapseKey(results) {
  if (results.length === 0) return null;
  const firsts = [];
  for (const r of results) {
    if (r.hard_fails.length === 0) return null;
    firsts.push(r.hard_fails[0].id);
  }
  const unique = new Set(firsts);
  if (unique.size === 1 && (firsts[0] === "R_SC" || firsts[0] === "R_INCOME")) return firsts[0];
  return null;
}

module.exports = {
  INCOME_CEILING, RULES, SCHEME_TIEBREAK,
  applies, survivingSchemes, evaluate, nearMissPayload, collapseKey,
};
