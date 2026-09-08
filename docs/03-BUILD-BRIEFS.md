# Build briefs — four tracks that run in parallel

These are **tracks, not phases.** They are designed so that different people, using
different AI tools, on different machines, can work at the same time without waiting for
each other. That works only because `00-CONTRACTS.md` fixes the API shapes, the global
JavaScript objects, and every DOM `id` in advance.

```
        ┌─────────────────────────────────────────┐
        │  Everyone reads 00-CONTRACTS.md first   │
        └─────────────────────────────────────────┘
                          │
     ┌──────────┬─────────┴────────┬──────────────┐
     ▼          ▼                  ▼              ▼
  TRACK A    TRACK B            TRACK C        TRACK D
  Backend    HTML + CSS         JS wiring      Assistant
  (Claude)   (Gemini/Codex)     (Claude)       (either)
     │          │                  │              │
     └──────────┴─────────┬────────┴──────────────┘
                          ▼
                    TRACK E — integration
                    (Claude, needs everything)
```

**A, B, C and D genuinely do not depend on each other.** C can be written against DOM ids
that do not exist yet, because the contract guarantees B will create them. B can be
written against data shapes that no endpoint returns yet, because the contract guarantees
A will return them.

---

## Track A — Backend: accounts, profiles, catalogue, assistant

**Needs:** filesystem access, the existing `backend/` and `data/`. **Give this to Claude.**

**Scope**
- Copy `backend/` and `data/` from the old repo into `SIH-new/`. Change nothing that exists.
- Add SQLite tables: `users` (username, password, display_name), `profiles` (username,
  profile JSON), `tokens` (token, username).
- Seed two users: `sunita/demo123`, `ramesh/demo123`. Seed Sunita's profile with the
  demo persona from `DEMO-SCRIPT.md`.
- Build every endpoint in `00-CONTRACTS.md` §2 marked "new".
- Build `data/catalogue.json` — all fourteen entries from `00-CONTRACTS.md` §5, each with
  `eligibility_text[]`, `documents[]`, `how_to_apply[]` in Hindi and English. The five
  with `has_full_logic` must use the exact figures already in `data/schemes.json` — do
  not retype a rate.
- `/assistant/ask`: retrieve the relevant catalogue entries for the question, put **only
  those** in the prompt, instruct the model to answer from them alone and to say it
  cannot help if the answer is not there. Return the ids it used in `cited_scheme_ids`.
- Serve `web/` as static files so one server runs everything.

**Out of scope:** any HTML, any CSS, any frontend JavaScript.

**Acceptance — show the command and its output**
1. `pytest backend/tests -q` — the 84 existing tests still pass, unchanged.
2. `curl -X POST /auth/login -d '{"username":"sunita","password":"demo123"}'` returns a token.
3. `curl /profile` with that token returns Sunita's profile including `email`, `mobile`, `photo_url`.
4. `curl /catalogue` returns exactly 14 entries; 5 have `has_full_logic: true`; every
   `category` is one of the five allowed values.
5. `curl -X POST /assistant/ask -d '{"question":"ब्याज कितना है?","lang":"hi"}'` returns an
   answer with a non-empty `cited_scheme_ids`.
6. `curl -X POST /assistant/ask -d '{"question":"What is the capital of France?"}'`
   **refuses** rather than answering.
7. Opening `http://127.0.0.1:8000/` serves `web/index.html`.

---

## Track B — HTML and CSS: all eight pages

**Needs nothing.** No server, no data, no other track. Files can be produced one at a
time and pasted in. **Give this to Gemini or Codex.**

**Scope**
- The eight HTML files in `02-PAGES.md`, complete, with **hardcoded placeholder content**
  so each page looks finished when opened directly in a browser.
- `css/style.css` and `css/gov.css` per the look in `02-PAGES.md`.
- Every element that JavaScript touches carries **exactly** the `id` from
  `00-CONTRACTS.md` §6. Every visible string carries `data-t="some.key"`.
- Each page ends with the fixed script block, in this order:
  ```html
  <script src="js/strings.js"></script>
  <script src="js/api.js"></script>
  <script src="js/app.js"></script>
  <script src="js/pages.js"></script>
  ```
