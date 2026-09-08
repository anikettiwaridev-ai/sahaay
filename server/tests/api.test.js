"use strict";
/**
 * The deterministic JSON API, over real HTTP.
 *
 * Boots the router on an ephemeral port against a throwaway copy of the demo
 * database, so a test run never touches `data/portal.sqlite` and never depends
 * on what the last rehearsal left behind.
 *
 * The engine's own answers are proved in the parity suites; this file proves the
 * transport around them -- status codes, the token header, the 422 the wizard
 * reads, and the response envelopes the browser client already expects.
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TMP_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sahaay-api-")), "portal.sqlite");
process.env.SAHAAY_PORTAL_DB = TMP_DB;

const express = require("express");
const api = require("../routes/api");
const { PERSONAS } = require("./personas");

api.init({ reseed: true });

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(api);
const server = app.listen(0, "127.0.0.1");
const base = () => `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  fs.rmSync(path.dirname(TMP_DB), { recursive: true, force: true });
});

async function call(method, path_, { body, token, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) headers["Content-Type"] = "application/json";
  const res = await fetch(base() + path_, {
    method,
    headers,
    body: raw ? body : (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
  }
  return { status: res.status, body: json };
}

async function login(username = "sunita", password = "demo123") {
  const res = await call("POST", "/auth/login", { body: { username, password } });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

// ------------------------------------------------------------------- auth
test("auth: the demo credentials work and issue a token", async () => {
  const res = await call("POST", "/auth/login", {
    body: { username: "sunita", password: "demo123" },
  });
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.token, "string");
  assert.deepEqual(res.body.user, { username: "sunita", display_name: "Sunita Devi" });
});

test("auth: a wrong password is 401, not a hint", async () => {
  const res = await call("POST", "/auth/login", {
    body: { username: "sunita", password: "nope" },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.detail, "wrong username or password");
});

test("auth: /auth/me needs the bearer token", async () => {
  assert.equal((await call("GET", "/auth/me")).status, 401);
  const token = await login();
  const res = await call("GET", "/auth/me", { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.username, "sunita");
});

test("auth: logging out revokes the token", async () => {
  const token = await login();
  assert.equal((await call("POST", "/auth/logout", { token })).status, 200);
  assert.equal((await call("GET", "/auth/me", { token })).status, 401);
});

test("auth: ramesh is the second demo account", async () => {
  const token = await login("ramesh", "demo123");
  const res = await call("GET", "/auth/me", { token });
  assert.equal(res.body.display_name, "Ramesh Kumar");
});

// ---------------------------------------------------------------- profile
test("profile: the seeded Sunita profile comes back whole", async () => {
  const token = await login();
  const res = await call("GET", "/profile", { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Sunita Devi");
  assert.equal(res.body.state, "MP");
  assert.equal(res.body.amount_inr, 120000);
  assert.equal(res.body.location.source, "manual", "location.source must survive the round trip");
  assert.deepEqual(res.body.needs_confirmation, []);
});

test("profile: a saved profile keeps the fields the engine does not declare", async () => {
  const token = await login();
  const before = (await call("GET", "/profile", { token })).body;
  const edited = { ...before, mobile: "9000000001", photo_url: "/uploads/sunita.jpg" };
  const put = await call("PUT", "/profile", { token, body: edited });
  assert.equal(put.status, 200);
  assert.equal(put.body.ok, true);
  const after = (await call("GET", "/profile", { token })).body;
  assert.equal(after.mobile, "9000000001");
  assert.equal(after.photo_url, "/uploads/sunita.jpg");
  await call("PUT", "/profile", { token, body: before });     // put it back
});

test("profile: an anonymous caller gets 401, never someone else's profile", async () => {
  assert.equal((await call("GET", "/profile")).status, 401);
  assert.equal((await call("PUT", "/profile", { body: {} })).status, 401);
});

test("profile/photo: a real multipart upload is stored under a generated name", async () => {
  const token = await login();
  const form = new FormData();
  // A one-pixel PNG. The bytes do not matter; the storage path does.
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154"
    + "789c6300010000050001",
    "hex");
  form.append("photo", new Blob([png], { type: "image/png" }), "avatar.png");
  const res = await fetch(`${base()}/profile/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.photo_url, /^\/uploads\/sunita-[0-9a-f]{8}\.png$/,
    `the upload's own filename must not reach disk: ${body.photo_url}`);
  const store = require("../services/profile-store");
  const onDisk = path.join(store.UPLOADS, path.basename(body.photo_url));
  assert.ok(fs.existsSync(onDisk));
  fs.rmSync(onDisk);
});

test("profile/photo: a disallowed extension is refused", async () => {
  const token = await login();
  const form = new FormData();
  form.append("photo", new Blob([Buffer.from("MZ")], { type: "application/octet-stream" }),
    "payload.exe");
  const res = await fetch(`${base()}/profile/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 400);
});

// -------------------------------------------------------------- catalogue
test("catalogue: fourteen entries, no token required", async () => {
  const res = await call("GET", "/catalogue");
  assert.equal(res.status, 200);
  assert.equal(res.body.schemes.length, 14);
});

test("catalogue: one entry, in the requested language", async () => {
  const en = await call("GET", "/catalogue/MFS?lang=en");
  const hi = await call("GET", "/catalogue/MFS?lang=hi");
  assert.equal(en.status, 200);
  assert.equal(en.body.lang, "en");
  assert.equal(hi.body.lang, "hi");
  assert.notEqual(en.body.one_line_hi, en.body.one_line_en);
  assert.deepEqual(hi.body.documents, hi.body.documents_hi);
});

test("catalogue: an unknown scheme is 404", async () => {
  assert.equal((await call("GET", "/catalogue/NOPE")).status, 404);
});

// --------------------------------------------------------------- matching
test("recommend: persona 1 matches without a token", async () => {
  const res = await call("POST", "/recommend", { body: PERSONAS["1"] });
  assert.equal(res.status, 200);
  assert.ok(res.body.recommendations.length > 0);
  assert.equal(typeof res.body.wrong_door_cost, "number");
  assert.ok(res.body.rules_fired.length > 0, "the decision trace must ride along");
});

test("recommend: an unconfirmed profile is 422 with the field the wizard must ask", async () => {
  const res = await call("POST", "/recommend", { body: PERSONAS["11"] });
  assert.equal(res.status, 422);
  assert.equal(res.body.detail, "profile is unconfirmed");
  assert.ok(res.body.needs_confirmation.includes("amount_inr"));
});

test("recommend: an out-of-vocabulary sector is refused, not silently ignored", async () => {
  const res = await call("POST", "/recommend", {
    body: { ...PERSONAS["1"], sector: "crypto_mining" },
  });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.detail));
});

test("recommend: a rupee amount sent as a formatted string is refused", async () => {
  const res = await call("POST", "/recommend", {
    body: { ...PERSONAS["1"], amount_inr: "1,20,000" },
  });
  assert.equal(res.status, 422, "a string that is not a number must never be coerced to one");
});

test("cost: prices a scheme at a channel", async () => {
  const res = await call("POST", "/cost", {
    body: { scheme_id: "MFS", amount_inr: 120000, channel_rate_key: "SCA" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.scheme_id, "MFS");
  assert.equal(res.body.total_repayment, res.body.loan + res.body.total_interest);
});

test("cost: a channel that does not price the scheme is 400", async () => {
  const res = await call("POST", "/cost", {
    body: { scheme_id: "TL", amount_inr: 300000, channel_rate_key: "COOP" },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.detail, /is not offered at/);
});

test("cost: a missing field is 422", async () => {
  const res = await call("POST", "/cost", { body: { scheme_id: "MFS" } });
  assert.equal(res.status, 422);
});

test("route: returns doors and the state warning together", async () => {
  const res = await call("POST", "/route", {
    body: {
      scheme_ids: ["MFS", "TL"], state: "MP", lat: 23.2599, lon: 77.4126,
      amount_inr: 120000, lang: "hi",
    },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.routes.length > 0);
  assert.ok(Array.isArray(res.body.warnings));
  for (const row of res.body.routes) {
    assert.ok(row.why.length > 0, "every route must carry its own explanation");
    assert.ok(row.cost_schedule, "every route must be priced");
  }
});

test("route: a state with no SCA says so, and names an alternative", async () => {
  const res = await call("POST", "/route", {
    body: { scheme_ids: ["MFS"], state: "TG", amount_inr: 200000, lang: "en" },
  });
  assert.equal(res.status, 200);
  const warning = res.body.warnings.find((w) => w.id === "no_sca_in_state");
  assert.ok(warning, "Telangana has no SCA and the answer must say so");
  assert.ok(warning.text_en.length > 0);
});

test("route: no named lender is ever rated by anything but published utilisation", async () => {
  const res = await call("POST", "/route", {
    body: { scheme_ids: ["MFS"], state: "MP", amount_inr: 120000, lang: "en" },
  });
  for (const row of res.body.routes) {
    if (row.partner.type !== "SCA") {
      assert.equal(row.band, null,
        `${row.partner.id} is not an SCA and must carry no utilisation band`);
    }
  }
});

// ----------------------------------------------------------- notifications
test("notifications: the preview quotes the engine, and admits it is a stub", async () => {
  const token = await login();
  const res = await call("GET", "/notifications/preview", { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.delivery, "stub");
  assert.equal(res.body.to, "9876543210");
  assert.ok(res.body.matched_scheme_ids.length > 0);
  assert.ok(res.body.message.includes("Sunita"));
});

test("notifications: needs a token", async () => {
  assert.equal((await call("GET", "/notifications/preview")).status, 401);
});

// ------------------------------------------------------------------- meta
test("meta: the read-only views a judge checks figures against", async () => {
  const schemes = await call("GET", "/meta/schemes");
  assert.equal(schemes.body.schemes.length, 5);
  const partners = await call("GET", "/meta/partners?state=MP");
  assert.ok(partners.body.count > 0);
  const util = await call("GET", "/meta/utilisation?state=MP");
  assert.equal(util.body.state, "MP");
  assert.equal((await call("GET", "/meta/utilisation?state=ZZ")).status, 404);
});

test("meta: the deterministic half reports its own health", () => {
  const health = api.health();
  assert.equal(health.schemes, 5);
  assert.equal(health.catalogue_entries, 14);
  assert.equal(health.moratorium_interest, "capitalise");
});

test("packet: is absent rather than stubbed", async () => {
  const res = await call("POST", "/packet", { body: {} });
  assert.equal(res.status, 404,
    "a packet-shaped answer from a route with no packet generator behind it would be a lie");
});

// ------------------------------------------------------- end-to-end parity
/**
 * The parity suites call the engine directly. This one walks the whole Express
 * path -- JSON body in, profile normalisation, engine, JSON body out -- and
 * compares the response to what the FastAPI baseline returned for the same
 * persona. If the normaliser ever changes a value on the way in, this fails.
 */
