# Sahaay — full project context

**Read this whole document before doing anything.** It is written so any AI tool —
Claude, Gemini, Codex, whatever — can pick up this project cold and understand not just
what to build, but what was tried, what was wrong, and why the current plan is what it is.

---

## 1. The competition and the problem

**Smart India Hackathon 2026**, problem statement **SIH26092**, titled "AI-Driven Scheme
Matching for Marginalized Entrepreneurs," sponsored by India's **Ministry of Social
Justice and Empowerment (MoSJE)**. Category: Software.

The title sounds general. **The actual problem statement text is specific**, and reading
it carefully mattered a great deal (see §3). It describes, without naming it outright,
the **National Scheduled Castes Finance and Development Corporation (NSFDC)** — a
government body that gives concessional loans to Scheduled Caste citizens for business
and education, but does not lend directly. It routes money through a "Channel Finance
System" — State Channelizing Agencies (SCAs), banks, and NBFC-MFIs — and applicants
struggle to know which of several loan schemes fits them, what it will cost, and which
office to actually go to.

The competition has stages: an internal college round (pitch + PPT, working prototype
optional), then a national idea-submission round via a fixed slide template, then — if
selected — a 36-hour Grand Finale build. This project is being built for the internal
round and the idea submission.

**Team name: Sahaay.** (Not the earlier working name "SahiDwar" — that name is retired.
If you see it anywhere in old files, it means the same project.)

---

## 2. What was researched, and why it matters more than it sounds

Before any building happened, a large research pass was done — reading the actual
problem statement text, NSFDC's own published website, a 2020 government evaluation
study of NSFDC (surveying 3,300 beneficiaries), a 2026 Parliamentary Standing Committee
report on NSFDC, and NSFDC's own published performance spreadsheets. This is not
background colour — the entire product design and the entire pitch narrative come
directly from these documents. If you are extending this project, read
`research/RESEARCH-MASTER.md` before changing anything about what the product claims.

**The headline findings that shaped everything:**

- NSFDC had its **highest-ever disbursement** in FY2025-26 (₹775.26 crore) — so "the
  ministry can't spend its budget" is **false** and must never be claimed. The real
  problem is the opposite and more interesting: disbursement is **up 29%** since 2017-18
  while the number of people reached is **down 46%** (108,340 → 59,002). More money,
  fewer people — a channel problem, not a funding problem.
- NSFDC's designated lending channel, State Channelizing Agencies, are — per Parliament's
  own 2026 report — **non-performing or under-performing in 14 states**, and **two
  states/UTs (Telangana, Ladakh) have no SCA at all.**
- MoSJE's own 2020 evaluation found **61.1% of successful NSFDC borrowers** heard about
  their scheme from relatives and friends; **0% from any digital channel.** 57.2% filed
  their application at the gram panchayat, not online. **89% never finished
  matriculation. 15.3% are illiterate.**
- The two big existing government portals — **myScheme** (general scheme discovery) and
  **JanSamarth** (a genuinely good credit-scheme portal with 16 schemes and 300+ lenders)
  — **do not include NSFDC's schemes at all**, and structurally cannot, because JanSamarth
  routes to registered lending institutions and SCAs are state corporations, not banks.
  This is the actual "why doesn't this already exist" answer.
- NSFDC's own published scheme terms show something concrete and quotable: **the exact
  same ₹1.2 lakh loan costs 6.5% interest through the SC corporation (SCA) channel, but
  15% through an NBFC-MFI channel** — same person, same project, different door, and
  nobody tells the applicant this before they pick a door. This became the single
  headline number of the whole pitch: **₹18,061 more interest paid, over three years, for
  walking into the wrong office.**
- NSFDC's own website lists **five currently-open credit schemes** with exact published
  interest rates, caps and moratorium periods (Micro Finance Scheme 6.5%, Term Loan 8%,
  Aajeevika Micro-Finance Yojana 15%, Udyam Nidhi Yojana 13-15%, Education Loan Scheme
  6.5%). **Correction, made 8 Sept 2026:** NSFDC's own disbursement reporting shows money
  moving under **ten** scheme names, not five, and NSFDC's PIB releases add three more
  (VISVAS Yojana, SEED Scheme, National Fellowship for Scheduled Castes) plus skill
  training and marketing support. **The real catalogue is ~14 NSFDC schemes — five
  currently open with full eligibility/cost logic, five informational-only, four closed
  to new applicants but still searched-for by name.** Earlier product decisions that
  assumed "there are only five schemes" were wrong and have been corrected.

