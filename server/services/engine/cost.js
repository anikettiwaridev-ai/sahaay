"use strict";
/**
 * The cost module. Port of `backend/engine/cost.py`.
 *
 * Deterministic arithmetic over NSFDC's published parameters. Every figure here
 * is checkable against nsfdc.nic.in/scheme by anyone in the room, which is the
 * whole point of keeping the AI out of it.
 *
 * `wrong_door_cost` is deliberately **not** here. Only /recommend knows the
 * eligible set, so only /recommend can compute it. See recommend.js.
 */

const data = require("./data");
const { pyRound } = require("./py");

// ASSUMPTION, flag MORATORIUM_INTEREST. LOCKED to "capitalise": the golden
// values depend on it, and verifying the real treatment with NSFDC is an open
// item. The flag is read from the environment so a test can flip it without
// editing code, never so a builder can change the default quietly.
const DEFAULT_MORATORIUM_INTEREST = "capitalise";
const VALID_MORATORIUM_MODES = ["capitalise", "pay_as_you_go"];

/**
 * Validate loudly. An unrecognised mode must not fall through to
 * `mode === "capitalise"` being false, which would silently price the loan as
 * pay_as_you_go -- a wrong number delivered with total confidence, which is the
 * one failure this engine exists to avoid.
 */
function checkMode(mode) {
  if (!VALID_MORATORIUM_MODES.includes(mode)) {
    throw new RangeError(
      `MORATORIUM_INTEREST='${mode}' is not one of ${VALID_MORATORIUM_MODES.join(", ")}`);
  }
  return mode;
}

const moratoriumInterestMode = () =>
  checkMode(process.env.MORATORIUM_INTEREST || DEFAULT_MORATORIUM_INTEREST);

const PERIODS_PER_YEAR = { quarterly: 4, half_yearly: 2 };

/** Sector- and ELS-adjusted moratorium, in months. */
function resolveMoratorium(sch, sector, course) {
  if (sch.id === "ELS") {
    const c = course || {};
    if (c.repayment_started) return Number(sch.moratorium_months_if_repayment_started);
    // "course duration + 1 year". With no stated duration we cannot invent one,
    // so fall back to the repayment-started figure rather than guessing a course
    // length -- and the caller should have asked.
    const duration = c.duration_months;
    if (duration === null || duration === undefined) {
      return Number(sch.moratorium_months_if_repayment_started);
    }
    return Number(duration) + 12;
  }
  const overrides = sch.moratorium_sector_overrides || {};
  if (sector && Object.prototype.hasOwnProperty.call(overrides, sector)) {
    return Number(overrides[sector]);
  }
  return Number(sch.moratorium_months);
}

function resolveTenure(sch, course) {
  if (sch.id === "ELS" && (course || {}).repayment_started) {
    return Number(sch.tenure_total_months_if_repayment_started);
  }
  return Number(sch.tenure_total_months);
}

function resolveRate(sch, channelRateKey) {
  const rates = sch.beneficiary_rate_pct;
  if (!Object.prototype.hasOwnProperty.call(rates, channelRateKey)) {
    throw new RangeError(
      `${sch.id} is not offered at channel_rate_key='${channelRateKey}'; `
      + `it prices [${Object.keys(rates).sort().map((k) => `'${k}'`).join(", ")}]`);
  }
  return Number(rates[channelRateKey]);
}

