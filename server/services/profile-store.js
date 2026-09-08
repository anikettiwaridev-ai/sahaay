"use strict";
/**
 * Accounts, saved profiles and demo tokens. One SQLite file.
 * Port of `backend/portal/store.py`.
 *
 * The login is a **demo login**, said out loud on screen. Two accounts,
 * passwords in plain text, a token that is a random string in a table. Real
 * authentication is a stated non-goal, so anything here that looked like
 * security would be a lie about what the project does -- and a week spent on its
 * least interesting part.
 *
 * Separate file from `data/sahidwar.sqlite`. That one is compiled, read-only and
 * rebuilt by the build script; this one is written at runtime. Mixing them would
 * mean a rebuild wipes the profiles.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DB_PATH = process.env.SAHAAY_PORTAL_DB || path.join(ROOT, "data", "portal.sqlite");
const UPLOADS = path.join(ROOT, "uploads");

const SCHEMA = `
create table if not exists users (
  username     text primary key,
  password     text not null,
  display_name text not null
);
create table if not exists profiles (
  username   text primary key,
  profile    text not null,
  updated_at text not null
);
create table if not exists tokens (
  token      text primary key,
  username   text not null,
  created_at text not null
);
`;

const DEMO_USERS = [
  ["sunita", "demo123", "Sunita Devi"],
  ["ramesh", "demo123", "Ramesh Kumar"],
];

/**
 * Bhopal, tailoring, family income 2.4 lakh, needs 1.2 lakh, eighth pass.
 *
 * `location.source` is not in the contract's example but the engine's Location
 * shape requires it, so it is carried here -- otherwise the saved profile 422s
 * the moment /recommend reads it. `needs_confirmation` is empty: this profile
 * was confirmed once already, which is what "saved profile" means.
 */
const SUNITA_PROFILE = {
  lang: "hi",
  name: "Sunita Devi",
  is_sc: true,
  state: "MP",
  district: "Bhopal",
  location: { lat: 23.25, lon: 77.41, source: "manual" },
  purpose: "enterprise",
  sector: "tailoring",
  activity_text: "silai ka kaam",
  amount_inr: 120000,
  annual_family_income_inr: 240000,
  education: "middle",
  is_woman: true,
  age: 34,
  has_caste_certificate: true,
  has_income_certificate: false,
  email: "sunita@example.com",
  mobile: "9876543210",
  photo_url: "/uploads/sunita.jpg",
  needs_confirmation: [],
};

/** The Python baseline's `isoformat(timespec="seconds")`, to the second, in UTC. */
function now() {
  return `${new Date().toISOString().slice(0, 19)}+00:00`;
}

function connect() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  return new DatabaseSync(DB_PATH);
}

/**
 * Create the tables and put the two demo accounts back if they are gone.
 *
 * Idempotent: called on every server start. `reseed` puts the demo back to its
 * shipped state -- every saved profile dropped and Sunita's restored -- which is
 * what you want after a rehearsal, and what makes the tests independent of
 * whatever the last run left behind.
 */
function init({ reseed = false } = {}) {
  const db = connect();
  try {
    db.exec(SCHEMA);
    const upsertUser = db.prepare(
      "insert into users(username, password, display_name) values (?,?,?) "
      + "on conflict(username) do update set "
      + "password=excluded.password, display_name=excluded.display_name");
    for (const [username, password, display] of DEMO_USERS) {
      upsertUser.run(username, password, display);
    }
    if (reseed) {
      db.exec("delete from profiles");
      db.exec("delete from tokens");
    }
    const row = db.prepare("select 1 as present from profiles where username='sunita'").get();
    if (reseed || row === undefined) {
      db.prepare(
        "insert into profiles(username, profile, updated_at) values (?,?,?) "
        + "on conflict(username) do update set "
        + "profile=excluded.profile, updated_at=excluded.updated_at")
        .run("sunita", JSON.stringify(SUNITA_PROFILE), now());
    }
  } finally {
    db.close();
  }
}

/**
 * Whether the seeded profile's placeholder image is actually on disk.
 *
 * The Python baseline draws it with Pillow when it is missing. This port does
 * not: adding an image library to the Express server to redraw one demo tile
 * would be the wrong trade, and inventing a different file would change the
 * seeded profile's `photo_url`. So it reports instead of pretending -- the
 * health route surfaces the absence rather than the page serving a broken image
 * with no explanation. Regenerate it by running the Python baseline once.
 */
function demoPhotoPresent() {
  return fs.existsSync(path.join(UPLOADS, path.basename(SUNITA_PROFILE.photo_url)));
}

// ------------------------------------------------------------------- auth
function authenticate(username, password) {
  const db = connect();
  try {
    const row = db.prepare("select * from users where username=?").get(username);
    if (row === undefined || row.password !== password) return null;
    return { username: row.username, display_name: row.display_name };
  } finally {
    db.close();
  }
}

function issueToken(username) {
  const token = crypto.randomBytes(24).toString("base64url");
  const db = connect();
  try {
    db.prepare("insert into tokens(token, username, created_at) values (?,?,?)")
      .run(token, username, now());
  } finally {
    db.close();
  }
  return token;
}

function userForToken(token) {
  if (!token) return null;
  const db = connect();
  try {
    const row = db.prepare(
      "select u.username, u.display_name from tokens t "
      + "join users u on u.username = t.username where t.token=?").get(token);
    return row === undefined ? null : { username: row.username, display_name: row.display_name };
  } finally {
    db.close();
  }
}

function revokeToken(token) {
  if (!token) return;
  const db = connect();
  try {
    db.prepare("delete from tokens where token=?").run(token);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------- profiles
/** The saved profile, or `{}`. */
function getProfile(username) {
  const db = connect();
  try {
    const row = db.prepare("select profile from profiles where username=?").get(username);
    if (row === undefined) return {};
    try {
      return JSON.parse(row.profile);
    } catch {
      return {};
    }
  } finally {
    db.close();
  }
}

/**
 * Stored as the caller sent it.
 *
 * Deliberately not validated against the engine's profile shape: the contract's
 * profile carries `email`, `mobile` and `photo_url`, which that shape does not
 * declare and would silently drop. The engine ignores them, /recommend validates
 * for itself, and nothing here has to change a shape the engine's tests own.
 */
function saveProfile(username, profile) {
  const db = connect();
  try {
    db.prepare(
      "insert into profiles(username, profile, updated_at) values (?,?,?) "
      + "on conflict(username) do update set "
      + "profile=excluded.profile, updated_at=excluded.updated_at")
      .run(username, JSON.stringify(profile), now());
  } finally {
    db.close();
  }
  return profile;
}

module.exports = {
  DB_PATH, UPLOADS, DEMO_USERS, SUNITA_PROFILE,
  init, demoPhotoPresent, authenticate, issueToken, userForToken, revokeToken,
  getProfile, saveProfile,
};
