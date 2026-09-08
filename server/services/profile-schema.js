"use strict";
/**
 * The StructuredProfile shape, at the Express boundary.
 *
 * FastAPI validated every /recommend body against `backend/models.py` before the
 * engine saw it, and that validation was doing real work: it defaulted `course`
 * to an object, coerced the money fields to integers, dropped fields the engine
 * does not declare, and refused an out-of-vocabulary sector or purpose with a
 * 422. Express hands the route whatever JSON arrived, so without this module the
 * Node port would quietly accept `"amount_inr": "1,20,000"` and answer with a
 * confident wrong number -- the one failure the engine exists to avoid.
 *
 * This is not a validation framework. It is the same field list as
 * `models.py::StructuredProfile`, kept deliberately boring and readable, because
 * the person maintaining it needs to be able to compare it line by line with the
 * Python it replaces.
 */

const LANGS = ["hi", "en"];
const PURPOSES = ["enterprise", "education"];
const SECTORS = ["tailoring", "shop", "transport", "agri_allied", "services",
  "manufacturing", "plantation", "construction", "other"];
const EDUCATIONS = ["illiterate", "primary", "middle", "matric", "higher_secondary",
  "graduate"];
const COURSE_LEVELS = ["diploma", "bachelors", "masters", "doctoral", "professional"];
const FREQUENCIES = ["quarterly", "half_yearly"];
const LOCATION_SOURCES = ["gazetteer", "gps", "manual"];
const FIELD_SOURCES = ["llm", "fallback", "user"];

/** Collected as a list so one bad body reports every problem, not just the first. */
class ProfileInvalid extends Error {
  constructor(errors) {
    super("profile failed validation");
    this.name = "ProfileInvalid";
    this.errors = errors;
  }
}

const isMissing = (v) => v === null || v === undefined;

function asBool(value, loc, errors) {
  if (isMissing(value)) return null;
  if (typeof value === "boolean") return value;
  errors.push({ loc, msg: "expected true or false", type: "type_error.bool" });
  return null;
}

function asInt(value, loc, errors) {
  if (isMissing(value)) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  // Pydantic accepts a float that is exactly an integer, and a numeric string.
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    errors.push({ loc, msg: "expected a whole number of rupees", type: "type_error.integer" });
    return null;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  errors.push({ loc, msg: "expected a whole number", type: "type_error.integer" });
  return null;
}

function asFloat(value, loc, errors) {
  if (isMissing(value)) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  errors.push({ loc, msg: "expected a number", type: "type_error.float" });
  return null;
}

function asStr(value, loc, errors) {
  if (isMissing(value)) return null;
  if (typeof value === "string") return value;
  errors.push({ loc, msg: "expected a string", type: "type_error.str" });
  return null;
}

function asEnum(value, allowed, loc, errors) {
  if (isMissing(value)) return null;
  if (allowed.includes(value)) return value;
  errors.push({
    loc,
    msg: `expected one of ${allowed.join(", ")}`,
    type: "value_error.enum",
  });
  return null;
}

function normaliseLocation(raw, errors) {
  if (isMissing(raw)) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push({ loc: ["location"], msg: "expected an object", type: "type_error.dict" });
    return null;
  }
  const lat = asFloat(raw.lat, ["location", "lat"], errors);
  const lon = asFloat(raw.lon, ["location", "lon"], errors);
  const source = asEnum(raw.source, LOCATION_SOURCES, ["location", "source"], errors);
  for (const [name, value] of [["lat", lat], ["lon", lon], ["source", source]]) {
    if (value === null) {
      errors.push({ loc: ["location", name], msg: "field required", type: "value_error.missing" });
    }
  }
  return { lat, lon, source };
}

/** `course` is never absent downstream: the engine reads it as an object. */
function normaliseCourse(raw, errors) {
  const c = isMissing(raw) ? {} : raw;
  if (typeof c !== "object" || Array.isArray(c)) {
    errors.push({ loc: ["course"], msg: "expected an object", type: "type_error.dict" });
    return { category: null, level: null, is_full_time_recognised: null,
      duration_months: null, repayment_started: false };
  }
  return {
    category: asStr(c.category, ["course", "category"], errors),
    level: asEnum(c.level, COURSE_LEVELS, ["course", "level"], errors),
    is_full_time_recognised:
      asBool(c.is_full_time_recognised, ["course", "is_full_time_recognised"], errors),
    duration_months: asInt(c.duration_months, ["course", "duration_months"], errors),
    repayment_started: isMissing(c.repayment_started)
      ? false : Boolean(asBool(c.repayment_started, ["course", "repayment_started"], errors)),
  };
}