All of this research, with full citations, primary sources, and page numbers, lives in
`research/` (carried over from the old build — see §7). Do not restate a number from
memory; look it up there.

---

## 3. The mistake in reasoning that was caught and corrected

Worth stating explicitly because it happened once already in this project's history and
is a generic risk: **an earlier pass assumed the problem statement's domain from its
title** ("Marginalized Entrepreneurs" — broad) rather than reading its actual body text,
which specifically describes Scheduled Castes and NSFDC's mechanics. Reading the source
document directly, rather than inferring from a short title, corrected months of
downstream assumptions. **Rule for this project going forward: never reason from a
title, a summary, or a filename when the actual source document is available — read it.**

The same failure mode nearly repeated with the scheme count (five vs. fourteen, above) —
caught by checking NSFDC's own disbursement spreadsheet columns rather than trusting an
earlier summary of "the five schemes."

---

## 4. The first build — what it was, and what was wrong with it

A prototype was built end-to-end: a Python/FastAPI backend implementing the eligibility
rules, EMI calculator, and partner-routing logic described above (this backend is
**good and is being kept** — see §5), plus a frontend built as a **six-screen guided
wizard**: speak → confirm → see your match → see the cost → see the nearest office → get
a printable packet. The frontend stack was **React + TypeScript + Vite + Tailwind CSS**,
with voice input via a locally-run Whisper speech-to-text model and a locally-run small
language model (via Ollama) to turn spoken/typed free text into structured form fields.

**Two serious problems surfaced once the team actually looked at this build:**

1. **It didn't match its own pitch.** The pitch deck (PPT) that had been drafted around
   this product promised: multiple Indian languages, an AI assistant you can ask
   questions to, WhatsApp/email notifications when new schemes match you, and "all
   relevant schemes in one place" with filtering. The actual six-screen wizard delivered
   none of that surface area — it was a narrow, single-path flow about five loan
   products, with no browsing, no assistant chat, no notifications, no accounts. A judge
   watching the demo after reading the deck would immediately notice the gap. **A demo
   that contradicts its own deck is worse than a smaller demo that matches it.**
2. **Nobody on the team could explain or fix the code.** The team's actual web
   development skill is **HTML, CSS, and JavaScript** — nobody knows React, TypeScript,
   Tailwind, or a build toolchain. The React codebase was organized into many nested
   folders (`frontend/src/screens/`, `components/`, `api/`, `theme/`, `i18n/`, etc.),
   which is normal professional practice but was completely opaque to the team. If
   something broke live, nobody could fix it. If a judge asked "walk me through this
   file," nobody could.

There was also a **look-and-feel** complaint: the six-screen wizard, however well it
worked, did not *look* like a government portal — no browsing, no login, no sense of
scale or officialdom — which made it feel thin as a "product" even though the underlying
logic was sound.

**What was correct and is being kept from this build:** the backend engine itself (rules,
cost maths, routing), the underlying research, the core three differentiators (explained
below), and the voice pipeline. Only the **frontend architecture** and the **product
surface area** (six screens vs. a full portal) were wrong.

---

## 5. The decision: keep the engine, rebuild the frontend as a portal

Made 8 Sept 2026, after the above was diagnosed together with the team.

**Kept exactly as-is:**
- The Python/FastAPI backend: the rules engine (five open NSFDC schemes' eligibility
  logic), the EMI/interest calculator, the partner-routing logic (which finds the nearest
  *functioning* channel partner, using NSFDC's own published state-level utilisation
  data, not fabricated per-partner risk scores — see the honesty note in §8), and the
  packet-generation logic. This has **84 passing automated tests**, including twelve
  named test personas that check specific real-world scenarios end to end.
