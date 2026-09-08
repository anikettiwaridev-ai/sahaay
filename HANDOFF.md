# Sahaay — the handoff guide

**Who this is for:** a teammate who knows HTML, CSS and JavaScript, and nothing about
this project. It assumes no Python, no Express experience, no framework knowledge. Read
§1 and §2, run it once with §3, then keep §5 open while you work.

Everything in this document was verified against the running application on
**8 September 2026**. Where a number comes from research rather than from the code, it
says so.

---

## 1. What Sahaay is, in sixty seconds

A Scheduled Caste entrepreneur or student wants a government loan. NSFDC — the national
corporation that exists to give it to them — does not lend directly. It routes money
through a "Channel Finance System": state corporations (SCAs), banks, and micro-finance
companies. So the applicant has three questions nobody answers for them:

1. **Which scheme do I actually qualify for?**
2. **What will it cost me?**
3. **Which office do I walk into?**

Sahaay answers all three, in Hindi or English, by voice or by typing, and — this is the
part that matters — **it explains the answer**. If you don't qualify, it tells you the
exact number that would change that. If your state's corporation is barely functioning,
it says so, using the government's own published figures, and shows you what the
alternative costs.

**The one line to remember:**

> Other portals tell you a scheme exists. We tell you whether you qualify, what it will
> cost, and which office to walk into — and if you don't qualify, exactly what would
> change that.

### The three things that make it win

Everything else — accounts, browsing, filters, chat — exists to make it look like a real
portal. These three are the actual argument:

1. **It explains a "no."** *"Term Loan needs ₹1,40,001. You asked for ₹1,20,000. Raise it
   and Term Loan opens at 8% over seven years."* No other portal in India does this.
2. **It routes around broken channels, using real government data.** Parliament's own
   August 2026 report found State Channelizing Agencies non-performing in **14 states**,
   with **Telangana and Ladakh having none at all**. Sahaay routes around them — and
   shows that the wrong door costs **₹18,061** more on a single ₹1.08 lakh loan.
3. **It works for someone who cannot read or type well** — by voice, in Hindi, with the
   screen reading its understanding back before anything is decided. Per MoSJE's own
   2020 study, **89%** of NSFDC's beneficiaries never finished matriculation and **15.3%**
   are illiterate.

---

## 2. Why the 14 files made no sense on their own

If you were handed `index.html`, `style.css`, `pages.js` and eleven friends and told
"here's the project" — that reaction was correct, and it wasn't your fault. Here's what
was missing.

**Those files are the thinnest layer of the system.** They contain almost no logic. They
draw boxes and put text in them. Every actual answer — which scheme, what interest, which
office, why not — is computed by a server that wasn't in the folder you got.

Concretely, open `web/match.html` and you'll find an empty `<div>`. Open `web/js/pages.js`
and you'll find code that fetches `/recommend` and fills that div. **Neither file
contains a single interest rate, eligibility rule, or office address.** They can't — those
live in the server and in a database. So reading the 14 files tells you *how the page is
painted* and nothing about *what it says*.

There are three more reasons they were unreadable standalone:

- **They don't run from the filesystem.** Double-clicking `index.html` gives you a broken
  page. The pages are served by a Node server that must be running.
- **There is no build step and no framework**, which is deliberate and good — but it also
  means there's no `package.json` in `web/` to hint at how it fits together.
- **The interesting half is in a second language.** The speech and assistant features are
  Python, in a different folder, on a different port.

### So what do you actually share?

**The whole repository. Not files — the Git link.**

```
https://github.com/anikettiwaridev-ai/sahaay.git
```

It's about **27 MB** in Git, so cloning is quick. It contains everything: the 14 frontend
files, the Express server, the decision engine, the Python AI service, all the NSFDC data,
the tests, and the docs.

**Two things are deliberately *not* in the repo, and she'll need to fetch them
separately:**

| What | Size | How to get it | Needed for |
|---|---|---|---|
| Whisper speech model | ~1.6 GB | **Downloads itself** on first use into `models/`. Needs internet once. | The microphone |
| Ollama + `qwen2.5:3b-instruct` | ~1.9 GB | Install Ollama, then `ollama pull qwen2.5:3b-instruct` | Turning speech into form fields; the assistant |

Both are excluded by `.gitignore` because a 3.5 GB repository is not a repository. **The
portal runs completely without either** — she can clone, `npm start`, and have a fully
working site in two minutes; only the mic and the chat need the models.