function normaliseFieldMeta(raw, errors) {
  if (isMissing(raw)) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push({ loc: ["field_meta"], msg: "expected an object", type: "type_error.dict" });
    return {};
  }
  const out = {};
  for (const [field, meta] of Object.entries(raw)) {
    if (typeof meta !== "object" || meta === null) {
      errors.push({ loc: ["field_meta", field], msg: "expected an object", type: "type_error.dict" });
      continue;
    }
    const confidence = asFloat(meta.confidence, ["field_meta", field, "confidence"], errors);
    if (confidence !== null && (confidence < 0 || confidence > 1)) {
      errors.push({
        loc: ["field_meta", field, "confidence"],
        msg: "confidence must be between 0 and 1",
        type: "value_error.number.not_in_range",
      });
    }
    out[field] = {
      confidence,
      source: asEnum(meta.source, FIELD_SOURCES, ["field_meta", field, "source"], errors),
    };
  }
  return out;
}

function normaliseNeedsConfirmation(raw, errors) {
  if (isMissing(raw)) return [];
  if (!Array.isArray(raw)) {
    errors.push({ loc: ["needs_confirmation"], msg: "expected a list", type: "type_error.list" });
    return [];
  }
  return raw.map((v, i) => asStr(v, ["needs_confirmation", i], errors)).filter((v) => v !== null);
}

/**
 * Return the profile the engine should see, or throw `ProfileInvalid`.
 *
 * Unknown keys are dropped rather than rejected, exactly as pydantic did: the
 * saved portal profile carries `email`, `mobile` and `photo_url`, and the engine
 * has never declared them.
 */
function normaliseProfile(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ProfileInvalid([{ loc: ["body"], msg: "expected an object", type: "type_error.dict" }]);
  }
  const errors = [];
  const profile = {
    lang: isMissing(body.lang) ? "hi" : asEnum(body.lang, LANGS, ["lang"], errors),
    name: asStr(body.name, ["name"], errors),
    is_sc: asBool(body.is_sc, ["is_sc"], errors),
    state: asStr(body.state, ["state"], errors),
    district: asStr(body.district, ["district"], errors),
    location: normaliseLocation(body.location, errors),

    purpose: asEnum(body.purpose, PURPOSES, ["purpose"], errors),
    sector: asEnum(body.sector, SECTORS, ["sector"], errors),
    activity_text: asStr(body.activity_text, ["activity_text"], errors),

    amount_inr: asInt(body.amount_inr, ["amount_inr"], errors),
    own_contribution_inr: asInt(body.own_contribution_inr, ["own_contribution_inr"], errors),
    annual_family_income_inr:
      asInt(body.annual_family_income_inr, ["annual_family_income_inr"], errors),

    education: asEnum(body.education, EDUCATIONS, ["education"], errors),
    course: normaliseCourse(body.course, errors),

    is_woman: asBool(body.is_woman, ["is_woman"], errors),
    age: asInt(body.age, ["age"], errors),
    has_existing_enterprise: asBool(body.has_existing_enterprise, ["has_existing_enterprise"], errors),
    enterprise_age_months: asInt(body.enterprise_age_months, ["enterprise_age_months"], errors),
    has_udyam: asBool(body.has_udyam, ["has_udyam"], errors),
    has_caste_certificate: asBool(body.has_caste_certificate, ["has_caste_certificate"], errors),
    has_income_certificate: asBool(body.has_income_certificate, ["has_income_certificate"], errors),

    field_meta: normaliseFieldMeta(body.field_meta, errors),
    needs_confirmation: normaliseNeedsConfirmation(body.needs_confirmation, errors),
  };

  // `frequency` is not a StructuredProfile field, but recommend() reads it when
  // present. Validated here so it cannot arrive as an unpriceable string.
  if (!isMissing(body.frequency)) {
    profile.frequency = asEnum(body.frequency, FREQUENCIES, ["frequency"], errors);
  }

  if (errors.length) throw new ProfileInvalid(errors);
  return profile;
}

module.exports = {
  ProfileInvalid, normaliseProfile,
  LANGS, PURPOSES, SECTORS, EDUCATIONS, COURSE_LEVELS, FREQUENCIES, LOCATION_SOURCES,
};
