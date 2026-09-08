"use strict";

const express = require("express");

const router = express.Router();

/* These files remain visually identical to the verified portal, but Express
 * now renders them with EJS. The `.html` suffix is deliberately retained so
 * every existing link and demo-script URL continues to work during migration.
 * Moving a file to `.ejs` later is mechanical once shared partials are wanted. */
const pages = {
  "/": "index.html",
  "/index.html": "index.html",
  "/login.html": "login.html",
  "/profile.html": "profile.html",
  "/schemes.html": "schemes.html",
  "/scheme.html": "scheme.html",
  "/match.html": "match.html",
  "/assistant.html": "assistant.html",
  "/wizard.html": "wizard.html"
};

Object.entries(pages).forEach(([url, view]) => {
  router.get(url, (_req, res, next) => {
    res.render(view, {}, (err, html) => {
      if (err) return next(err);
      res.type("html").send(html);
    });
  });
});

module.exports = router;
