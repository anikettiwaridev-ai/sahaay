"use strict";
/**
 * The fourteen-entry catalogue, over HTTP. Port of the catalogue half of
 * `backend/portal/routes.py`.
 *
 * Public: no token. Browsing what NSFDC offers is not a privileged act, and the
 * guided wizard has to work without login.
 */

const express = require("express");
const catalogue = require("../services/catalogue-service");

const router = express.Router();

router.get("/catalogue", (req, res) => {
  res.json({ schemes: catalogue.cards() });
});

router.get("/catalogue/:schemeId", (req, res) => {
  const lang = typeof req.query.lang === "string" ? req.query.lang : "en";
  const entry = catalogue.detail(req.params.schemeId, lang);
  if (entry === null) {
    res.status(404).json({ detail: `no scheme ${req.params.schemeId}` });
    return;
  }
  res.json(entry);
});

module.exports = router;