- The data layer: NSFDC's actual published scheme terms, partner lists, and state
  utilisation figures, already parsed into structured files.
- The voice pipeline: local Whisper (speech-to-text) + local Ollama model (text-to-
  structured-profile extraction). This already works and represents real effort; it is
  not being thrown away, only re-integrated into a bigger site instead of being the
  entire site.

**Being rebuilt from scratch:**
- The entire frontend, moving from React/TypeScript/Vite/Tailwind to **plain HTML, CSS,
  and JavaScript** — no framework, no build step, no npm. A page is a `.html` file you
  can open directly in a browser. This is deliberate: the team can read, explain, and fix
  every line, which matters both for actually building it under time pressure and for
  surviving a judge's technical questions honestly.
- The product surface, from a single six-screen wizard to a **portal**: a home page with
  real statistics, a browsable and filterable scheme catalogue (all ~14 NSFDC schemes,
  not just five), a demo login and editable user profile (with photo, email, mobile), a
  dedicated results/matches page, and a dedicated assistant page with both chat and
  voice. The original six-screen guided flow is **kept as one page within this portal**
  (`wizard.html`) — it is genuinely the right interface for a first-time, low-literacy
  user, and removing it would remove the project's best accessibility argument. It is
  additive, not replaced.

**The reasoning for keeping the engine and only replacing the frontend:** the engine is
already the explainable, testable, defensible part — a plain rules table checkable
against NSFDC's own published numbers, not a black box. Rewriting it would destroy the
exact thing that makes the "how do you know it's right" answer strong. The frontend is a
thin, already-well-specified layer on top of a stable, tested API — replacing it is the
lower-risk kind of rewrite, and it's the part that was actually the problem.

---

## 6. What Sahaay actually is now — the target product

**One sentence:** A government-style web portal where a Scheduled Caste entrepreneur or
student can browse all NSFDC schemes, check (by typing or by speaking Hindi/English)
which ones they actually qualify for, see the exact interest and repayment cost, find the
nearest office that is actually functioning (not just the nearest office), understand
exactly why they were rejected if they were, and get a printable application packet — all
without needing to create an account, though creating one lets the system remember them
and eventually notify them of new matching schemes.

### The three real differentiators — the actual "why does this win"

Nothing else about the product (accounts, filtering, chat) is the unique selling point.
These three are, and they should anchor every pitch, every demo, and every design
decision:

1. **It explains a "no."** Every existing portal either shows you a scheme or doesn't.
   None say *why not, specifically, with the exact number that would change the answer*
   ("Term Loan needs ₹1,40,001 — you asked for ₹1,20,000").
