# Sahaay — Slide build sheet

Literal, element by element. Build in Canva, export **PDF**.

**Status: rewritten 8 Sept 2026**, after the Node/Express migration. The previous
version of this sheet described *SahiDwar*, a React/TypeScript frontend on a
Python/FastAPI backend, six screens, 84 tests, and a PACKET feature. Every one of
those is now wrong. What survived, and what changed, is listed in §0 so you don't
have to diff it yourself.

---

## §0 — What survived the revamp, and what didn't

**This is the section to read first.** The good news is that roughly 70% of the old
sheet was about *research*, and research doesn't go stale when you change web
frameworks. The pitch is intact. The technical claims are not.

### Survives untouched — do not rewrite these

| Element | Slide | Why it still holds |
|---|---|---|
| All six slide headings + template rules | all | SIH's mandate, unchanged |
| House style (white, #1F5F8B, 55/45 layout, source lines) | all | Still the right call |
| PS ID 26092 · Category Software | 1 | Unchanged |
| The **6.5% vs 15% → ₹18,061** hero | 2 | **Re-verified live 8 Sept 2026.** See §7 |
| The myScheme / JanSamarth / PM-SURAJ comparison table | 2 | Still true; one row improves |
| MoSJE 2020 stats (61.1% · 0% · 57.2% · 89% · 15.3%) | 2, 5 | Primary source, unchanged |
| "AI understands. Rules decide." | 3 | **More** true now than before |
| Every quadrant of Feasibility & Viability | 4 | Only the stack line changes |
| Money-up-people-down chart + all impact numbers | 5 | Unchanged |
| The entire references slide | 6 | Unchanged |
| The Equinox layout lessons (comparison table, icon+pill+dotted box) | 2 | Still the best pattern |

### Must change — these are now false

| Was | Is | Where |
|---|---|---|
| **SahiDwar · सही द्वार** | **Sahaay · सहाय** | Slide 1, and everywhere |
| React · TypeScript · Vite · Tailwind | **HTML · CSS · JavaScript** (no framework, no build step) | Slide 3 |
| Python · FastAPI · SQLite (whole backend) | **Node.js · Express · EJS · SQLite**, Python retained *only* for Whisper + Ollama | Slide 3 |
| **84 automated tests** | **47 tests** — and a much better story behind them (§7) | Slide 3, Q&A |
| Six-step pipeline ending in **PACKET** | Six steps ending in **EXPLAIN**. Packet was never built, in either version | Slide 3 |
| "six screens" | **an eight-page portal** | Slides 2, 4 |
| "5 schemes" | **14 catalogue entries, 5 with full logic** | Slides 2, 4 |
| Screenshots from `evidence/phase3/screens/` | **That folder no longer exists.** Retake them (§8) | Slide 3 |
| "the map with the partner list" | **There is no map.** It is a ranked partner list with distances | Slide 3 caption |

### The evaluation instructions, and what they change

The instructions issued with the submission say two things that between them re-weight
this whole deck:

> "The teams will primarily be evaluated on the quality of their idea, innovation,
> originality, and the extent to which the proposed solution effectively addresses the
> given Problem Statement."
>
> "You are expected to explain your technical approach **briefly**. There is no need to
> provide an exhaustive technical implementation at this stage. Focus more on what you
> are proposing, what makes your solution innovative, and how it addresses the problem
> effectively."

**Read plainly: slide 2 is most of the grade, and slide 3 is a supporting act.** That
inverts the instinct most technical teams have, which is to load the technical slide up
as proof of competence. Two concrete consequences, both applied below:

1. **Slide 2 gains** an explicit "how it addresses the problem statement" sentence, so
   the named grading criterion has an obvious place to land.
2. **Slide 3 loses** its architecture diagram and gets a shortened callout. Not because
   those were wrong — because "brief" is an instruction, and spending a third of the
   technical slide on ports and processes is the opposite of it.

This is also the reason not to panic about the smaller test count (§7). Nobody is
scoring test counts at this stage.

### What the finalist deck actually does (verified, not second-hand)

The Equinox "CertiFy" deck (PS 25029, SIH 2025) is embedded as images on pages 29–34 of
the hackathons guide PDF. Having now read it directly rather than trusting a summary,
three corrections and one confirmation:

- **Confirmed:** the "icon + coloured label pill + dotted-border description" row pattern
  is real and is on their solution slide. Worth copying — it's on slide 2 below.
- **Correction:** their ✅/❌ comparison table is on their **Impact** slide, not their
  solution slide. Ours sits on slide 2. That's a deliberate difference, not an error —
  our table *is* our innovation argument, and innovation is what slide 2 is graded on.
- **Correction:** they *do* run a TAM/SAM/SOM funnel and a revenue-streams block on
  feasibility. **Still don't copy it.** They sell verification-as-a-service to
  institutions; Sahaay is free public infrastructure NSFDC would adopt. A market-sizing
  slide for a tool with no customers reads as confused, not sophisticated. Our
  zero-running-cost answer (slide 4) is the stronger one for this PS.
- **Worth knowing:** they ran **primary** research — 25 employer interviews, 8 registrars,
  7 EdTech providers, 160 survey responses. We have none of that. What we have instead is
  primary *government* sources: a parliamentary committee report, a ministry evaluation
  study, NSFDC's own performance workbook. For a government problem statement that is
  arguably the better evidence base — but if anyone asks "did you talk to users?", the
  honest answer is no, and the honest follow-up is that we used the ministry's own survey
  of 3,300 beneficiaries instead of running our own of thirty.

### New material you didn't have before — use it

1. **The parity story** (§7). The engine was rewritten in a different language and
   proved identical to the rupee against the old one's own saved answers. This is a
   *better* slide-3 line than "84 tests" ever was, and it is a genuinely unusual thing
   for a hackathon team to have done.
2. **The portal surface is real now**: browse, filter, search, accounts, saved
   profiles, a grounded assistant, notification matching. The old deck promised these
   and the old build didn't have them. That gap is closed — say so.
3. **106 channel partners**, verified live, not "a partner list".
4. **"One server"** — the browser talks to exactly one address. Judges like an
   architecture you can draw in one line.

---

## Rules from the official template (not negotiable)

- **6 slides maximum, including the title slide.** So four content slides.
- Keep the section headings exactly: TITLE PAGE · IDEA TITLE / PROPOSED SOLUTION ·
  TECHNICAL APPROACH · FEASIBILITY AND VIABILITY · IMPACT AND BENEFITS ·
  RESEARCH AND REFERENCES.
- Replace the grey placeholder bullets with your content.
- Delete the last "IMPORTANT INSTRUCTIONS" slide before exporting.
- **No paragraphs.** Points, diagrams, numbers.
- Export to PDF. The portal rejects PPTX.
- SIH logo top-right, team logo top-left.

## House style — decide once, apply to all six

- Background: white.
- One accent colour: **#1F5F8B** (deep blue). Warning amber **#B26A00**, good green **#2E7D32**.
- Headings: black, bold. Sub-headings: accent blue, underlined.
- Body text: 16–18 pt minimum. If it needs to be smaller, cut words.
- Every number that matters gets a **source line under it in 9 pt grey**.
- Layout on every content slide: **text left, visual right.** Roughly 55/45.

---

# SLIDE 1 — TITLE PAGE

| Field | Value |
|---|---|
| Problem Statement ID | **26092** |
| Problem Statement Title | **AI-Driven Scheme Matching for Marginalized Entrepreneurs** |
| Theme | **Smart Automation** |
| PS Category | **Software** |
| Team ID | *(yours from the portal)* |
| Team Name | *(exactly as registered)* |

Centred underneath:

> ## Sahaay · सहाय
> ### "The right scheme. The right office. The right answer."

Nothing else. No image.

> **Changed:** the name. Every instance of *SahiDwar* is retired. The tagline above is
> the one the live portal actually shows on its home page — use it, so the deck and the
> demo say the same words.

---

# SLIDE 2 — PROPOSED SOLUTION

Three blocks: the solution, how it addresses the problem, innovation/uniqueness.

> **This is now the most important slide in the deck.** The official evaluation
> instructions (given with the submission) say the round is scored on **"the quality of
> their idea, innovation, originality, and the extent to which the proposed solution
> effectively addresses the given Problem Statement"** — and separately, that technical
> depth is explicitly *not* required at this stage ("no need to provide an exhaustive
> technical implementation"). Read literally: this slide is close to the whole grade.
> Slide 3 is the one to keep short — see the note there.

### Heading
`PROPOSED SOLUTION` — and directly under it, in accent blue:
**Sahaay — an assistant that says: this scheme, this door, this much.**

One line under that, plain text — the explicit "addresses the problem" sentence a judge
scoring against that exact rubric line should be able to find in five seconds:

> *NSFDC's own data shows disbursement up 29% while the people it reaches is down 46% —
> a channel problem, not a funding one. Sahaay fixes the channel: it names the right
> scheme, prices it to the rupee, and points to an office that's actually functioning —
> using NSFDC's own published numbers, not a guess.*

> **New.** This sentence didn't exist in the previous version of this slide. It exists
> now because "how effectively the solution addresses the problem statement" is a named
> grading criterion, not just a nice-to-have — so it gets a sentence a judge can point at,
> not just an implication.

### Left column — "What it does" — icon + coloured label pill + dotted-border description

| Icon | Label pill | Description |
|---|---|---|
| 🎤 | **SPEAK** | The applicant describes their work in Hindi, by voice. No login, no typing, no OTP. |
| 📋 | **MATCH** | Picks the right NSFDC scheme and shows the instalment, moratorium and total cost. |
| 🚪 | **ROUTE** | Finds the nearest channel partner that is *actually functioning*, from NSFDC's own published data. |
| 💬 | **EXPLAIN** | Says *why* — including exactly what would change a "no" into a "yes". |

> **Changed:** row 4 was **PACKET** ("prints a pre-filled checklist with a QR to
> PM-SURAJ"). That feature was never built, in either version of this project — the
> print button uses the browser's own print dialog. Claiming it on a slide is the kind
> of thing a judge asks you to demo. **EXPLAIN** replaces it, and it is a stronger row
> anyway: it is differentiator #1, and it is the one thing on this slide no other portal
> in India does at all.

Under the four rows, one line, smaller, no box:

> *"61.1% of NSFDC's own beneficiaries found their scheme by word of mouth — 0% from any
> digital channel. 57.2% filed at the gram panchayat. 89% never finished matriculation."*

<sub>Source: MoSJE, Evaluation Study of NSFDC, 2020 (n = 3,300)</sub>

### Right column — the innovation table

| | myScheme | JanSamarth | PM-SURAJ | **Sahaay** |
|---|---|---|---|---|
| Works by voice, in Hindi | ❌ | ❌ (text, 8 langs) | ❌ | ✅ |
| Covers NSFDC's schemes | ❌ (discovery only) | ❌ (not on it) | ✅ (apply only) | ✅ **all 14** |
| Explains *why* you were rejected | ❌ | ❌ | ❌ | ✅ |
| Routes to a partner that's *working* | ❌ | ✅ (generic lenders) | ❌ | ✅ (NSFDC data) |
| Runs fully offline | ❌ | ❌ | ❌ | ✅ |

<sub>Sources: myscheme.gov.in · jansamarth.in · pmsuraj.dosje.gov.in</sub>

> **Changed:** row 2 now says **all 14**. The old sheet just said ✅. You have a
> 14-entry catalogue live — five open with full eligibility and cost logic, five
> informational, four closed but still findable by name. Saying "14" against three
> portals that between them cover zero NSFDC schemes properly is a stronger cell than a
> bare tick.
>
> **Verified:** "Runs fully offline" was re-checked on 8 Sept 2026. The frontend makes
> **zero** external network requests — no CDN, no fonts, no map tiles, no analytics.
> The only `http://` string in the whole `web/` folder is an SVG namespace declaration,
> which is not a request. This claim is safe.

Directly under the table, one bordered callout — still the number to lead with:

> ### 6.5% vs 15%
> The same ₹1.2 lakh project costs **6.5% through the SC corporation**, **15% through an
> NBFC-MFI**. Same person, same project — different door. **₹18,061 more interest**, over
> the same three years. Nobody tells the applicant that before they queue.

<sub>Source: nsfdc.nic.in/scheme · computed on a ₹1,08,000 loan over 36 months</sub>

---

# SLIDE 3 — TECHNICAL APPROACH

**Two things changed this slide, and they pull in the same direction.** The stack it
described no longer exists (§0), and separately, the evaluation instructions say this
round wants the technical approach explained **briefly** — "no need to provide an
exhaustive technical implementation." So the fix isn't just updating the facts, it's
also **cutting this slide down**, on purpose, to make more visual room for slide 2.

Concretely: the previous draft of this revision had a separate architecture diagram
(browser → Express → Python, as its own boxes-and-arrows visual) in the right column.
**That's cut below.** The one-server idea survives as a single caption line under the
pipeline instead of a second diagram — it's still said, just not given its own third of
the slide. If a judge wants the architecture, that's what Q&A is for; the slide's job is
"here's the approach, briefly," not "here's the implementation."

### Heading
`TECHNICAL APPROACH`

### Far left — the pipeline, as a vertical numbered flow

```
1. SPEAK          Hindi or English, by voice — no login
2. UNDERSTAND     Local AI fills in a form — it does not decide
3. CONFIRM        The screen reads it back. Nothing runs until you approve
4. DECIDE         Rules engine: eligibility, interest, instalment schedule
5. ROUTE          Nearest working partner + what the wrong door costs
6. EXPLAIN        Why this answer — and what would change a "no"
```

Stamp across the top, in red or amber: **NO INTERNET REQUIRED**

Caption directly under the flow, one line, no separate diagram:

> **One server the browser talks to.** Express decides everything the user sees; a small
> local Python process handles only speech and the assistant.

### Middle — the callout box. Most important sentence on the slide.

> ## "AI understands. Rules decide."
> The AI only turns speech into fields. Eligibility and interest are a **deterministic
> rules table** built from NSFDC's published terms — checkable against nsfdc.nic.in.
> **Proved identical, to the rupee, against an independent second implementation.**

> **Changed and shortened.** The old box claimed "84 automated tests." The real number is
> **47** — don't round it up. It's also been cut from four lines to three: the old
> version spent a full sentence on the test/persona count. Given the instructions say
> "brief," that count is Q&A material (§7 has the full version, with the three bugs it
> caught, for when someone asks), not slide copy.

### Bottom left — the PS coverage strip. **Add this; it may be the highest-value block on the deck.**

The grading criteria name "the extent to which the proposed solution effectively
addresses the given Problem Statement" as a scored dimension. SIH26092's Expected
Solution section lists **exactly three** deliverables. So answer them in their own
order, in their own words, in three rows:

| What SIH26092 asks for | What Sahaay does |
|---|---|
| **1 · Smart Scheme Recommender** — project type, cost, income, education status in; best scheme out | Rule engine over NSFDC's five open schemes, inside a 14-scheme catalogue. Ranks them — **and explains the ones it rules out** |
| **2 · Financial Calculator** — EMI, loan limits, 6.5–15%, moratorium 3–12 months | Full instalment schedule from NSFDC's published terms. Every rate and every moratorium in that range, read from a data file — never typed into code |
| **3 · Geo-Spatial Locator & Router** — nearest partner, weighted by fund utilisation | **106 partners**, ranked by distance *and* the state's own published utilisation — and never scoring a named bank |

One line under the strip, in accent blue:

> **And one thing the problem statement doesn't ask for: when the answer is no, we say
> what would make it yes.**

> **Why this is worth the space.** Every other team answering this PS will build the same
> three things — the PS tells them to. This strip does two jobs at once: it proves you
> read the problem statement properly (a scored criterion), and its third column quietly
> shows where you went past it. The closing line is the differentiator, positioned as
> *exceeding the brief* rather than as an unrelated feature. That framing is worth more
> than the same sentence would be anywhere else in the deck.

> **Honesty note, and read this before you paste.** Frame these rows as *what the
> solution does* — which at idea-submission stage is a proposal, and legitimate. Do **not**
> put build-status ticks (✅/❌) on this strip. Row 3 in particular: the distance ranking
> and the utilisation weighting are live and demonstrable, but **the map view is not
> built** (§0, and `data/tiles/` is empty because `scripts/precache_tiles.py` never
> shipped). If a judge asks "can I see the map?", the honest answer is that the locator
> ranks and routes today and the map view is the next piece — everything feeding it,
> including partner coordinates and computed distances, already works. That answer is
> fine. A ✅ next to "Geo-Spatial" followed by no map is not.

### Bottom strip — the stack, one line per layer

**Frontend:** HTML · CSS · JavaScript — no framework, no build step
**Backend:** Node.js · Express · EJS · SQLite
**Voice:** Whisper large-v3-turbo (runs locally)
**Understanding:** Qwen 2.5 3B via Ollama (runs locally)
**Data:** NSFDC published datasets · Standing Committee Report 25

> **Changed:** this entire block. It used to read "React · TypeScript · Vite · Tailwind"
> and "Python · FastAPI · SQLite."
>
> **Do not apologise for the plain frontend — lead with it.** "No framework, no build
> step" is a defensible engineering choice for a government access tool: every page is a
> file you can open, every line is one the team can explain under questioning, and there
> is no toolchain between the code and the browser. That is a *better* answer to "walk me
> through this file" than any React codebase would have been.
>
> The two local model names are verified live: `/meta/ai-health` reports
> `whisper: large-v3-turbo, device: cuda` and `ollama: qwen2.5:3b-instruct`.

### Right — screenshots only, no second diagram

The architecture diagram that used to sit here is cut (see the note at the top of this
slide) — the one-server idea is already said in the pipeline caption above. This column
is screenshots only now, which also means more room per screenshot.

Two, cropped, with one-word captions: *Match · Explain*. (Not three — see §8; a third
adds detail this slide doesn't need to spend room on.)

> **Changed:** the old sheet pointed at `evidence/phase3/screens/hi-S4.png` and friends.
> **That folder no longer exists in the repo.** You must retake them — see §8 for the
> exact three shots and how to get them.
>
> Also: one old caption said *"the map with the partner list"*. **There is no map.** The
> routing result is a ranked list of partner offices with distances in km. Do not put
> the word "map" on this slide; a judge who then asks to see the map has caught you.

---

# SLIDE 4 — FEASIBILITY AND VIABILITY

Four quadrants. This slide scores by being honest, not by being confident.

### Top left — Feasibility: it already runs

- **Built and working today** — an eight-page portal, end to end, on one laptop.
- **Completely offline.** No internet, no server, no account, no API cost.
- **Runs on a ₹60,000 laptop** — 6 GB graphics card, both AI models resident.
- **Real data, not mock** — 14 schemes and **106 channel partners**, from NSFDC's own published files.

> **Changed:** "six screens" → "an eight-page portal". "five schemes and 106 channel
> partners" → "14 schemes and 106 channel partners". The 106 figure is verified live.

### Top right — Challenges (name them; judges trust teams that do)

1. **Speech accuracy across accents and dialects.**
2. **Scheme terms change** — interest rates and ceilings get revised.
3. **Partner performance data is published per state, not per partner.**
4. **Adoption.** MeitY already built SBMS for this exact channel and no partner adopted it.

### Bottom left — Strategy for each

1. The transcript is **editable** and the confirm screen is **mandatory** — bad audio degrades to a half-filled form, never to a wrong answer. Production path: **Bhashini**, the government's own language stack, for all 22 languages.
2. Schemes live in a **data file, not in code**. A rate change is a one-line edit, no rebuild.
3. We say exactly what the data is — *"this state used 43.8% of its allocation"* — and **never** label a named bank. A test enforces that.
4. We are **not building a destination website.** It is built for the operator at the Common Service Centre — 5.8 lakh of them, already filing these applications.

> Unchanged, and all four still hold. Point 3's "43.8%" is live on the match page right
> now for Madhya Pradesh — if a judge asks to see it, you can.

### Bottom right — Viability

- **Zero running cost.** No cloud bill, no API keys, no per-user cost.
- **Deploys through infrastructure that already exists** — CSCs and the panchayat counter.
- **The client is already buying this.** NSFDC published a tender on **2 September 2026** for an "AI/ML Enabled Smart Data Analytical Dashboard cum Decision Support System."

---

# SLIDE 5 — IMPACT AND BENEFITS

**Unchanged from the old sheet.** Every number here is research, not architecture, and
none of it moved. Build it exactly as written.

### Left half — THE CHART: "Money up, people down"

Two lines, FY2015-16 → FY2025-26:
- NSFDC **disbursement** rising to ₹775.26 crore
- NSFDC **beneficiaries** falling to 59,002

Label only three points: the **FY18 peak (108,340)**, the **FY25 trough (41,750)**, and **FY26 (₹775.26 cr, 59,002)**.

Caption under it, bold:
> **Disbursement up 29%. People reached down 46%.**
> A record year — for fewer people than at any point in a decade.

<sub>Source: NSFDC performance data, nsfdc.nic.in, published 12 Aug 2026</sub>

### Right half — four stacked impact blocks

**Who is not being reached**
59.72 lakh SC-owned enterprises exist. NSFDC reached **59,002** last year — about **1%**, in its best year ever.
<sub>6th Economic Census · NSFDC FY2025-26</sub>

**Economic benefit, per person**
**₹18,061** saved by walking through the right door instead of the wrong one, on a single ₹1.08 lakh loan.

**Social reach**
**67% of NSFDC's borrowers are women** (39,804 of 59,002). **89%** did not finish matriculation. A voice-first Hindi interface is not a convenience for them — it is the only interface that works.

**Scalability**
India runs **six** of these corporations on an identical model — NSFDC, NSTFDC, NBCFDC, NSKFDC, NHFDC, NMDFC. Adding one is **a data file, not new code.**

---

# SLIDE 6 — RESEARCH AND REFERENCES

**Unchanged.** These are primary government sources and none of them expired.

**Scheme parameters and channel partners**
- NSFDC scheme terms — nsfdc.nic.in/scheme
- NSFDC channel partner lists (8 documents) — nsfdc.nic.in/our-channel-partners
- NSFDC performance datasets, published 12 Aug 2026 — nsfdc.nic.in/performance-data

**Government and parliamentary record**
- Standing Committee on Social Justice and Empowerment, 18th Lok Sabha, **Report 25** (Aug 2026) — 14 SCAs non-performing; Telangana and Ladakh have no SCA
- MoSJE, **Evaluation Study on the Functioning of NSFDC**, 2020 (n = 3,300)
- PIB Release 2250876 — NSFDC record FY2025-26 performance
- NSFDC tender, 2 Sept 2026 — AI/ML Decision Support System

**Population and access data**
- 6th Economic Census — SC-owned establishments
- Census 2011 — English-speaking population
- KPMG–Google, *Indian Languages: Defining India's Internet*

**Existing platforms reviewed**
- jansamarth.in · pmsuraj.dosje.gov.in · myscheme.gov.in

---

## §7 — The parity story (read before you write slide 3)

You lost 37 tests and gained a much better claim. Here is the claim, in the words to
use if a judge asks **"how do you know your numbers are right?"**:

> "The engine was originally written in Python. When we moved the project to
> Node/Express, we didn't translate it and hope. Before writing a line of JavaScript, we
> ran the Python engine across every test persona, every scheme, every channel and every
> state, and saved its exact answers to disk. The JavaScript is tested against those
> saved answers — to the rupee. 47 tests, zero differences. No rate, verdict, threshold,
> instalment, loan amount, near-miss sentence or office recommendation differs anywhere."

Then, if they push, the three things that nearly broke it — these are the details that
make the story credible rather than boastful:

1. **Rounding.** Python rounds `.5` to the nearest *even* number; JavaScript rounds up.
   `round(0.125, 2)` is `0.12` in Python, `0.13` in JavaScript. Instalments round twice
   per period, so it drifts. One module exists solely to reproduce Python's behaviour,
   checked against 413 values generated by Python itself.
2. **Floating-point grouping.** `a * b / 100 * c / 12` and `a * b / 100 / 12 * c` give
   different last digits. The arithmetic is grouped exactly as the Python was.
3. **Hindi text encoding.** Some Devanagari characters have two byte encodings that look
   identical but compare unequal. Retyped Hindi strings silently failed comparison; every
   one is now copied from the original source.

**Why this beats "84 tests":** anyone can write 84 tests that assert what their own code
already does. Almost nobody has an independent second implementation to check against.
You do — and you can name the three bugs it caught.

Verified 8 Sept 2026: `cd server && npm test` → **47 pass, 0 fail**, in about 2 seconds.

---

## §8 — The screenshots: retake these two

`evidence/phase3/screens/` is gone. Take fresh ones. Start both processes (see
`PROJECT-GUIDE.md` §1), sign in as `sunita / demo123`, keep the language on **हिं**.

**Take two, not three.** Slide 3 is being kept deliberately brief, and two larger, legible
screenshots beat three cramped ones. These two *are* the differentiators — the third
(the top match card) is the least distinctive of the set, because "here is your result"
is the one thing every portal can already show.

| # | Where | What must be in frame | Caption |
|---|---|---|---|
| 1 | `/match.html`, scroll to the amber near-miss | *मियादी ऋण ₹1,40,001 से शुरू होती है। आपका काम ₹1,20,000 का है।* | **Explain** |
| 2 | `/match.html`, scroll to routing | The **₹18,061** headline + the partner list with *43.8% आवंटन* warning | **Door** |

If you end up with room for a third, the top card (*आपकी योजना: सूक्ष्म वित्त योजना* ·
**6.5% — सबसे कम दर जिसके आप पात्र हैं**) captioned **Match** is the one to add back.

**How:** browser at 110% zoom, window 1280×720 or larger, crop the browser chrome out.
Do not use a phone camera on the screen.

---

## The visuals, and how to make each one

| # | Visual | Slide | How |
|---|---|---|---|
| 1 | The 6-step pipeline flow | 3 | **Mermaid** — source below |
| 2 | Money-up-people-down chart | 5 | **Ask me** — I'll generate it from the CSV as a PNG. Don't hand-draw it |
| 3 | Screenshots (two) | 3 | **Retake.** See §8 |
| 4 | 6.5% vs 15% hero | 2 | **Plain Canva text.** Two huge numbers |
| 5 | Innovation comparison table | 2 | Canva table. The strongest single element on the deck's most-graded slide |
| 6 | Four-quadrant layout | 4 | Canva shapes. Four rounded rectangles |

> **Cut this revision:** the architecture diagram (browser → Express → Python) that was
> visual #2. It's a good diagram and it's still in `HANDOFF.md` §4 if you need it for
> Q&A — it's just not slide content when the instructions say keep the technical
> approach brief.

### Mermaid — the pipeline (slide 3)

Paste into **mermaid.live**, export PNG or SVG.

```mermaid
flowchart TD
    A["1 · SPEAK<br/>Hindi or English, by voice"] --> B["2 · UNDERSTAND<br/>Local AI fills the form<br/><i>it does not decide</i>"]
    B --> C["3 · CONFIRM<br/>The screen reads it back<br/><i>nothing runs until you approve</i>"]
    C --> D["4 · DECIDE<br/>Rules engine · eligibility<br/>interest · instalment"]
    D --> E["5 · ROUTE<br/>Nearest working partner<br/>+ what the wrong door costs"]
    E --> F["6 · EXPLAIN<br/>Why this answer<br/><i>and what would change a no</i>"]

    style A fill:#E4EEF5,stroke:#1F5F8B,stroke-width:2px
    style B fill:#E4EEF5,stroke:#1F5F8B,stroke-width:2px
    style C fill:#FFF4E0,stroke:#B26A00,stroke-width:2px
    style D fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px
    style E fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px
    style F fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px
```

### Mermaid — the architecture (NOT on the deck; keep for Q&A)

Cut from slide 3 this revision. Keep the source here: if a judge asks how it's built,
this is the answer, and it draws in ten seconds on a whiteboard.

```mermaid
flowchart TD
    B["Browser"] --> E["Express · port 3000<br/><b>decides everything</b><br/>eligibility · cost · routing<br/>catalogue · accounts"]
    E -.->|"speech + assistant only"| P["Python · port 8001<br/>Whisper · Ollama"]

    style B fill:#FFFFFF,stroke:#333333,stroke-width:2px
    style E fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px
    style P fill:#E4EEF5,stroke:#1F5F8B,stroke-width:2px
```

---

# Before you export

- [ ] Exactly 6 slides. Instructions slide deleted.
- [ ] **Zero occurrences of "SahiDwar"** anywhere in the deck.
- [ ] **Zero occurrences of "React", "TypeScript", "Tailwind", "FastAPI"** anywhere.
- [ ] The test count reads **47**, not 84.
- [ ] The word **"packet"** does not appear as a built feature.
- [ ] The word **"map"** does not appear on slide 3.
- [ ] Screenshots are freshly taken (§8), not from `evidence/phase3/`.
- [ ] **Slide 2 carries the explicit "addresses the problem" sentence.** It's a named
      grading criterion; don't make a judge infer it.
- [ ] **Slide 3 is visibly the lighter slide.** If it has more elements on it than slide
      2, you've ignored the instruction that said "briefly."
- [ ] **The PS coverage strip is on slide 3**, answering SIH26092's three Expected
      Solution items in their own order — with **no build-status ticks on it**.
- [ ] Theme reads **Smart Automation** — not Miscellaneous, not Agriculture/FoodTech.
- [ ] Nothing in the deck asserts a working **map**. The locator ranks and routes; the
      map view is roadmap, and gets described as roadmap.
- [ ] Every statistic has its source in small grey text.
- [ ] No paragraph longer than two lines.
- [ ] Team name and Team ID filled on slide 1.
- [ ] Exported as **PDF**, under 10 MB.
- [ ] Read it once at 50% zoom — if a number isn't readable, it's too small.
