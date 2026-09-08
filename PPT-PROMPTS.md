# Sahaay — paste-ready PPT prompts

Seven prompts. Send **Prompt 0 once** with all three PDFs attached, then send prompts
1–6 one at a time, in order, in the same conversation.

Every prompt is self-contained: all content is written out literally. Nothing is left
for the model to look up, infer, or remember from the attachments — the attachments are
for **layout and visual style only**.

---

## PROMPT 0 — setup (send once, with the three PDFs attached)

```
I'm producing a 6-slide PPT for Smart India Hackathon 2026, idea submission round.
You will produce all six slides as finished slide images, one at a time, as I ask.

I'm attaching three PDFs. Use them strictly as follows:

1. TEMPLATE.pdf — my team's official SIH template. Use it ONLY for slide structure:
   the section headings, the SIH logo position (top right), the team-name badge
   position (top left), the slide numbering, and the overall grid. Its written
   CONTENT is out of date — ignore every word of it. Do not carry over its tech
   stack, its theme field, or its "PACKET" feature.

2. FINALIST.pdf — a real SIH Grand Finale deck. Use it ONLY for visual style:
   the density, the icon + coloured label pill + dotted-border description rows,
   the comparison tables, the coloured callout boxes, the arrow flows, the way
   headings are set. Copy NONE of its content, and do not reproduce its
   TAM/SAM/SOM market-sizing block or its revenue-streams block.

3. BUILD-SHEET.md — reference only. If anything I type in a later prompt conflicts
   with it, what I type wins.

House style, apply to all six slides:
- White background.
- Accent blue #1F5F8B. Warning amber #B26A00. Good green #2E7D32.
- Headings black and bold. Sub-headings in accent blue.
- Body text 16-18pt minimum. Never smaller.
- Every statistic gets a source line beneath it in 9pt grey.
- Content slides: text left, visual right, roughly 55/45.
- No paragraphs anywhere. Points, numbers, diagrams only.
- 16:9.

Rules:
- Reproduce all text I give you EXACTLY as written. Do not paraphrase, shorten,
  translate, or "improve" any sentence, number, or label.
- Do not invent statistics. Every number appears in my prompts; if a number is not
  in my prompt, it does not go on the slide.
- Slide 2 is the most important slide and should be the densest. Slide 3 must be
  visibly lighter than slide 2.

Reply "ready" and nothing else. Wait for my next message.
```

---

## PROMPT 1 — Title page

```
Produce Slide 1, the title page. Use TEMPLATE.pdf's title layout.

Fields, left side:

Problem Statement ID: 26092
Problem Statement Title: AI-Driven Scheme Matching for Marginalized Entrepreneurs
Theme: Smart Automation
PS Category: Software
Team ID: [leave blank]
Team Name: Sahaay

Centred beneath the fields, larger:

Sahaay · सहाय
"The right scheme. The right office. The right answer."

Nothing else on this slide. No stock imagery, no icons, no decoration.
Keep the SIH logo top right exactly as the template has it.
```

---

## PROMPT 2 — Proposed Solution

```
Produce Slide 2, heading PROPOSED SOLUTION. This is the most important slide in the
deck — make it the densest and the most designed. Use FINALIST.pdf's solution-slide
treatment as the visual model.

Sub-heading, accent blue, directly under the heading:
Sahaay — an assistant that says: this scheme, this door, this much.

Directly under the sub-heading, one paragraph-width line in plain dark text:
NSFDC's own data shows disbursement up 29% while the people it reaches is down 46%
— a channel problem, not a funding one. Sahaay fixes the channel: it names the right
scheme, prices it to the rupee, and points to an office that's actually functioning
— using NSFDC's own published numbers, not a guess.

LEFT COLUMN — four rows. Each row: an icon, then a solid accent-blue pill with white
bold text, then the description in a thin dotted-border box:

🎤  SPEAK    The applicant describes their work in Hindi, by voice. No login, no typing, no OTP.
📋  MATCH    Picks the right NSFDC scheme and shows the instalment, moratorium and total cost.
🚪  ROUTE    Finds the nearest channel partner that is actually functioning, from NSFDC's own published data.
💬  EXPLAIN  Says why — including exactly what would change a "no" into a "yes".

Under those four rows, one smaller line, no box:
61.1% of NSFDC's own beneficiaries found their scheme by word of mouth — 0% from any
digital channel. 57.2% filed at the gram panchayat. 89% never finished matriculation.

Source line under it, 9pt grey:
Source: MoSJE, Evaluation Study of NSFDC, 2020 (n = 3,300)

RIGHT COLUMN — a comparison table. Green ticks, red crosses. Bold the Sahaay column.

                                    myScheme    JanSamarth      PM-SURAJ      Sahaay
Works by voice, in Hindi               ✗        ✗ (text)           ✗            ✓
Covers NSFDC's schemes                 ✗            ✗          ✓ apply only   ✓ all 14
Explains why you were rejected         ✗            ✗              ✗            ✓
Routes to a partner that's working     ✗      ✓ generic lenders    ✗       ✓ NSFDC data
Runs fully offline                     ✗            ✗              ✗            ✓

Source line under the table, 9pt grey:
Sources: myscheme.gov.in · jansamarth.in · pmsuraj.dosje.gov.in

Directly beneath the table, a bordered callout box. The two percentages should be the
largest text on the slide:

6.5% vs 15%
The same ₹1.2 lakh project costs 6.5% through the SC corporation, 15% through an
NBFC-MFI. Same person, same project — different door. ₹18,061 more interest, over the
same three years. Nobody tells the applicant that before they queue.

Source line under the callout, 9pt grey:
Source: nsfdc.nic.in/scheme · computed on a ₹1,08,000 loan over 36 months
```