**Also point her at these, in this order:**

1. **This file** — the mental model.
2. **`PROJECT-GUIDE.md`** — the URL-to-file lookup table. The one to keep open while coding.
3. **`STACK-CONTEXT.md`** — why the stack is what it is. Read before questioning a decision.
4. **`DEMO-SCRIPT.md`** — what we're actually presenting.

---

## 3. How to run it, from nothing

### What you need installed

| Tool | Why | Check it |
|---|---|---|
| **Node.js 18+** | The portal. Non-negotiable. | `node --version` |
| **Python 3.11+** | The AI service. Optional. | `python --version` |
| **Ollama** | The language model. Optional. | `ollama list` |

### Step 1 — get the code

```bash
git clone https://github.com/anikettiwaridev-ai/sahaay.git
cd sahaay
```

### Step 2 — the portal (this is the only required step)

```bash
cd server
npm install
npm start
```

Open **http://127.0.0.1:3000**. That's it — the site works. Browse schemes, log in, check
eligibility, see costs, see office routing. Everything except the microphone and the chat.

Demo logins — there are exactly two, and they're deliberate stubs:

```
sunita / demo123
ramesh / demo123
```

### Step 3 — the AI service (optional, needed for voice + chat)

In a **second terminal**, from the project root:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn python-ai.app:app --host 127.0.0.1 --port 8001
```

And make sure Ollama is running with the model pulled:

```bash
ollama pull qwen2.5:3b-instruct
```

### Step 4 — check it's all alive

Open these two URLs in the browser:

- **http://127.0.0.1:3000/meta/health** — the portal. Should say `"ok": true`, `5` schemes,
  `106` partners, `14` catalogue entries, and an empty `problems` list.
- **http://127.0.0.1:3000/meta/ai-health** — the AI. Should say `"ok": true` and name the
  Whisper and Ollama models.

If the second one 503s, the portal still works fine. That's by design — **the demo
survives the AI not being up**, and it fails with a clear "local AI service is
unavailable" message rather than a broken page.

### Run the tests

```bash
cd server && npm test
```

**47 tests, about two seconds.** Verified passing on 8 Sept 2026. If one fails after you
edit the engine, see §10 — that's the alarm working, not a broken test.

---

## 4. The one picture you need

```
                    ┌──────────────────────────────────────┐
   Browser ───────► │   Express — port 3000                │
   (the only        │   server/app.js                      │
    thing the       │                                      │
    user ever       │   • renders the 8 pages              │
    talks to)       │   • answers every JSON call          │
                    │   • decides eligibility, cost, route │
                    └───────────────┬──────────────────────┘
                                    │  speech + assistant ONLY
                                    ▼
                    ┌──────────────────────────────────────┐
                    │   Python AI — port 8001              │
                    │   python-ai/app.py                   │
                    │                                      │
                    │   • Whisper   (speech → text)        │
                    │   • Ollama    (text → form fields)   │
                    │   • grounded assistant               │
                    └──────────────────────────────────────┘
```

**The browser never talks to port 8001.** It only ever calls `127.0.0.1:3000`. When a page
needs speech or the assistant, Express forwards that one request to Python and hands the
answer straight back. That's the entire relationship, and it lives in exactly one file:
`server/routes/ai-bridge.js`.

### The two rules that explain the whole design

**Rule 1 — The AI never decides anything.**

It turns speech into text, and text into form fields. That's all. Whether you qualify,
what it costs, and which office to visit are decided by plain JavaScript reading NSFDC's
published numbers. This is the project's core claim, so keep the line clean. If a judge
asks "what if the AI hallucinates?" the answer is: *it can only mis-hear a form field,
you see and correct that on screen before anything runs, and the decision itself never
touches a language model.*

**Rule 2 — No number is ever typed into code.**

Every rate, cap, tenure and utilisation figure is read from `data/`. If a figure is
missing, the app shows a dash. It never guesses.

---

## 5. What flows into what — one real click, all the way down

**Sunita logs in and sees her matches.** This single journey touches most of the codebase.
Follow it once and the rest of the project makes sense.

```
1.  She types  sunita / demo123  on /login.html
        web/js/pages.js   initLogin()
             ↓ calls
        web/js/api.js     API.login()
             ↓ POST /auth/login
