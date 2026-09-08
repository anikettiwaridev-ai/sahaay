# Sahaay — how the code works

For whoever maintains and explains this project. It assumes you know HTML, CSS,
JavaScript and roughly what Express does (`app.get`, `app.post`, `req`, `res`).
It assumes nothing about Python, and you will not need to write any.

Read section 1 and 2. After that, use section 4 as a lookup table.

---

## 1. Run it

Two terminals. Both commands are run from the project root.

**Terminal 1 — the AI service (Python, port 8001):**

```bash
.venv\Scripts\python.exe -m uvicorn python-ai.app:app --host 127.0.0.1 --port 8001
```

**Terminal 2 — the portal (Node/Express, port 3000):**

```bash
cd server && npm start
```

Then open **http://127.0.0.1:3000**.

You can start Express *without* the AI service. Every page still loads, login,
the catalogue, matching, costs and routing all work. Only the microphone and the
assistant stop working, and they fail with a clear "local AI service is
unavailable" message rather than a broken page. This is deliberate — the demo
survives Ollama or Whisper not being up.

Demo logins (there are only two, and they are stubs by design):

```
sunita / demo123
ramesh / demo123
```

---

## 2. The one picture you need

```
                    ┌──────────────────────────────────────┐
   Browser ───────► │   Express — port 3000                │
   (the only        │   server/app.js                      │
    thing the       │                                      │
    user sees)      │   • renders the 8 pages              │
                    │   • answers every JSON call          │
                    │   • decides eligibility, cost, route │
                    └───────────────┬──────────────────────┘
                                    │  only for speech + assistant
                                    ▼
                    ┌──────────────────────────────────────┐
                    │   Python AI — port 8001              │
                    │   python-ai/app.py                   │
                    │                                      │
                    │   • Whisper (speech → text)          │
                    │   • Ollama (text → profile fields)   │
                    │   • grounded assistant               │
                    └──────────────────────────────────────┘
```

**The browser never talks to port 8001.** It only ever calls `127.0.0.1:3000`.
When the page needs speech or the assistant, Express forwards that one request to
Python and passes the answer straight back. That is the whole relationship.

Two rules that explain most of the design:

1. **The AI never decides anything.** It turns speech into text and text into
   form fields. Whether you qualify, what it costs and which office to visit are
   decided by plain JavaScript in `server/services/engine/`, using NSFDC's
   published numbers. That is the project's core claim, so keep the line clean.
2. **No number is ever typed into code.** Every rate, cap, tenure and
   utilisation figure is read from `data/`. If a figure is missing, the app shows
   a dash. It never guesses.

---

## 3. What each folder is

```
server/          The web application. This is the part you maintain.
python-ai/       The AI service. One small file. You will rarely open it.
web/             The 8 pages: HTML, CSS, browser JavaScript.
data/            Every real NSFDC number. The single source of truth.
backend/         AI code that python-ai/ imports (intake/, portal/assistant.py,
                 portal/catalogue.py, portal/figures.py). Nothing else survives
                 here — the old engine and portal-routes code this project used
                 before the Node port were removed once the port was proven to
                 match them (see STACK-CONTEXT.md).
docs/            The original specs. Still accurate about behaviour.
uploads/         Profile photos. Written at runtime.
```

### Inside `server/` — the only folder you normally touch

```
server/
  app.js                   Wires everything together. Start here.
  config.js                Ports and folder paths. No secrets.
  package.json             Dependencies: express, ejs, multer.

  routes/                  One file per group of URLs. Thin: they read the
                           request, call a service, and send JSON back.
    pages.js               Serves the 8 HTML pages.
    auth.js                Login, logout, who am I.
    profile.js             Read/save the profile, upload a photo.
    catalogue.js           The 14 schemes.
    matching.js            Recommend, cost, route  ← the important one.
    notifications.js       The WhatsApp preview (a stub, honestly labelled).
    ai-bridge.js           Forwards speech + assistant to Python.
    api.js                 Bundles the above into one router for app.js.

  services/                Where the thinking happens.
    engine/                The decision engine. Ported from Python.
      data.js              Loads data/sahidwar.sqlite into memory once.
      rules.js             Eligibility: the rule table.
      cost.js              Instalments, interest, repayment schedule.
      router.js            Which office to walk into, and why.
      recommend.js         Ranks schemes; computes "wrong door cost".
      explain.js           Turns a decision into a sentence, hi + en.
      py.js                Number formatting. See the warning in section 8.
    catalogue-service.js   Builds the 14 catalogue entries.
    figures.js             Formats money/rates. Reads data/schemes.json.
    profile-store.js       SQLite: users, saved profiles, tokens.
    profile-schema.js      Validates an incoming profile. Rejects nonsense.

  views/                   Error pages only. The 8 real pages live in web/.
  tests/                   47 tests. See section 7.
```