---

## PROMPT 3 — Technical Approach

```
Produce Slide 3, heading TECHNICAL APPROACH. This slide must be visibly LIGHTER than
slide 2 — fewer elements, more white space. Do not add an architecture diagram.

FAR LEFT — a vertical numbered flow, six boxes connected by downward arrows. Boxes 1
and 2 light blue with a #1F5F8B border. Box 3 light amber with a #B26A00 border.
Boxes 4, 5 and 6 light green with a #2E7D32 border.

1 · SPEAK        Hindi or English, by voice — no login
2 · UNDERSTAND   Local AI fills in a form — it does not decide
3 · CONFIRM      The screen reads it back. Nothing runs until you approve
4 · DECIDE       Rules engine: eligibility, interest, instalment schedule
5 · ROUTE        Nearest working partner + what the wrong door costs
6 · EXPLAIN      Why this answer — and what would change a "no"

Stamped across the top of the flow in red or amber capitals: NO INTERNET REQUIRED

One caption line under the flow, small:
One server the browser talks to. Express decides everything the user sees; a small
local Python process handles only speech and the assistant.

CENTRE — a callout box, the most prominent text on the slide:

"AI understands. Rules decide."
The AI only turns speech into fields. Eligibility and interest are a deterministic
rules table built from NSFDC's published terms — checkable against nsfdc.nic.in.
Proved identical, to the rupee, against an independent second implementation.

BOTTOM LEFT — a two-column strip titled: What the problem statement asks for → what we
built. Three rows. Do NOT put tick marks, crosses, or any completion status on this
strip.

1 · Smart Scheme Recommender          |  Rule engine over NSFDC's five open schemes,
project type, cost, income,           |  inside a 14-scheme catalogue. Ranks them —
education status in; best scheme out  |  and explains the ones it rules out

2 · Financial Calculator              |  Full instalment schedule from NSFDC's
EMI, loan limits, 6.5–15%,            |  published terms. Every rate and every
moratorium 3–12 months                |  moratorium in that range, read from a data
                                      |  file — never typed into code

3 · Geo-Spatial Locator & Router      |  106 partners, ranked by distance and the
nearest partner, weighted by          |  state's own published utilisation — and
fund utilisation                      |  never scoring a named bank

One line under that strip, accent blue, bold:
And one thing the problem statement doesn't ask for: when the answer is no, we say
what would make it yes.

BOTTOM STRIP — the stack, one line per layer, compact:
Frontend: HTML · CSS · JavaScript — no framework, no build step
Backend: Node.js · Express · EJS · SQLite
Voice: Whisper large-v3-turbo (runs locally)
Understanding: Qwen 2.5 3B via Ollama (runs locally)
Data: NSFDC published datasets · Standing Committee Report 25

RIGHT — leave two empty placeholder rectangles for screenshots I will paste in myself,
captioned "Explain" and "Door". Two, not three.
```

---

## PROMPT 4 — Feasibility and Viability

```
Produce Slide 4, heading FEASIBILITY AND VIABILITY. Four quadrants as rounded
rectangles, each with its own heading. Do not add a market-sizing funnel or a revenue
section — this project has no customers and is not sold.

TOP LEFT — Feasibility: it already runs
· Built and working today — an eight-page portal, end to end, on one laptop.
· Completely offline. No internet, no server, no account, no API cost.
· Runs on a ₹60,000 laptop — 6 GB graphics card, both AI models resident.
· Real data, not mock — 14 schemes and 106 channel partners, from NSFDC's own published files.

TOP RIGHT — Challenges
1. Speech accuracy across accents and dialects.
2. Scheme terms change — interest rates and ceilings get revised.
3. Partner performance data is published per state, not per partner.
4. Adoption. MeitY already built SBMS for this exact channel and no partner adopted it.

BOTTOM LEFT — Strategy for each
1. The transcript is editable and the confirm screen is mandatory — bad audio degrades to
   a half-filled form, never to a wrong answer. Production path: Bhashini, the
   government's own language stack, for all 22 languages.
2. Schemes live in a data file, not in code. A rate change is a one-line edit, no rebuild.
3. We say exactly what the data is — "this state used 43.8% of its allocation" — and never
   label a named bank. A test enforces that.
4. We are not building a destination website. It is built for the operator at the Common
   Service Centre — 5.8 lakh of them, already filing these applications.

BOTTOM RIGHT — Viability
· Zero running cost. No cloud bill, no API keys, no per-user cost.
· Deploys through infrastructure that already exists — CSCs and the panchayat counter.
· The client is already buying this. NSFDC published a tender on 2 September 2026 for an
  "AI/ML Enabled Smart Data Analytical Dashboard cum Decision Support System."

Number the challenges and the strategies so row 1 pairs with row 1, and so on.
```