2.  server/routes/auth.js
             ↓ asks
        services/profile-store.js   authenticate()
             ↓ reads
        data/portal.sqlite   (users table)
             ↓ back up: a token
        api.js stores it in localStorage; every later call sends it as
        "Authorization: Bearer <token>"   — no page ever handles the token itself

3.  She lands on /match.html
        pages.js   initMatch()
             ↓ GET /profile      (token attached automatically)
        routes/profile.js → profile-store.js → data/portal.sqlite
             ↓ her saved profile comes back
             ↓ POST /recommend  with that profile

4.  server/routes/matching.js          ← the important one
             ↓ first: is this profile even usable?
        services/profile-schema.js
             • if a field is missing or nonsense → 422 with the list of
               questions still to ask.  The wizard reads that list.
             ↓ profile is clean
        services/engine/recommend.js
             ├─ rules.js     which schemes is she eligible for?
             ├─ router.js    which offices can she actually reach?
             │      └─ cost.js   what does each one cost?
             └─ explain.js   say all of it, in Hindi and English

             ↓ ONE JSON response containing:
               • ranked schemes, each with its cost and its offices
               • near-misses  ("you would qualify if…")
               • wrong_door_cost — what the wrong office would cost her

5.  pages.js renders the cards. Done.
```

**Everything in step 4 is plain JavaScript.** No network calls, no AI, no database round
trip beyond the one load at startup. It runs in a few milliseconds and gives the same
answer every single time.

### What that response actually looks like

Here is the real answer for Sunita, pulled live from the running server:

```
wrong_door_cost : 18061
best door       : MFS via Punjab National Bank    — 6.5%, ₹12,743 total interest
worst door      : AMY via Grameen Development     — 15%,  ₹30,804 total interest
recommendations : MFS (rank 1) · UNY (rank 2) · AMY (rank 3)
near miss       : "Term Loan starts at ₹1,40,001. Your project is ₹1,20,000."
rules_fired     : 25 individual rule evaluations, each with its threshold
```

That `rules_fired` array is what powers the **"Why this answer?"** panel. Every decision
is a named rule with the value it saw and the threshold it checked against — which is why
a judge can argue with a *rule* instead of arguing with the code.

---

## 6. What runs what — the file map

```
server/          The web application. This is the part you maintain.
python-ai/       The AI service. One 95-line file. You'll rarely open it.
web/             The 8 pages: HTML, CSS, browser JavaScript. ← your 14 files
data/            Every real NSFDC number. The single source of truth.
backend/         Python code that python-ai/ imports. All of it is live.
docs/            The original specs. Still accurate about behaviour.
uploads/         Profile photos. Written at runtime.
models/          The Whisper model. Not in Git — downloads itself.
```

### Inside `web/` — your 14 files

| File | Lines | What it is |
|---|---|---|
| `index.html` | 155 | Home — the four big statistics |
| `login.html` | 110 | The demo sign-in |
| `profile.html` | 247 | Edit profile, photo upload, notification preview |
| `schemes.html` | 172 | Browse + filter + search all 14 |
| `scheme.html` | 154 | One scheme in detail + "Am I eligible?" |
| `match.html` | 203 | **The centre of the demo.** Results, cost, near-miss, routing |
| `wizard.html` | 112 | The guided voice flow — works with no login |
| `assistant.html` | 119 | Chat + voice |
| `css/style.css` | 1528 | Everything visual |
| `css/gov.css` | 227 | The government-portal look — tricolour strip, header |
| `js/api.js` | 142 | **The only file that talks HTTP.** Every call goes through here |
| `js/app.js` | 319 | Shared helpers — language switching, formatting, storage |
| `js/pages.js` | 1270 | **All page logic.** One `init` function per page |
| `js/strings.js` | 752 | Every visible label, in Hindi and English |

**The entire front-end router is one idea:** all eight pages load the same four scripts,
and `pages.js` looks at the filename in the URL and runs the matching `init` function.
`/match.html` → `initMatch()`. That's it. There is no framework doing anything clever.

### Inside `server/` — the part you'll actually edit

```
server/
  app.js                   Wires everything together. Start here.
  config.js                Ports and folder paths. No secrets.

  routes/                  One file per group of URLs. Thin: read the request,
                           call a service, send JSON back.
    pages.js               Serves the 8 HTML pages.
    auth.js                Login, logout, who am I.
    profile.js             Read/save the profile, upload a photo.
    catalogue.js           The 14 schemes.
    matching.js            Recommend, cost, route   ← the important one.
    notifications.js       The WhatsApp preview (a stub, honestly labelled).
    ai-bridge.js           Forwards speech + assistant to Python.
    api.js                 Bundles the above into one router for app.js.

  services/                Where the thinking happens.
    engine/                The decision engine.
      data.js              Loads the database into memory, once.
      rules.js             Eligibility — the rule table.
      cost.js              Instalments, interest, repayment schedule.
      router.js            Which office to walk into, and why.
      recommend.js         Ranks schemes; computes "wrong door cost".
      explain.js           Turns a decision into a sentence, hi + en.
      py.js                Number rounding. Do not "simplify" it — see §10.
    catalogue-service.js   Builds the 14 catalogue entries.
    profile-store.js       SQLite: users, saved profiles, tokens.
    profile-schema.js      Validates an incoming profile. Rejects nonsense.

  tests/                   47 tests. See §10.