**Why pages live in `web/` and not `server/views/`:** `app.js` tells Express to
look for templates in `web/` first. The eight `.html` files are rendered through
EJS but contain no EJS syntax yet, so they are still plain HTML you can open and
edit directly. Nothing about them changed in the migration. When you want a
shared header, you can start using EJS tags in them without moving anything.

---

## 4. Lookup table — a URL, and the file that answers it

This is the table to keep open while working.

### Pages

| URL | File rendered | Page logic |
|---|---|---|
| `/` and `/index.html` | `web/index.html` | `web/js/pages.js` → `initHome` |
| `/login.html` | `web/login.html` | `initLogin` |
| `/profile.html` | `web/profile.html` | `initProfile` |
| `/schemes.html` | `web/schemes.html` | `initSchemes` |
| `/scheme.html` | `web/scheme.html` | `initScheme` |
| `/match.html` | `web/match.html` | `initMatch` |
| `/wizard.html` | `web/wizard.html` | `initWizard` |
| `/assistant.html` | `web/assistant.html` | `initAssistant` |

All eight are listed in `server/routes/pages.js`. All eight load the same four
scripts: `strings.js`, `api.js`, `app.js`, `pages.js`. `pages.js` looks at the
filename in the URL and runs the matching `init` function — that is the entire
front-end router.

### JSON — answered by Express itself

| Method + URL | File | Needs login? |
|---|---|---|
| `POST /auth/login` | `routes/auth.js` | no |
| `POST /auth/logout` | `routes/auth.js` | no |
| `GET /auth/me` | `routes/auth.js` | **yes** |
| `GET /profile` | `routes/profile.js` | **yes** |
| `PUT /profile` | `routes/profile.js` | **yes** |
| `POST /profile/photo` | `routes/profile.js` | **yes** |
| `GET /catalogue` | `routes/catalogue.js` | no |
| `GET /catalogue/:id` | `routes/catalogue.js` | no |
| `POST /recommend` | `routes/matching.js` | no |
| `POST /cost` | `routes/matching.js` | no |
| `POST /route` | `routes/matching.js` | no |
| `GET /notifications/preview` | `routes/notifications.js` | **yes** |
| `GET /meta/health` | `server/app.js` | no |
| `GET /meta/schemes` | `routes/matching.js` | no |
| `GET /meta/partners` | `routes/matching.js` | no |
| `GET /meta/utilisation` | `routes/matching.js` | no |

The wizard deliberately needs **no login** — it is the accessibility path for
someone who cannot manage an account. Don't put a login gate on `/recommend`.

### JSON — forwarded to Python

| Method + URL | Forwarded by | Handled in Python by |
|---|---|---|
| `POST /intake/transcribe` | `routes/ai-bridge.js` | `python-ai/app.py` → Whisper |
| `POST /intake/extract` | `routes/ai-bridge.js` | `python-ai/app.py` → Ollama |
| `POST /assistant/ask` | `routes/ai-bridge.js` | `python-ai/app.py` → assistant |
| `GET /meta/ai-health` | `routes/ai-bridge.js` | `python-ai/app.py` |

`POST /packet` does **not** exist. Older docs claim it does; it was never built
in either version. The print button uses the browser's own print dialog. If you
add a real packet generator, add the route then — not before.

---

## 5. Follow one real request all the way through

**Sunita logs in and sees her matches.** This one journey touches most of the code.

```
1.  She types sunita / demo123 on /login.html
        web/js/pages.js  initLogin()
             ↓ calls
        web/js/api.js    API.login()
             ↓ POST /auth/login
2.  server/routes/auth.js
             ↓ asks
        services/profile-store.js  authenticate()
             ↓ reads
        data/portal.sqlite  (users table)
             ↓ back up: a token
        api.js stores it in localStorage; every later call sends it as
        "Authorization: Bearer <token>"

3.  She lands on /match.html
        pages.js initMatch()
             ↓ GET /profile      (token attached automatically)
        routes/profile.js → profile-store.js → data/portal.sqlite
             ↓ her saved profile comes back
             ↓ POST /recommend with that profile

4.  server/routes/matching.js
             ↓ first: is this profile usable?
        services/profile-schema.js
             • if a field is missing or nonsense → 422 with the list of
               questions still to ask. The wizard reads that list.
             ↓ profile is clean
        services/engine/recommend.js
             ├─ rules.js     which schemes is she eligible for?
             ├─ router.js    which offices can she actually reach?
             │      └─ cost.js  what does each one cost?
             └─ explain.js   say all of it in Hindi and English

             ↓ one JSON response containing:
               • ranked schemes, each with its cost and its offices
               • near-misses ("you would qualify if…")
               • wrong_door_cost — what the wrong office would cost her
5.  pages.js renders the cards. Done.
```

Everything in step 4 is plain JavaScript with no network calls and no AI. It
runs in a few milliseconds and gives the same answer every time.