2. **It routes around broken channels, using real government data.** NSFDC's own SCAs are
   non-performing in 14 states (Parliament's own words). Nothing else tells an applicant
   this or routes them to a working alternative — and shows them, concretely, that the
   wrong office costs them ₹18,061 more.
3. **It works for someone who cannot read or type well**, by voice, in Hindi, with the
   machine reading its understanding back before deciding anything (so a mis-heard word
   never becomes a wrong answer) — because the actual beneficiary population (per
   MoSJE's own data) is overwhelmingly under-educated, and no existing portal is built
   for them.

### Pages the portal now has

Home · Login (demo) · Profile (create/edit, with photo, email, mobile) · Schemes (browse
+ filter all ~14) · one Scheme in detail (with an "Am I eligible?" check) · Match results
(your ranked matches, the cost breakdown, the near-miss explanations, the office/partner
routing, the "wrong door" cost) · Assistant (chat + voice, answers only from NSFDC's own
scheme data, cites its source, refuses off-topic questions) · Wizard (the original guided
flow, kept as the low-literacy-friendly path).

### What's real vs. stubbed, said honestly (this matters for Q&A)

- **The eligibility, cost, and routing logic is completely real** — the same tested
  engine from the first build.
- **The account/login system is a deliberate demo stub** (two hardcoded username/password
  pairs) — not real authentication. The point being demonstrated is the profile
  persistence and notification *concept*, not security engineering.
- **WhatsApp/email notification "sending" is a preview only** — the matching logic (who
  now qualifies for what) is real; actually delivering a message requires business API
  approvals a student team cannot obtain in this timeframe, so the UI shows what *would*
  be sent. This should be stated plainly in the demo, not hidden.
- **The assistant is grounded, not a general chatbot** — it is only allowed to answer
  using NSFDC's own scheme data that's fed into its prompt, and it must refuse questions
  outside that (e.g., it will not answer "what's the capital of France"). This is a
  deliberate safety/credibility choice, not a limitation to apologize for: a general
  chatbot that might invent an interest rate on stage would be far worse.

---

## 7. What already exists on disk, and where

Two folders matter:

- **`C:\Users\HP\Desktop\SIH\`** — the original build. Contains `backend/` (the engine,
  to be copied into the new project unchanged), `data/` (NSFDC's parsed scheme/partner/
  utilisation data, unchanged), `research/` (all primary-source research, unchanged —
  read `research/RESEARCH-MASTER.md` first), and `frontend/` (the old React app — being
  retired, kept only as a reference/fallback, should be moved to
  `frontend-react-old/` rather than deleted).
- **`C:\Users\HP\Desktop\SIH-new\`** — the new project, being built now. Contains
  `docs/` (the full specification for the rebuild — see below) and an empty `web/`
  folder waiting for the new frontend files.

**The specification documents in `SIH-new/docs/` are the actual source of truth for the
rebuild** and should be read in full before writing any code:

- **`00-CONTRACTS.md`** — the most important file. Defines every HTTP API endpoint
  (request/response shapes), the two JavaScript global objects (`API` and `App`) every
  page is allowed to use, the exact shape of a user "Profile," the full 14-entry scheme
  catalogue, and — critically — **the exact HTML element `id` attribute every page must
  use for every interactive element.** This table of ids is what lets HTML and
  JavaScript be written separately, by different people or different AI tools, without
  either side seeing the other's work, and still have everything connect correctly when
  combined. The rule stated in that document: if you need something not defined there,
  stop and ask rather than inventing your own name for it.
- **`01-ARCHITECTURE.md`** — what's being kept vs. replaced vs. added, the technology
  choices and the one-sentence justification for each (useful for judge Q&A), the file
  layout, and an explicit non-goals list.
- **`02-PAGES.md`** — every one of the eight pages, described element by element: exact
  layout, exact copy, exact visual style (a "looks like a real but modern government
  portal" aesthetic — clean white/blue, a small tricolour accent strip, no decoration for
  its own sake).
- **`03-BUILD-BRIEFS.md`** — the work is split into independent parallel tracks (backend;
  HTML+CSS; JavaScript wiring; the assistant feature; final integration) specifically so
  that multiple people or multiple AI tools can work simultaneously rather than one
  waiting on another, with explicit acceptance criteria for each track.
- **`04-PROMPTS.md`** — ready-to-paste instructions for each track, written for different
  AI tools (some tools, like Gemini or Codex used outside of a coding-agent product, may
  not have direct filesystem access and will hand back file contents to paste in
  manually — the prompts account for this).
- **`DEMO-SCRIPT.md`** — the exact end-to-end walkthrough for the demo video/live
  presentation: what to click, what to say, and — importantly — what each step is meant
  to *prove* to a judge. Also lists the three hardest anticipated Q&A questions with
  prepared answers.

If you are an AI picking up this project: **read `00-CONTRACTS.md`, `01-ARCHITECTURE.md`,
and `02-PAGES.md` in full before writing any file.** They contain far more exact detail
than this summary document does; this document exists to explain *why* those decisions
were made, not to replace their specifics.

---

## 8. Things to be careful about, going forward

- **Never invent a number.** Every statistic used in the product or the pitch must trace
  back to `research/RESEARCH-MASTER.md` or the primary sources it cites. Do not estimate
  a "users helped" count for the home page, for example — use the real NSFDC figures.
- **Never label a specific bank or office as having a bad repayment/NPA history.** The
  routing logic only uses NSFDC's *state-level* published utilisation percentages, never
  invented per-partner risk scores — this was a deliberate legal/ethical guardrail in the
  original engine design and must be preserved.
- **The assistant must stay grounded.** Never let it answer from general knowledge about
  government schemes; it must only use the specific NSFDC data provided to it and must
  say so / refuse otherwise.
- **The five schemes with full eligibility logic are not the whole catalogue.** Don't
  accidentally regress to treating NSFDC as "five schemes" when discussing or extending
  the catalogue feature — it's fourteen, with different levels of detail per §2 above.
- **The team's real skill level is HTML/CSS/JS, not a framework.** Any future
  contribution to the frontend should honor that constraint, not quietly reintroduce a
  build step or a framework because it seems easier for an AI to generate.
- **The pitch deck (PPT) needs a substantial rewrite** to match this new product — see
  §9 below. Do not treat the old deck's content as settled.

---

## 9. The pitch deck situation (as of 8 Sept 2026)

A draft PPT exists (built against the SIH-provided idea-submission template, which is
capped at **6 slides including the title slide**, and must be exported as **PDF**, not
PPTX/PPT, to the portal). As of this writing it is **mostly unfilled**:

- **Slide 1 (title)** is filled in, but has one likely error: it lists the theme as
  "Agriculture, FoodTech & Rural Development." Research on the actual problem statement
  (see `research/PS-SIH26092.md` and `RESEARCH-MASTER.md`) indicates the correct theme is
  **"Miscellaneous."** This should be verified against the live SIH portal listing before
  submission — do not assume either value without checking.
- **Slide 2 (Proposed Solution)** has draft content, but it describes the product only
  in generic terms (a rules engine that ranks schemes and routes to a channel partner)
  and **does not yet reflect** the specific differentiators (the ₹18,061 wrong-door
  number, the explained-near-miss feature, the 14-state SCA problem) or the new portal
  surface (browsing, accounts, assistant, notifications). **Needs a full rewrite.**
- **Slide 3 (Technical Approach)** lists a tech stack — React/Next.js, FastAPI,
  PostgreSQL, a generic "NLP/LLM layer," Maps API, Notification API — that matches
  **neither** the old build (React+Vite+Tailwind, SQLite, no Postgres, no live maps API)
  **nor** the new plan (plain HTML/CSS/JS, FastAPI, SQLite). **Needs a full rewrite** to
  state the actual, real, defensible stack from `01-ARCHITECTURE.md` §3.
- **Slides 4 (Feasibility and Viability), 5 (Impact and Benefits), and 6 (Research and
  References)** are essentially empty template placeholders — nothing has been written
  yet. These should be written fresh once the portal rebuild's real feature set is
  settled, using the real research numbers from `research/RESEARCH-MASTER.md` §3 and the
  reconciled narrative in §4.

**Recommendation, not yet executed:** once the new portal is far enough along to know
its final feature set for certain (or at minimum once this context document and the specs
in `docs/` are agreed as final), rewrite all content slides against the actual, current
product — do not polish the old draft's wording, since its underlying claims no longer
match what is being built. A slide-by-slide build sheet in the old project
(`SIH/SLIDE-BUILD-SHEET.md`) exists from before this pivot and is now **stale** — useful
for its layout/visual-style lessons (drawn from analyzing real prior-year SIH finalist
and sample decks) but its actual content needs to be re-derived from the new product.

---

## 10. Where things stand right now

The specification (`docs/00-CONTRACTS.md`, `01-ARCHITECTURE.md`, `02-PAGES.md`,
`03-BUILD-BRIEFS.md`, `04-PROMPTS.md`, `DEMO-SCRIPT.md`) is complete and committed. No
code has been written yet for the new portal — `SIH-new/web/` is empty. The next step is
executing the build tracks described in `03-BUILD-BRIEFS.md`, using the ready-made
prompts in `04-PROMPTS.md`, potentially split across multiple AI tools working in
parallel (e.g., one tool on the backend additions, a separate tool on HTML/CSS, another
on JavaScript wiring) — which is exactly why `00-CONTRACTS.md` was written as precisely
as it was: so that work done separately, without the different tools/people seeing each
other's output, still fits together correctly once combined.