```

**Why the pages live in `web/` and not `server/views/`:** `app.js` tells Express to look
for templates in `web/` first. The eight `.html` files are technically rendered through
EJS, but they contain no EJS syntax — they're still plain HTML you can open and edit
directly. Nothing about them changed in the migration.

### Where the numbers come from

| File | Holds | Read by |
|---|---|---|
| `data/sahidwar.sqlite` | Everything, compiled: schemes, partners, utilisation, all UI sentences in both languages | `services/engine/data.js` |
| `data/schemes.json` | The 5 schemes with full logic — rates, caps, tenures | `services/figures.js` |
| `data/catalogue.json` | The prose for all 14 catalogue entries | `services/catalogue-service.js` |
| `data/router_weights.json` | How the router scores offices | inside the sqlite, via `data.js` |
| `data/portal.sqlite` | Demo accounts, saved profiles, login tokens | `services/profile-store.js` |

> **The filename `sahidwar.sqlite` is a leftover.** "SahiDwar" was this project's earlier
> working name. Nothing a user sees says SahiDwar. Renaming the file was judged not worth
> the risk of missing a reference.

---

## 7. Every feature — and whether it's real or a stub

Being straight about this is a feature, not an embarrassment. Say the stubs out loud in
the demo; it costs five seconds and removes a question you'd otherwise get in Q&A.

| Feature | Status | Detail |
|---|---|---|
| **Eligibility decisions** | ✅ Fully real | A rule table, 25 rule evaluations on a typical profile, each checkable against nsfdc.nic.in |
| **Cost / instalment maths** | ✅ Fully real | Interest, moratorium, quarterly instalments, total repayment |
| **Near-miss explanation** | ✅ Fully real | Names the exact number that would change the answer, in both languages |
| **Office routing** | ✅ Fully real | 106 partners, ranked by distance + real published state utilisation |
| **Wrong-door cost** | ✅ Fully real | ₹18,061 for the demo persona — computed, not hardcoded |
| **Scheme catalogue** | ✅ Fully real | 14 entries, browse + filter + search |
| **Voice input (Hindi/English)** | ✅ Works | Whisper large-v3-turbo, running locally on the GPU |
| **Speech → form fields** | ✅ Works | Qwen 2.5 3B via Ollama, plus a deterministic parser. See §9 |
| **Grounded assistant** | ✅ Works | Answers only from NSFDC catalogue data; refuses everything else |
| **Profile persistence** | ✅ Real | SQLite, survives restart |
| **Photo upload** | ✅ Real | Written to `uploads/` |
| **Login** | ⚠️ **Deliberate stub** | Two accounts, plain-text passwords. Not real auth, and says so |
| **WhatsApp notification** | ⚠️ **Deliberate stub** | The *matching* is real (runs the actual engine); *delivery* is not built |
| **Printable packet** | ❌ **Not built** | The print button uses the browser's print dialog. `POST /packet` does not exist and never did |
| **Map** | ❌ **Does not exist** | Routing is a ranked list with distances in km. There is no map view |

> The last two matter for the deck. Older documents claim both. Don't put them on a slide.

---

## 8. All 14 schemes

**Five are open with full eligibility and cost logic.** These are the only ones the engine
can actually decide on:

| ID | Scheme | Purpose | Amount | Rate | Tenure | Moratorium |
|---|---|---|---|---|---|---|
| **MFS** | Micro Finance Scheme<br/>सूक्ष्म वित्त योजना | Enterprise | up to ₹1.4 L<br/>(loan cap ₹1.25 L) | **6.5%** | 36 mo | 3 mo |
| **TL** | Term Loan<br/>मियादी ऋण | Enterprise | ₹1,40,001 – ₹50 L<br/>(loan cap ₹45 L) | **8%** | 84 mo | 6 mo |
| **AMY** | Aajeevika Micro-Finance Yojana<br/>आजीविका माइक्रो-फाइनेंस योजना | Enterprise | up to ₹1.4 L | **15%** | 36 mo | 3 mo |
| **UNY** | Udyam Nidhi Yojana<br/>उद्यम निधि योजना | Enterprise | up to ₹5 L<br/>(loan cap ₹4.5 L) | **13%** coop<br/>**15%** SFB | 60 mo | 3 mo |
| **ELS** | Education Loan Scheme<br/>शिक्षा ऋण योजना | Education | up to ₹40 L | **6.5%** | 144 mo | course + 12 mo |

> **This table is the entire pitch in five rows.** MFS is 6.5% and AMY is 15% — the *same*
> ₹1.2 lakh project, the same person, the same day. The only difference is which door they
> walked through. That's the ₹18,061.
>
> Note also AMY's own data file carries the line: *Parliamentary Standing Committee (Aug
> 2026) called this 15% rate "very high."* We're not editorialising — we're quoting.

**Five are informational** — real NSFDC programmes the engine can't compute eligibility
for, shown so people searching by name find something:

| ID | Scheme | What it is |
|---|---|---|
| **VISVAS** | VISVAS Yojana | Interest subvention on a loan already taken |
| **SEED** | SEED Scheme | Support for self-help groups, not one applicant |
| **NFSC** | National Fellowship for Scheduled Castes | A fellowship for SC research scholars |
| **SKILL** | Skill Development Training | Free training in a trade — not money |
| **MARKET** | Marketing Support | A stall at an exhibition, so you can sell what you make |

**Four are closed to new applications** — but still findable, because people search for
schemes they heard about years ago and deserve to be told it closed rather than shown
nothing:

| ID | Scheme | Note |
|---|---|---|
| **MSY** | Mahila Samriddhi Yojana | Closed. Micro Finance Scheme now serves this purpose |
| **LVY** | Laghu Vyavsay Yojana | Closed |
| **UTKARSH** | Utkarsh | Closed |
| **SUVIDHA** | Suvidha | Closed |

> **If you ever see "5 schemes" in the UI, something is broken.** There's a test that
> enforces exactly fourteen.

---

## 9. Does the voice agent and the chatbot actually work?

**Yes. Both were tested live on 8 September 2026.** Here is exactly what was run and what
came back, so you're not taking anyone's word for it.

### The AI service reports healthy

`GET /meta/ai-health` returned:

```
whisper : large-v3-turbo, device: cuda
ollama  : qwen2.5:3b-instruct   (gemma2:2b also installed)
prompt  : extract_v1
```

### Speech → form fields: works, and better than expected

A Hindi sentence was posted to `/intake/extract`:

> *"मैं अनुसूचित जाति से हूँ, उत्तर प्रदेश में रहती हूँ। मुझे सिलाई का काम शुरू करना है, एक लाख बीस हजार रुपये चाहिए। सालाना आमदनी एक लाख अस्सी हजार रुपये है।"*

It came back with:

| Field | Extracted |
|---|---|
| `is_sc` | `true` |
| `state` | `UP` — **plus** lat/lon geocoded from a gazetteer |
| `purpose` | `enterprise` |
| `sector` | `tailoring` |
| `amount_inr` | `120000` |
| `annual_family_income_inr` | `180000` |
| `is_woman` | `true` — **inferred from the feminine verb form** *रहती* |
| `needs_confirmation` | `["is_sc", "annual_family_income_inr", "sector", "has_income_certificate"]` |

Two things worth understanding here:

**It's a hybrid, not just an LLM.** Every field carries a `source` — either `llm` (Qwen) or
`fallback` (a deterministic Python parser). *Both* run on every request, and it's their
**agreement** that raises confidence. A 3B model's self-reported confidence is not
evidence, so it gets one fixed confidence value and the deterministic parser is what
moves the needle. This makes the result reproducible run-to-run, which an LLM alone
would not be.

**`needs_confirmation` is the safety mechanism.** Any field the system isn't sure about
goes on that list, and **`/recommend` refuses to run at all while it's non-empty** — it
returns a 422 with the list of questions still to ask. The wizard reads that list and
asks them. So a mis-heard word can never silently become a wrong answer; it becomes a
question. `is_sc` is on a permanent always-confirm list regardless of confidence, because
the applicant must state that themselves.

There's also a guard *before* the LLM ever runs. Whisper, given silence, will happily
invent a fluent confident sentence. So three gates run first: no speech detected, fewer
than three words, or average log-probability below a floor. Any of them and the pipeline
stops and asks the person to speak again — it never feeds a hallucination into
extraction.

### The assistant: grounded, and refuses

Asked **"What is the interest rate for the Micro Finance Scheme?"**:

```json
{ "answer": "interest rate: 6.5%", "cited_scheme_ids": ["MFS"],
  "grounded": true, "refused": false }