test("recommend over HTTP reproduces the Python baseline for every persona", async () => {
  const { golden, diff } = require("./parity");
  const expected = golden("recommend");
  for (const pid of Object.keys(PERSONAS)) {
    const res = await call("POST", "/recommend", { body: PERSONAS[pid] });
    if (!expected[pid].ok) {
      assert.equal(res.status, 422, `persona ${pid}: expected the unconfirmed refusal`);
      assert.deepEqual(res.body.needs_confirmation, expected[pid].needs_confirmation);
      continue;
    }
    assert.equal(res.status, 200, `persona ${pid}: ${JSON.stringify(res.body).slice(0, 300)}`);
    const d = diff(res.body, expected[pid].result);
    assert.equal(d, null, `persona ${pid}: ${d}`);
  }
});

test("route over HTTP reproduces the Python baseline", async () => {
  const { golden, diff } = require("./parity");
  for (const row of golden("route")) {
    const q = row.in;
    const res = await call("POST", "/route", {
      body: {
        scheme_ids: q.scheme_ids, state: q.state, lat: q.lat, lon: q.lon,
        amount_inr: q.amount_inr, sector: q.sector, course: q.course, lang: q.lang,
      },
    });
    assert.equal(res.status, 200);
    const d = diff(res.body, row.out);
    assert.equal(d, null, `${q.state}/${q.lang}: ${d}`);
  }
});

test("catalogue over HTTP reproduces the Python baseline", async () => {
  const { golden, diff } = require("./parity");
  const expected = golden("catalogue");
  const cards = await call("GET", "/catalogue");
  assert.equal(diff(cards.body.schemes, expected.cards), null);
  for (const [key, entry] of Object.entries(expected.detail)) {
    const [sid, lang] = key.split(":");
    const res = await call("GET", `/catalogue/${sid}?lang=${lang}`);
    assert.equal(res.status, 200);
    const d = diff(res.body, entry);
    assert.equal(d, null, `${key}: ${d}`);
  }
});
