# Sahaay — why the stack is what it is

The record of one decision: why this project moved off Python/FastAPI onto
Node/Express, what actually changed, and what deliberately did not.

This supersedes `NODE-EXPRESS-MIGRATION-CONTEXT.md`, which was the *plan* written
before the work started. This is the *result*. For the product itself — the
competition, the research, what Sahaay is for — see `PROJECT-CONTEXT.md`. For how
to work in the code, see `PROJECT-GUIDE.md`.

---

## 1. Why we changed

The project worked. It was not rewritten because it was broken.

It was rewritten because of a mismatch between **who wrote it** and **who has to
live with it**. The working version was Python and FastAPI — Pydantic models,
dependency injection, async route handlers, decorators. The person who has to
maintain it, extend it during the event, and stand in front of judges and explain
it, works in Express, HTML, CSS and JavaScript.

That gap is not a small inconvenience. A stack you cannot explain under questioning
is a liability no matter how correct it is, and a codebase you cannot confidently
edit at 2am the night before a demo is worse than a slightly less elegant one you
can. The deciding question was never "which stack is better" — it was **"which
stack can this team actually own?"**

There was a second, quieter reason. The original design had the browser talking to
a Python server on port 8000 while pages were served from somewhere else. That
meant CORS configuration, two things to start, and two mental models for "where
does this request go". Collapsing to a single Express server the browser always
talks to removed a whole category of confusion.

**What we were not trying to do:** make it faster, make it prettier, or add
features. Same product, same behaviour, same design — different implementation
language. Any visible change would have been a failure of the migration.

---

## 2. What we changed to

**Node.js + Express + EJS**, on port 3000, as the one server the browser knows
about. Plain `app.get`, `app.post`, `req`, `res`. Eight pages, JSON routes,
static files. Nothing clever.

Everything the application *decides* was rewritten in JavaScript:

- eligibility rules and near-miss explanations
- repayment cost and instalment schedules
- routing — which office an applicant should actually walk into
- ranking, and the "wrong door cost" the pitch leads with
- accounts, saved profiles, the 14-entry catalogue, notification preview

**One thing stayed in Python, on purpose:** the local AI. Whisper for speech,
Ollama for pulling form fields out of what someone said, and the grounded
assistant. That code was already working, already tested, and rewriting a local
speech-and-LLM pipeline in Node would have been weeks of risk for zero product
gain. It now lives in `python-ai/` as a small service on port 8001 that does
nothing but those three jobs.

The browser never calls port 8001. Express forwards those requests. The team has
**one web server to understand and run**; the Python process is an internal
dependency, not a second application.

```
Before                              After

Browser                             Browser
   ↓                                   ↓
Python / FastAPI  :8000             Express  :3000  ← everything the user does
   • pages                             • pages, JSON, all decisions
   • all JSON                          ↓  (speech + assistant only)
   • all decisions                  Python  :8001
   • Whisper + Ollama                  • Whisper, Ollama, assistant
```

---

## 3. This was a rewrite, not a rename

Worth stating plainly, because it is the part people assume was easier than it was.

Renaming `.py` to `.js` does nothing. The rule engine, the cost calculator, the
router and the catalogue logic were **reimplemented** in JavaScript. Roughly 2,780
lines of new code, replacing about 3,140 lines of Python.

The standard was not "the new version looks right". It was **"the new version
returns exactly what the old one returned, for the same input."** Before any
JavaScript was written, the Python engine was run across every test persona, every
scheme, every channel and every state, and its answers were saved as fixtures. The
JavaScript is tested against those saved answers, to the rupee.

Result: **47 tests, zero differences.** No rate, verdict, threshold, instalment,
loan amount, near-miss sentence or office recommendation differs from the Python
version anywhere in that fixture set.

Once that was proven, the old Python engine (`engine/rules.py`, `cost.py`,
`router.py`, `recommend.py`, `explain.py`) and the old portal routes and account
storage (`portal/routes.py`, `portal/store.py`) had done their job as the proof
standard and were removed, along with the Python test suite written against
them. Their answers live on as the golden fixtures above — the code that
produced those answers does not need to keep sitting in the repo pretending to
still be a second implementation. What remains in `backend/` is only the AI
code `python-ai/` actually imports; see `PROJECT-GUIDE.md` §3.

Three things nearly broke that quietly, and are worth knowing about because they
are invisible until they cost you a wrong number on screen:

1. **Rounding.** Python rounds `.5` to the nearest *even* number; JavaScript
   rounds it up. `round(0.125, 2)` is `0.12` in Python and `0.13` in JavaScript.
   Instalments round twice per period, so this drifts. `server/services/engine/py.js`
   exists solely to reproduce Python's behaviour, and was checked against 413
   values generated by Python itself.
2. **Floating-point grouping.** `a * b / 100 * c / 12` and `a * b / 100 / 12 * c`
   give different last digits. The arithmetic is grouped exactly as the Python was.
3. **Hindi text encoding.** Some Devanagari characters have two encodings that
   look identical but compare unequal. Retyped Hindi strings silently failed
   comparison; every one is now copied from the original source.

---

## 4. What was deliberately kept, unchanged

- **The look.** The eight pages are the same files. Express renders them through
  EJS, but they contain no EJS syntax yet and are still plain HTML. The migration
  was not permission to redesign the portal.
- **All 14 catalogue entries** — 5 open with full logic, 5 informational, 4 closed
  but still discoverable.
- **The three differentiators**: explaining a rejection or near-miss; routing
  around weak channels using real published state utilisation; letting a
  Hindi/English voice user correct what was understood before anything is decided.
- **The honest stubs.** Login is two accounts with plain-text passwords and says
  so. The WhatsApp notification is a preview that admits it sends nothing. Neither
  was upgraded into security theatre.
- **The wizard works without login.** It is the accessibility path, not decoration.

---

## 5. What is still open

1. **`scripts/build_db.py` is missing.** `data/sahidwar.sqlite` is normally
   compiled from the JSON source files, but that compiler is not in this repo. The
   compiled database is therefore committed directly, and editing
   `data/schemes.json` alone will not change what the app shows. This affects both
   stacks equally and should be resolved before anyone relies on editing the JSON.

2. **`POST /packet` does not exist.** Older documents list it as built. It never
   was, in either version. The print button uses the browser's own print dialog.
   A real application-packet generator is a separate feature, not a gap to paper
   over.

3. **The `sahidwar.sqlite` filename** is a leftover from the project's earlier
   working name. Nothing user-facing says SahiDwar; renaming the file was judged
   not worth the risk of missing a reference. Cosmetic, and deliberate.

4. **The demo photo** (`uploads/sunita.jpg`) was originally drawn by a Pillow
   script that lived in the now-removed `portal/store.py`. Nothing regenerates
   it if it is ever deleted — `/meta/health` reports the absence honestly
   instead of the page silently serving a broken image. Keep the file.

---

## 6. The one-paragraph version

Sahaay decides who qualifies for which NSFDC loan, what it will cost, and which
office to walk into — using published figures and plain rules, never a language
model. It used to be a Python application. It is now an Express application,
because the team can read, explain and maintain Express, and a stack you cannot
explain is a stack you do not control. The local AI that turns Hindi speech into
form fields stayed in Python, behind a narrow internal boundary, because it worked
and rewriting it would have bought nothing. Every decision the old version made,
the new one makes identically — verified against the old version's own answers,
to the rupee.
