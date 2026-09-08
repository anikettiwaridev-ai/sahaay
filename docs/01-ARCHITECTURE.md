# Sahaay — Architecture (portal rebuild)

**SIH26092 · AI-Driven Scheme Matching for Marginalized Entrepreneurs · MoSJE**

Written 8 Sept 2026. This replaces the previous build's architecture. The engine is
unchanged; the interface is being rebuilt as a portal in plain HTML, CSS and JavaScript
so that the team can read, explain and fix it.

---

## 1. What changed, and why

The first build was a six-screen guided flow. It worked, it was tested, and it was the
right shape for a three-day deadline. Two things made it wrong:

1. **It did not match the pitch.** The deck promises multiple languages, an assistant you
   can ask questions, notifications, and every relevant scheme in one filterable place.
   A wizard about five loans does not show any of that. A demo that contradicts its own
   deck is worse than a smaller demo that matches it.
2. **The team could not explain it.** React, TypeScript, Vite and Tailwind across forty
   files, when the team writes HTML and CSS. You cannot fix what you cannot read, and you
   cannot answer a judge's question about code you did not follow.

**What is not changing:** the Python engine. The eligibility rules, the EMI maths, the
partner routing and the ₹18,061 calculation are the actual intellectual property, they
have 84 passing tests, and they are already the explainable part — a rules table in
readable Python, not a model that guesses. Rebuilding that would throw away the one
thing that lets us say *every answer is checkable against nsfdc.nic.in*.

## 2. Keep / replace / add

| | |
|---|---|
| **Keep unchanged** | `backend/` — engine, intake, all endpoints. `data/` — schemes, partners, state utilisation, strings. The 84 tests. The voice pipeline (Whisper + Ollama). |
| **Replace** | The entire React frontend. Moved to `frontend-react-old/` — not deleted. It is evidence of work and a fallback. |
| **Add** | A small amount of backend: accounts, saved profiles, the scheme catalogue, the assistant endpoint. A new frontend in plain HTML/CSS/JS. |

## 3. The stack, and how to defend it

| Layer | What | Why, in one sentence a judge accepts |
|---|---|---|
| Frontend | **HTML, CSS, JavaScript.** No framework, no build step. | The whole team can read and change every line; a government portal does not need a framework. |
| Backend | **Python + FastAPI** | Already built and tested; the rules are plain Python anyone can read. |
| Engine | A **decision table**, not a model | Every answer is traceable to NSFDC's published terms — provable, not probable. |
| Storage | **SQLite**, one file | Zero setup, ships with the project, a judge can open it. |
| Voice | **Whisper**, local | Runs on the laptop; no internet, no data leaves the device. |
| Assistant | **Ollama** (small local model), answers only from our scheme data | Cannot invent an interest rate, because it is only allowed to quote ours. |

**The sentence that matters:** *"The AI understands what you said. Plain rules — the same
rules NSFDC publishes — decide what you qualify for."*

## 4. File layout

```
SIH-new/
  docs/                     ← specs. Read-only for builders.
  web/                      ← the whole frontend. 14 files.
    index.html              home
    login.html              demo login
    profile.html            create / edit profile
    schemes.html            browse + filter the catalogue
    scheme.html             one scheme in detail
    match.html              your matches, cost, door
    assistant.html          chat + voice
    wizard.html             the guided flow, for first-time users
    css/style.css           layout, components, typography
    css/gov.css             the government-portal look
    js/strings.js           every visible string, hi + en
    js/api.js               every server call
    js/app.js               nav, language, helpers
    js/pages.js             per-page logic (one function per page)
  backend/                  ← copied from the old repo, plus new endpoints
  data/                     ← copied from the old repo, unchanged
  uploads/                  ← profile photos
  run.bat / run.sh          starts the server, opens the browser
```

Fourteen frontend files, flat, no nesting beyond `css/` and `js/`. If a page misbehaves
you open one HTML file and one function in `pages.js`.

## 5. Who the user is, and the two ways in

The research is unchanged and still governs the design: **89% of NSFDC's beneficiaries
did not finish matriculation, 15.3% cannot read, 57.2% file at the gram panchayat.**

So there are two doors into the same engine:

- **The portal** — browse, filter, read, compare. For anyone comfortable with a website,
  and for the officer or Village Level Entrepreneur helping an applicant.
- **The guided flow** (`wizard.html`) — speak one sentence, confirm what was understood,
  get an answer. For the applicant who cannot fill a form.

Both call the same API and produce the same result. The portal is what makes it look
like a government platform; the guided flow is what makes it work for the person the
scheme exists for. **Neither replaces the other — that was the mistake in the first build.**

## 6. Accounts

An account is **optional**. Browsing and the quick check need no login. The account exists
so that:

- your profile persists across your phone and your laptop,
- your matches are saved,
- we can tell you when a new scheme matches you.

Login is a **demo login** — two hardcoded accounts, clearly labelled. We are not
demonstrating authentication, and building real OTP would be spending the week on the
least interesting part.

**The pitch line changes** from *"no login is a feature"* to **"no login required"**. Both
are true; the second matches what is on screen. Whoever owns `PITCH.md` must make that
edit, or the demo contradicts the deck again.

## 7. Notifications — what is real and what is not

- **Real:** the matching logic. When a scheme is added or a profile changes, the engine
  works out who now qualifies. That is the genuinely interesting half and it uses code
  that already exists.
- **Stubbed:** delivery. Real WhatsApp needs Business API approval that a student team
  cannot obtain. `GET /notifications/preview` returns the message that *would* be sent,
  and the profile page renders it as a preview card.

**Say this out loud in the demo.** "The matching is real; delivery is a stub" is a
sentence that costs nothing and protects you from a judge who asks.

## 8. Non-goals — write them down so nobody builds them

- No real authentication, OTP, password hashing or session security.
- No real WhatsApp or SMS sending.
- No Aadhaar or DigiLocker integration.
- No online application submission — we produce a packet and hand off to PM-SURAJ.
- No schemes outside NSFDC. The catalogue is 14 NSFDC entries; other corporations
  (NSTFDC, NBCFDC, NSKFDC, NHFDC, NMDFC) are named on the scalability slide only.
- No framework, no bundler, no TypeScript.
- No map basemap tiles — the partner list is the point; a street map is decoration.

## 9. What "done" means

A judge can, in one sitting: open the home page, browse and filter fourteen schemes
without logging in, read one scheme in detail, log in as Sunita, see a saved profile with
a photo, see her matches ranked with the near-miss explanation, see what the wrong door
would cost, ask the assistant a question in Hindi by typing or by speaking, and print a
packet. Nothing on that path may error.
