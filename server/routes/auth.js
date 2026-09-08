"use strict";
/**
 * Demo authentication. Port of the auth half of `backend/portal/routes.py`.
 *
 * Transport only: validate in, call `profile-store`, shape out. No decision is
 * taken in this file.
 *
 * **The token header.** The contract says "(token in header)" and does not name
 * the header. `Authorization: Bearer <token>` is what this reads, and
 * `X-Sahaay-Token` is accepted as well so a hand-written curl is easy -- the
 * same two the Python baseline accepted, so the browser client needs no change.
 *
 * Two accounts, passwords in plain text, a token that is a random string in a
 * table. Real authentication is a stated non-goal; anything here that looked
 * like security would be a lie about what the project does.
 */

const express = require("express");
const store = require("../services/profile-store");

const router = express.Router();

/** The token on this request, from either accepted header. */
function bearer(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.get("x-sahaay-token") || null;
}

/** 401 unless the token names a user. The one gate in the deterministic API. */
function requireUser(req, res, next) {
  const user = store.userForToken(bearer(req));
  if (user === null) {
    res.status(401).json({ detail: "not signed in" });
    return;
  }
  req.user = user;
  next();
}

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(422).json({
      detail: [{ loc: ["body"], msg: "username and password are required", type: "value_error.missing" }],
    });
    return;
  }
  const user = store.authenticate(username, password);
  if (user === null) {
    res.status(401).json({ detail: "wrong username or password" });
    return;
  }
  res.json({ token: store.issueToken(user.username), user });
});

router.post("/auth/logout", (req, res) => {
  store.revokeToken(bearer(req));
  res.json({ ok: true });
});

router.get("/auth/me", requireUser, (req, res) => {
  res.json(req.user);
});

module.exports = router;
module.exports.bearer = bearer;
module.exports.requireUser = requireUser;