---

## PROMPT 5 — Impact and Benefits

```
Produce Slide 5, heading IMPACT AND BENEFITS. The chart is the hero — give it the
left half of the slide.

LEFT HALF — a dual-axis line chart titled "Money up. People down."
Plot exactly this data. Do not extend, smooth, or adjust it.

Year      Disbursement (₹ crore)   Beneficiaries
2015-16          378.94                71,915
2016-17          478.98                82,105
2017-18          600.88               108,340
2018-19          671.21                81,431
2019-20          681.50                83,970
2020-21          548.23                94,002
2021-22          572.01                76,219
2022-23          635.95                83,988
2023-24          714.45                85,372
2024-25          611.78                41,750
2025-26          775.26                59,002

Disbursement as a line in #2E7D32 on the left axis, labelled "₹ crore".
Beneficiaries as a line in #B26A00 on the right axis, labelled "People reached".
Label only three points: the 2017-18 peak (108,340), the 2024-25 trough (41,750), and
2025-26 (₹775.26 cr / 59,002). No other data labels.

Caption under the chart, bold:
Disbursement up 29%. People reached down 46%.
A record year — for fewer people than at any point in a decade.

Source line, 9pt grey:
Source: NSFDC performance data, nsfdc.nic.in, published 12 Aug 2026

RIGHT HALF — four stacked blocks, each with a bold heading:

Who is not being reached
59.72 lakh SC-owned enterprises exist. NSFDC reached 59,002 last year — about 1%, in its
best year ever.
[9pt grey: 6th Economic Census · NSFDC FY2025-26]

Economic benefit, per person
₹18,061 saved by walking through the right door instead of the wrong one, on a single
₹1.08 lakh loan.

Social reach
67% of NSFDC's borrowers are women (39,804 of 59,002). 89% did not finish matriculation.
A voice-first Hindi interface is not a convenience for them — it is the only interface
that works.

Scalability
India runs six of these corporations on an identical model — NSFDC, NSTFDC, NBCFDC,
NSKFDC, NHFDC, NMDFC. Adding one is a data file, not new code.
```

---

## PROMPT 6 — Research and References

```
Produce Slide 6, heading RESEARCH AND REFERENCES. Four grouped blocks with bold
headings, set in two columns. These are primary government sources — set them cleanly,
not as a wall of small text.

Scheme parameters and channel partners
· NSFDC scheme terms — nsfdc.nic.in/scheme
· NSFDC channel partner lists (8 documents) — nsfdc.nic.in/our-channel-partners
· NSFDC performance datasets, published 12 Aug 2026 — nsfdc.nic.in/performance-data

Government and parliamentary record
· Standing Committee on Social Justice and Empowerment, 18th Lok Sabha, Report 25
  (Aug 2026) — 14 SCAs non-performing; Telangana and Ladakh have no SCA
· MoSJE, Evaluation Study on the Functioning of NSFDC, 2020 (n = 3,300)
· PIB Release 2250876 — NSFDC record FY2025-26 performance
· NSFDC tender, 2 Sept 2026 — AI/ML Decision Support System

Population and access data
· 6th Economic Census — SC-owned establishments
· Census 2011 — English-speaking population
· KPMG–Google, Indian Languages: Defining India's Internet

Existing platforms reviewed
· jansamarth.in · pmsuraj.dosje.gov.in · myscheme.gov.in
```

---

## PROMPT 7 — final check (send after all six)

```
Now review all six slides together as a set and fix anything that fails these checks:

1. Exactly six slides. No "important instructions" slide.
2. The words "SahiDwar", "React", "TypeScript", "Tailwind", "FastAPI", "PostgreSQL",
   "packet" and "map" appear nowhere.
3. Theme on slide 1 reads "Smart Automation".
4. Slide 3 has visibly fewer elements than slide 2.
5. The PS-coverage strip on slide 3 carries no ticks, crosses or completion status.
6. Every statistic has a 9pt grey source line.
7. No text anywhere is below 16pt.
8. No paragraph runs longer than two lines.
9. Every number matches what I gave you exactly — check ₹18,061, 106, 59,002, 108,340,
   41,750, 775.26, 61.1%, 57.2%, 89%, 29%, 46%, 67%.
10. Colours are only #1F5F8B, #B26A00, #2E7D32, black, grey and white.

List what you changed. Then export all six as a single PDF under 10 MB.
```