---

## 6. Where the numbers come from

| File | Holds | Read by |
|---|---|---|
| `data/sahidwar.sqlite` | Everything, compiled: schemes, partners, utilisation, all UI sentences in both languages | `services/engine/data.js` |
| `data/schemes.json` | The 5 schemes with full logic — rates, caps, tenures | `services/figures.js` |
| `data/catalogue.json` | The prose for all 14 catalogue entries | `services/catalogue-service.js` |
| `data/router_weights.json` | How the router scores offices | inside the sqlite, via `data.js` |
| `data/portal.sqlite` | Demo accounts, saved profiles, login tokens | `services/profile-store.js` |

**The catalogue has 14 entries, not 5.** Five are open with full eligibility and
cost logic. Five are informational. Four are closed but still findable, because
an applicant searching for a scheme they heard about deserves to be told it
closed rather than shown nothing. If you ever see "5 schemes" in the UI,
something is broken.

The filename `sahidwar.sqlite` is a leftover: "SahiDwar" was this project's
earlier working name before it became Sahaay. Nothing a user ever sees says
SahiDwar — it survives only as this filename and a few code comments, and
renaming it was judged not worth the risk of missing a reference.

`data/sahidwar.sqlite` is compiled from the JSON files. **The script that compiles
it is not in this repo**, so the `.sqlite` is committed directly. Practical
consequence: editing `data/schemes.json` alone will *not* change what the app
shows. Until that script is restored, treat the `.sqlite` as the live copy.

---

## 7. Tests

```bash
cd server && npm test
```

47 tests, all should pass. They take about two seconds.

They are not ordinary unit tests. Before the old Python engine was retired, it
was run over every persona and every scheme, and its exact answers were saved
into `server/tests/fixtures/*.golden.json`. The tests compare the JavaScript
output against those saved answers, down to the rupee. That old engine no
longer exists in this repo — the fixtures are the permanent record of what it
used to say (see `STACK-CONTEXT.md` for why it was removed).

**So: if you change anything in `services/engine/` and a test fails, you have
changed a number a user sees.** That is the alarm working, not a broken test.
Either your change is wrong, or the rules genuinely changed on purpose, in
which case the relevant `fixtures/*.golden.json` file should be edited by hand
to match the new, intended answer — there is no longer a Python script to
regenerate it from.

---

## 8. Things that will bite you

1. **`services/engine/py.js` looks pointless. It is not.** JavaScript and Python
   round `.5` differently — Python's `round(0.125, 2)` is `0.12`, JavaScript's is
   `0.13`. Instalments round twice per period, so using plain `Math.round` makes
   repayment figures drift from the published ones. Do not "simplify" this file.

2. **Hindi text: copy, never retype.** Some Hindi characters have two valid
   encodings that look identical on screen but are different bytes. Retyping a
   string can silently break a comparison. Copy-paste existing strings.

3. **Never rate a bank as good or bad.** The router ranks offices using NSFDC's
   own published state utilisation figures, and it applies that only to State
   Channelizing Agencies — never to a named bank. Inventing a score for a lender
   would be a claim we cannot support, and it is the first thing a judge would
   attack.

4. **The assistant only answers from the catalogue.** Ask it about the weather
   and it refuses. That refusal is a feature; don't "improve" it into a general
   chatbot, and never let it state an interest rate from its own memory.

5. **Login is a demo, and says so.** Plain-text passwords, a random token in a
   table. Don't dress it up as real security — the honesty is the point.

6. **Everything left in `backend/` is live.** Unlike an ordinary "legacy
   folder", this one was pruned down to exactly what `python-ai/app.py` still
   imports. Editing `backend/intake/`, `backend/portal/assistant.py`,
   `catalogue.py`, `figures.py`, `models.py` or `engine/data.py` changes what
   the running AI service does. There is no separate old version sitting
   dormant here to avoid confusing with the real one — this *is* the real one.

---

## 9. "I want to change X"

| You want to… | Edit |
|---|---|
| Change page text or layout | `web/*.html` |
| Change visible wording/labels | `web/js/strings.js` |
| Change styling | `web/css/style.css`, `web/css/gov.css` |
| Change what a page does | the matching `init` function in `web/js/pages.js` |
| Add a new JSON endpoint | a file in `server/routes/`, then register it in `routes/api.js` |
| Change an eligibility rule | the rule table in `server/services/engine/rules.js` |
| Change a repayment calculation | `server/services/engine/cost.js` |
| Change how offices are ranked | `server/services/engine/router.js` |
| Change a reason/warning sentence | the `strings` table in `data/sahidwar.sqlite` |
| Change a scheme's rate or cap | `data/schemes.json` **and** the sqlite (see section 6) |
| Change the AI prompt | `backend/intake/prompts/extract_v1.md` |

After any change under `server/services/engine/`, run `npm test`.
