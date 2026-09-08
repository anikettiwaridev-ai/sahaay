"use strict";
/**
 * /recommend, /cost and /route. Port of the deterministic half of
 * `backend/main.py`.
 *
 * Transport only, like the FastAPI file it replaces: validate in, call the
 * engine, shape out. Nothing here decides anything.
 *
 * `POST /packet` is deliberately absent. Older contracts listed it as built; it
 * never was, in either stack. An endpoint that returned something packet-shaped
 * would be a lie the demo could call, so the route stays missing until a real
 * packet generator is specified.
 */

const express = require("express");

const cost = require("../services/engine/cost");
const data = require("../services/engine/data");
const recommendEngine = require("../services/engine/recommend");
const routerEngine = require("../services/engine/router");
const { normaliseProfile, ProfileInvalid, FREQUENCIES } = require("../services/profile-schema");

const router = express.Router();

/**
 * The safety boundary, as a status code: the engine refuses to run while
 * anything is unconfirmed, and says exactly what it is waiting for. The browser
 * reads `needs_confirmation` off this body to decide which question to ask next,
 * so the shape is fixed.
 */
router.post("/recommend", (req, res) => {
  let profile;
  try {
    profile = normaliseProfile(req.body);
  } catch (err) {
    if (err instanceof ProfileInvalid) {
      res.status(422).json({ detail: err.errors });
      return;
    }
    throw err;
  }

  try {
    res.json(recommendEngine.recommend(profile));
  } catch (err) {
    if (err instanceof recommendEngine.ProfileUnconfirmed) {
      res.status(422).json({
        detail: "profile is unconfirmed",
        needs_confirmation: err.fields,
      });
      return;
    }
    throw err;
  }
});

router.post("/cost", (req, res) => {
  const body = req.body || {};
  const missing = ["scheme_id", "amount_inr", "channel_rate_key"]
    .filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length) {
    res.status(422).json({
      detail: missing.map((f) => ({ loc: ["body", f], msg: "field required", type: "value_error.missing" })),
    });
    return;
  }
  try {
    res.json(cost.compute(body.scheme_id, body.amount_inr, body.channel_rate_key, {
      frequency: body.frequency ?? null,
      sector: body.sector ?? null,
      course: body.course ?? null,
    }));
  } catch (err) {
    if (err instanceof RangeError) {
      res.status(400).json({ detail: err.message });
      return;
    }
    throw err;
  }
});

router.post("/route", (req, res) => {
  const body = req.body || {};
  const schemeIds = Array.isArray(body.scheme_ids) ? body.scheme_ids : null;
  if (schemeIds === null || typeof body.state !== "string"
      || body.amount_inr === undefined || body.amount_inr === null) {
    res.status(422).json({
      detail: [{
        loc: ["body"],
        msg: "scheme_ids, state and amount_inr are required",
        type: "value_error.missing",
      }],
    });
    return;
  }
  const lang = body.lang === "en" ? "en" : "hi";
  if (body.frequency && !FREQUENCIES.includes(body.frequency)) {
    res.status(422).json({
      detail: [{ loc: ["body", "frequency"], msg: `expected one of ${FREQUENCIES.join(", ")}`,
        type: "value_error.enum" }],
    });
    return;
  }

  const byScheme = {};
  const routes = [];
  try {
    for (const sid of schemeIds) {
      const rows = routerEngine.routesFor(
        sid, body.state, body.lat ?? null, body.lon ?? null, body.amount_inr,
        {
          frequency: body.frequency ?? null,
          sector: body.sector ?? null,
          course: body.course ?? null,
          lang,
        });
      byScheme[sid] = rows;
      routes.push(...rows);
    }
  } catch (err) {
    if (err instanceof RangeError) {
      res.status(400).json({ detail: err.message });
      return;
    }
    throw err;
  }

  res.json({ routes, warnings: routerEngine.stateWarnings(body.state, byScheme, lang) });
});

// The three read-only views the Python baseline exposed under /meta. They are
// how a judge checks a figure against nsfdc.nic.in without reading the code.
router.get("/meta/schemes", (_req, res) => {
  res.json({ schemes: Object.values(data.schemes()) });
});

router.get("/meta/partners", (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const rows = state ? data.partnersInState(state) : Object.values(data.partners());
  res.json({ count: rows.length, partners: rows });
});

router.get("/meta/utilisation", (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : null;
  if (state) {
    const u = data.utilisation(state);
    if (!u) {
      res.status(404).json({ detail: `unknown state ${state}` });
      return;
    }
    res.json(u);
    return;
  }
  const states = [...data.utilisationStates()].sort().map((s) => data.utilisation(s));
  res.json({ states });
});

module.exports = router;