```

Asked **"What is the capital of France?"**:

```json
{ "answer": "I can only answer from NSFDC's scheme information on this site.
             I could not find anything about that here. Try asking about a scheme,
             its interest rate, who is eligible, which documents you need,
             or how to apply.",
  "grounded": true, "refused": true, "source": "refusal" }
```

**That refusal is the feature.** Don't "improve" it into a general chatbot. A general
assistant that might invent an interest rate on stage in front of judges would be
catastrophically worse than one that politely declines. It cites which scheme it read,
and it cannot answer from its own memory.

---

## 10. Five things that will bite you

1. **`services/engine/py.js` looks pointless. It is not.** JavaScript and Python round
   `.5` differently — Python's `round(0.125, 2)` is `0.12`, JavaScript's is `0.13`.
   Instalments round twice per period, so plain `Math.round` makes repayment figures
   drift from the published ones. That file exists solely to reproduce Python's
   behaviour, and was checked against 413 values Python itself generated. Do not
   "simplify" it.

2. **Hindi text: copy, never retype.** Some Devanagari characters have two valid byte
   encodings that look identical on screen but compare unequal. Retyping a string can
   silently break a comparison. Copy-paste existing strings.

3. **Never rate a bank as good or bad.** The router ranks offices using NSFDC's own
   published *state* utilisation figures, and applies that **only to State Channelizing
   Agencies** — never to a named bank. Inventing a score for a lender would be a claim we
   can't support, and it's the first thing a judge would attack. A test enforces this.

4. **A failing engine test means a user-visible number changed.** The 47 tests aren't
   ordinary unit tests. Before the old Python engine was retired, it was run over every
   persona and scheme and its exact answers were saved to
   `server/tests/fixtures/*.golden.json`. The JavaScript is compared against those saved
   answers, to the rupee. So if you change something in `services/engine/` and a test
   fails — **you changed a number a user sees.** Either your change is wrong, or the rules
   genuinely changed on purpose, in which case edit the fixture by hand. There is no
   longer a Python script to regenerate it.

5. **Everything left in `backend/` is live.** It isn't a legacy folder — it was pruned down
   to exactly what `python-ai/app.py` still imports. Editing `backend/intake/` or
   `backend/portal/assistant.py` changes what the running AI service does.

---

## 11. "I want to change X"

| You want to… | Edit |
|---|---|
| Change page text or layout | `web/*.html` |
| Change visible wording or labels | `web/js/strings.js` |
| Change styling | `web/css/style.css`, `web/css/gov.css` |
| Change what a page does | the matching `init` function in `web/js/pages.js` |
| Add a new JSON endpoint | a file in `server/routes/`, then register it in `routes/api.js` |
| Change an eligibility rule | the rule table in `server/services/engine/rules.js` |
| Change a repayment calculation | `server/services/engine/cost.js` |
| Change how offices are ranked | `server/services/engine/router.js` |
| Change a reason or warning sentence | the `strings` table in `data/sahidwar.sqlite` |
| Change the AI prompt | `backend/intake/prompts/extract_v1.md` |

**After any change under `server/services/engine/`, run `npm test`.**

---

## 12. The demo, and what each step proves

Roughly three minutes. Full script in `DEMO-SCRIPT.md`; this is the shape of it.

| # | Step | What to say | Proves |
|---|---|---|---|
| 1 | **Home** (15s) | "60 lakh SC-owned businesses. NSFDC reached 59,000 last year — its best year in 37 years. That's about 1%." | The problem is real |
| 2 | **Browse** (20s) | Filter to Education, then search "mahila" — MSY appears, greyed, marked closed | A real catalogue, and honesty |
| 3 | **One scheme** (20s) | "This is what myScheme gives you, and where it stops." Then click **Am I eligible?** — "Ours answers the question." | The differentiation, at the exact point others give up |
| 4 | **Log in** (20s) | Sunita's profile is filled. Scroll to the notification card. "The matching is real; delivery is a stub in this prototype." | Persistence — and say the stub out loud |
| 5 | **The matches** (40s) | **The centre of the demo.** MFS at 6.5%. Then the amber card: "Term Loan starts at ₹1,40,001 and she asked for ₹1,20,000. We don't hide it — we tell her the number that would change the answer." Then routing: "MP used 43.8% of its allocation." Then: "**₹18,061**, decided entirely by which door she walked through." Open **Why this answer?** | USPs 1 and 2, plus provability |
| 6 | **Assistant** (30s) | Ask in Hindi, point at the citation line. Then use the mic: "notice the transcript is editable — she fixes it *before* anything is decided." | USP 3, and the safety design |

**Rules for recording:** rehearse the exact path twice, never improvise an input.
**Disconnect the network and record it that way** — it works offline and showing that is
free credibility. 1280×720 or larger, browser at 110% zoom. Under three minutes; under
two is better.

**Say the two honest caveats out loud** — notification delivery is a stub, and partner
data is state-level not partner-level. Ten seconds, and it removes two Q&A questions.

### The three questions you will be asked

**"How is this different from myScheme?"**
myScheme tells you a scheme exists and sends you elsewhere to apply. It cannot tell you
whether you qualify, what it will cost, or which office is functioning. Show the **Am I
eligible?** button.

**"Where does your data come from?"**
NSFDC's own published scheme page for the terms, NSFDC's published performance workbook
for the state utilisation, and the 18th Lok Sabha Standing Committee Report 25 for the
non-performing agencies. All primary sources, all on the references slide.

**"What if the AI gets it wrong?"**
The AI only turns speech into form fields, and you see and correct that before anything
runs. The decision is a rules table built from NSFDC's published terms — **47 automated
tests, 12 personas**, verified against an independent second implementation to the rupee.
It's provable, not probable.

> ⚠️ `DEMO-SCRIPT.md` still says "eighty-four automated tests" in this answer. **That
> number is stale — it's 47.** See §13.

---

## 13. Known gaps and stale claims

Nothing here is broken. These are things that will embarrass you if you don't know them.

| # | Issue | Impact |
|---|---|---|
| 1 | **`scripts/build_db.py` is missing.** `data/sahidwar.sqlite` is normally compiled from the JSON files, but the compiler isn't in the repo. The `.sqlite` is committed directly. | **Editing `data/schemes.json` alone will not change what the app shows.** Treat the `.sqlite` as the live copy |
| 2 | **`scripts/setup_models.py` is missing** too, though `.gitignore` and a code comment both reference it. | Harmless — `faster-whisper` downloads the model itself on first use |
| 3 | **`POST /packet` does not exist** and never did, in either version. | Don't claim a packet generator. The print button uses the browser dialog |
| 4 | **There is no map.** | Don't say "map" in the deck or the demo |
| 5 | **`DEMO-SCRIPT.md` says "eighty-four automated tests."** | Stale. It's **47**. Fix before anyone rehearses from it |
| 6 | **`PROJECT-CONTEXT.md` §7 and §10 are stale** — they say the frontend is unwritten and the backend is FastAPI. Both were true when written, neither is now. | Read §1–§6 of that file for the research and the reasoning; ignore §7 and §10 |
| 7 | **`web/js/api.js`** has a comment saying the server is on port 8000, a fallback `BASE` of 8000, and a dead `packet()` function. | Cosmetic — the live path uses `location.origin`, so it works. Worth a five-minute cleanup |
| 8 | **`uploads/sunita.jpg` can't be regenerated.** The Pillow script that drew it was removed. | Keep the file. `/meta/health` reports its absence honestly rather than serving a broken image |
| 9 | **The old slide deck is fully stale.** | Rebuilt — see the rewritten `SLIDE-BUILD-SHEET.md` |