/** Return a CostSchedule. Steps 1-8, in order. */
function compute(schemeId, amountInr, channelRateKey, opts = {}) {
  const { frequency = null, sector = null, course = null, mode: modeIn = null } = opts;
  const sch = data.scheme(schemeId);
  if (!sch) throw new RangeError(`no scheme ${schemeId}`);
  const mode = modeIn ? checkMode(modeIn) : moratoriumInterestMode();

  // 1. loan and own contribution
  const loan = Math.min(pyRound((amountInr * sch.loan_pct) / 100), sch.loan_cap);
  const own = amountInr - loan;

  // 2-3. moratorium and repayment window
  const morM = resolveMoratorium(sch, sector, course);
  const tenureM = resolveTenure(sch, course);
  const repayM = tenureM - morM;
  if (repayM <= 0) {
    throw new RangeError(
      `${schemeId}: moratorium ${morM}m leaves no repayment window in ${tenureM}m`);
  }

  // 4. periods per year
  const freq = frequency || sch.frequency_default;
  if (!sch.frequency_allowed.includes(freq)) {
    throw new RangeError(
      `${schemeId} does not allow ${freq}; allows ${JSON.stringify(sch.frequency_allowed)}`);
  }
  const ppy = PERIODS_PER_YEAR[freq];

  // 5. instalment count. UNY half-yearly gives 57 months -> 9.5 periods, so this
  // rounds up and the final instalment clears the balance exactly.
  const n = Math.ceil((repayM * ppy) / 12);

  // 6. moratorium interest -- simple, on the loan, for the moratorium months.
  const rate = resolveRate(sch, channelRateKey);
  // Grouped exactly as the Python is (`loan * rate / 100 * mor_m / 12`).
  // Re-associating floating-point multiplication changes the last digits, and
  // the last digits are what the parity fixtures compare.
  const morInterest = ((loan * rate) / 100 * morM) / 12;
  const principal = mode === "capitalise" ? loan + morInterest : loan;

  // 7. instalment
  const rP = rate / 100 / ppy;
  let instalment;
  if (rP === 0) {
    instalment = principal / n;
  } else {
    const growth = (1 + rP) ** n;
    instalment = (principal * rP * growth) / (growth - 1);
  }
  instalment = pyRound(instalment, 2);

  // 8. amortise, adjusting the final instalment to clear the balance exactly.
  const schedule = [];
  let balance = principal;
  let paid = 0.0;
  const periodMonths = Math.floor(12 / ppy);
  for (let i = 1; i <= n; i += 1) {
    const interest = pyRound(balance * rP, 2);
    let principalPart;
    let total;
    if (i === n) {
      principalPart = pyRound(balance, 2);
      total = pyRound(principalPart + interest, 2);
    } else {
      total = instalment;
      principalPart = pyRound(total - interest, 2);
    }
    balance = pyRound(balance - principalPart, 2);
    paid += total;
    schedule.push({
      n: i,
      due_month: morM + i * periodMonths,
      principal: principalPart,
      interest,
      total,
      balance: Math.max(balance, 0.0),
    });
  }

  // Under pay_as_you_go the moratorium interest is paid during the moratorium.
  // It is still interest the applicant bears, so it belongs in total_interest;
  // otherwise the two flag settings are not comparable and the flag looks like a
  // free lunch. Under capitalise it is already inside `principal`.
  const totalRepaymentF = paid + (mode === "pay_as_you_go" ? morInterest : 0.0);
  const totalInterest = pyRound(totalRepaymentF - loan);
  const totalRepayment = loan + totalInterest;   // exact, by construction

  return {
    scheme_id: schemeId,
    channel_rate_key: channelRateKey,
    loan: Math.trunc(loan),
    own: Math.trunc(own),
    rate_annual: rate,
    frequency: freq,
    n_instalments: n,
    instalment,
    moratorium_months: morM,
    moratorium_interest: pyRound(morInterest, 2),
    total_interest: totalInterest,
    total_repayment: totalRepayment,
    monthly_equivalent: pyRound(instalment / periodMonths, 2),
    moratorium_interest_treatment: mode,
    tenure_total_months: tenureM,
    repayment_months: repayM,
    schedule,
  };
}

module.exports = {
  DEFAULT_MORATORIUM_INTEREST, VALID_MORATORIUM_MODES, PERIODS_PER_YEAR,
  checkMode, moratoriumInterestMode, resolveMoratorium, resolveTenure, resolveRate, compute,
};
