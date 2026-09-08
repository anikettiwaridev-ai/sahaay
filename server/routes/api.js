"use strict";
/**
 * Every deterministic JSON route, as one router.
 *
 * The Express foundation registers this with a single line:
 *
 *     app.use(require("./routes/api"));
 *
 * so the two tracks meet at one import rather than at five. The AI bridge is not
 * here: it is a separate router, and the browser reaches it through Express the
 * same way, but nothing in this file knows the Python service exists.
 *
 * Order matters only in that `/catalogue/:schemeId` must not shadow anything;
 * it does not, because every other path is a distinct first segment.
 */

const express = require("express");

const auth = require("./auth");
const profile = require("./profile");
const catalogue = require("./catalogue");
const matching = require("./matching");
const notifications = require("./notifications");
const store = require("../services/profile-store");

const router = express.Router();

router.use(auth);
router.use(profile);
router.use(catalogue);
router.use(matching);
router.use(notifications);

module.exports = router;

/**
 * Create the demo tables and seed the two accounts. Idempotent; call once at
 * start-up. `{ reseed: true }` returns the demo to its shipped state.
 */
module.exports.init = store.init;

/** What the deterministic half can report about its own health. */
module.exports.health = () => {
  const data = require("../services/engine/data");
  const cost = require("../services/engine/cost");
  const catalogueService = require("../services/catalogue-service");

  const problems = [];
  let schemes = 0;
  let partners = 0;
  try {
    schemes = Object.keys(data.schemes()).length;
    partners = Object.keys(data.partners()).length;
    if (schemes !== 5) problems.push(`expected 5 schemes, found ${schemes}`);
    if (partners < 60) problems.push(`expected >= 60 partners, found ${partners}`);
  } catch (err) {
    return { ok: false, problems: [String(err.message || err)] };
  }

  let entries = 0;
  try {
    entries = catalogueService.cards().length;
    if (entries !== 14) problems.push(`expected 14 catalogue entries, found ${entries}`);
  } catch (err) {
    problems.push(`catalogue: ${err.message}`);
  }

  if (!store.demoPhotoPresent()) {
    // Reported rather than redrawn -- see profile-store.demoPhotoPresent.
    problems.push("uploads/sunita.jpg is missing; the seeded profile's photo will 404");
  }

  return {
    ok: problems.length === 0,
    problems,
    engine_version: data.engineVersion(),
    schemes,
    partners,
    catalogue_entries: entries,
    moratorium_interest: cost.moratoriumInterestMode(),
  };
};
