"use strict";
/**
 * Python-compatible primitives.
 *
 * The Node engine is a port of `backend/engine/`, and the parity standard is
 * byte-identical output, not "close enough". Three of Python's defaults differ
 * from JavaScript's in ways that show up as a wrong rupee figure on screen:
 *
 *   1. `round()` breaks ties to even. `Math.round` breaks them upward, so
 *      Python's round(0.125, 2) is 0.12 and JavaScript's is 0.13. Instalment
 *      schedules round twice per period, so this is not theoretical.
 *   2. `f"{x:.1f}"` also breaks ties to even; `toFixed` does not.
 *   3. `str(True)` is "True", not "true". `rules_fired[].value_seen` is a
 *      string field in the contract and the tests compare it literally.
 *
 * Nothing here decides anything. It formats and rounds.
 */

/** Increment a non-negative decimal digit string by one. "199" -> "200". */
function bumpDigits(digits) {
  const out = digits.split("");
  let i = out.length - 1;
  while (i >= 0) {
    if (out[i] === "9") {
      out[i] = "0";
      i -= 1;
    } else {
      out[i] = String(Number(out[i]) + 1);
      return out.join("");
    }
  }
  return "1" + out.join("");
}

/**
 * Round `x` to `nd` decimals the way Python does, returning the digit string.
 *
 * Decided on the decimal expansion rather than by scaling: multiplying by
 * 10**nd introduces its own error, which is exactly the error we are here to
 * avoid. A tie can only exist when the expansion terminates at nd+1 digits, so
 * reading a generous number of extra digits is enough to tell a true tie from a
 * value that merely looks like one.
 */
function roundToString(x, nd) {
  const negative = x < 0 || Object.is(x, -0);
  const digits = Math.min(Math.max(nd, 0) + 40, 100);
  const expansion = Math.abs(x).toFixed(digits);
  const dot = expansion.indexOf(".");
  const intPart = expansion.slice(0, dot);
  const frac = expansion.slice(dot + 1);

  const kept = frac.slice(0, nd);
  const rest = frac.slice(nd);

  let roundUp = false;
  if (rest.length > 0) {
    const first = rest[0];
    if (first > "5") {
      roundUp = true;
    } else if (first === "5") {
      if (/[1-9]/.test(rest.slice(1))) {
        roundUp = true;                       // past the halfway point
      } else {
        const lastKept = kept.length ? kept[kept.length - 1] : intPart[intPart.length - 1];
        roundUp = Number(lastKept) % 2 === 1; // exact tie: to even
      }
    }
  }

  let body = intPart + kept;
  if (roundUp) body = bumpDigits(body);
  // bumpDigits may have grown the integer part by a digit; split from the right.
  const newFrac = nd > 0 ? body.slice(body.length - nd) : "";
  const newInt = nd > 0 ? body.slice(0, body.length - nd) : body;
  const text = (newInt === "" ? "0" : newInt) + (nd > 0 ? "." + newFrac : "");
  return (negative && /[1-9]/.test(body) ? "-" : "") + text;
}

/** Python's `round(x)` / `round(x, nd)`. */
function pyRound(x, nd = 0) {
  if (!Number.isFinite(x)) return x;
  if (nd <= 0 && Number.isInteger(x)) return x;
  return Number(roundToString(x, Math.max(nd, 0)));
}

/** Python's `f"{x:.<nd>f}"`. */
function pyFixed(x, nd) {
  if (!Number.isFinite(x)) return String(x);
  return roundToString(x, nd);
}

/**
 * Python's `f"{x:g}"` -- six significant digits, trailing zeros stripped.
 * 6.5 -> "6.5", 8.0 -> "8", 43.8 -> "43.8".
 */
function pyG(x) {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(x)));
  if (exponent < -4 || exponent >= 6) {
    // Out of range for every figure this engine holds, but silence here would
    // be a wrong number rather than a visible one.
    return Number(x.toPrecision(6)).toExponential().replace("e", "e+").replace("e+-", "e-");
  }
  let s = pyFixed(x, Math.max(0, 5 - exponent));
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/**
 * Python's `str()` for the scalars that reach `rules_fired[].value_seen`.
 *
 * JSON does not distinguish 120000 from 120000.0, so an integral number is
 * rendered as an integer -- which is what every profile field in the contract
 * actually is.
 */
function pyStr(v) {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v > 0 ? "inf" : Number.isNaN(v) ? "nan" : "-inf";
    return Number.isInteger(v) ? String(v) : String(v);
  }
  return String(v);
}

/**
 * Python's `str.format(**fmt)` as `data.text` uses it: no placeholders are
 * filled when there is nothing to fill with, and one missing key leaves the
 * whole string untouched (the exception aborts the substitution, it does not
 * skip one field).
 */
function pyFormat(s, fmt) {
  if (!fmt) return s;
  const keys = Object.keys(fmt);
  if (keys.length === 0) return s;
  let missing = false;
  const out = s.replace(/\{([^{}]*)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(fmt, key)) return String(fmt[key]);
    missing = true;
    return match;
  });
  return missing ? s : out;
}

/** Python's `statistics.median`. */
function median(values) {
  const xs = [...values].sort((a, b) => a - b);
  const n = xs.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

module.exports = { pyRound, pyFixed, pyG, pyStr, pyFormat, median };