- Responsive down to 360px. Every button and input at least 48px tall.

**Out of scope:** all JavaScript. Do not write a `<script>` with logic in it. Do not fetch
anything. Placeholder content is correct and expected.

**Acceptance**
1. Every page opens directly from the filesystem and looks complete.
2. `grep -o 'id="[^"]*"' web/*.html | sort` — every id in contracts §6 is present, and
   nothing invents an id that is not in §6.
3. Every visible text node has a `data-t` attribute.
4. At 360px wide, no horizontal scrollbar on any page.
5. No `<script>` tag contains logic other than the four `src` includes.

---

## Track C — JavaScript: strings, API client, shared helpers, page logic

**Needs:** `00-CONTRACTS.md` only. Can be written before Track B's HTML exists.
**Give this to Claude.**

**Scope**
- `js/strings.js` — every key both pages and logic need, in `en` and `hi`. Identical key sets.
- `js/api.js` — exactly the functions in contracts §3. Token handling in `localStorage`.
  One `request()` helper; every function is three lines.
- `js/app.js` — `t`, `setLang`, `getLang`, `requireAuth`, `renderNav`, `money`, `toast`, `qs`.
- `js/pages.js` — one function per page (`initHome`, `initLogin`, `initProfile`,
  `initSchemes`, `initScheme`, `initMatch`, `initAssistant`, `initWizard`), and a router
  at the bottom that calls the right one based on `location.pathname`.

**Rules**
- Never touch an id that is not in contracts §6.
- Never write a visible sentence — use `App.t()`.
- Every network call goes through `API.*`.
- Guard everything: if an element is missing, log and continue rather than throwing. A
  half-built page must not break the rest.

**Acceptance**
1. `node --check` passes on all four files (syntax only, no runtime needed).
2. Every function named in contracts §3 exists on `window.API`.
3. `STRINGS.en` and `STRINGS.hi` have identical key sets — prove it with a one-line script.
4. `grep -o "getElementById([\"'][^\"']*" js/*.js` — every id appears in contracts §6.

---

## Track D — The assistant panel

**Needs:** contracts §2 (`/assistant/ask`, `/intake/transcribe`, `/intake/extract`).

**Scope**
- The chat side of `assistant.html`: append messages, call `API.ask()`, render the
  citation line under every reply.
- The voice side: hold `#mic-btn` to record via `MediaRecorder`, POST to
  `API.transcribe()`, put the result in `#transcript-box` **as editable text**, and let
  "Use this" push it through `API.extract()` into `match.html`.
- Handle the three failure cases visibly: no microphone permission, empty or too-short
  audio, and the server being unreachable. Each shows a plain sentence and a retry.

**Acceptance**
1. Typing a question returns an answer with a citation line.
2. An off-topic question returns the refusal, not an invented answer.
3. Recording, editing the transcript, and pressing "Use this" lands on `match.html` with
   the right scheme.
4. Denying microphone permission shows a message and the typing box still works.

---

## Track E — Integration and the demo

**Needs:** all four. **Last.**

**Scope**
- Drop B's HTML/CSS and C's JS together, replace placeholder content with live data,
  fix whatever does not line up.
- `run.bat` / `run.sh`: start the server, open the browser.
- Walk `DEMO-SCRIPT.md` end to end and fix every rough edge on that path.
- Record the demo video.
- `README.md`: what it is, how to run it, which file does what.

**Acceptance**
1. The full `DEMO-SCRIPT.md` path completes with no console errors.
2. It works with the network disconnected.
3. Cold start from `run.bat` to the home page in under 60 seconds.
4. The demo video exists and is under three minutes.
5. Every page works in Hindi and in English.

---

## If a track finishes early

Do not start another track's files. Instead: re-read `00-CONTRACTS.md`, and report any
place where the contract is ambiguous or impossible. A contract bug found before
integration costs minutes; found during integration it costs hours.

## The one rule that keeps this working

**If you need something that is not in `00-CONTRACTS.md`, stop and ask for the contract
to be changed. Do not invent it.** The moment two tracks each invent their own answer,
the parallelism is what breaks the build instead of speeding it up.
