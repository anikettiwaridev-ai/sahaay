# The demo — what to show, in what order, and what it proves

For the video and for the live walkthrough. Roughly three minutes.

## First: what you are actually claiming

Three things, and only three. Every other feature exists to make the site look like a
real portal — these are why you win.

1. **We explain a "no."** Every other portal shows you an empty list or a wall of
   criteria. We say: *"Term Loan needs ₹1,40,001. You asked for ₹1,20,000. Raise it and
   Term Loan opens at 8% over seven years."*
2. **We tell you which door is actually open.** Parliament reported in August 2026 that
   State Channelizing Agencies are non-performing in fourteen states, and that Telangana
   and Ladakh have none at all. We route around them, using NSFDC's own published
   utilisation data — and we show what the wrong door costs. **Nobody else does this at
   all.**
3. **It works for someone who cannot read.** Voice, in Hindi, with the screen reading
   your answer back before anything is decided. 89% of NSFDC's own beneficiaries did not
   finish matriculation.

If you only get one sentence: **"Other portals tell you a scheme exists. We tell you
whether you qualify, what it will cost, and which office to walk into — and if you don't
qualify, exactly what would change that."**

---

## The walkthrough

### 1 · Home — 15 seconds
Open `index.html`. Let the four numbers sit on screen.

> "There are about sixty lakh Scheduled Caste-owned businesses in India. NSFDC — the
> corporation built for them — reached fifty-nine thousand people last year, in its best
> year in thirty-seven years. That is roughly one per cent."

### 2 · Browse without logging in — 20 seconds
Click **Browse all schemes**. Fourteen cards.

Filter to **Education** — two appear. Filter to **Loan** — the rest. Type "mahila" in the
search box — **Mahila Samriddhi Yojana** appears, greyed, marked *closed to new
applications*.

> "Fourteen schemes in one place, filterable. And note this one — Mahila Samriddhi
> Yojana. It is closed, but people still search for it by name, so we show it and say so
> honestly rather than returning nothing."

**Proves:** a real catalogue, and honesty about data.

### 3 · One scheme in detail — 20 seconds
Click **Micro Finance Scheme**. Eligibility, documents, how to apply.

> "This is what myScheme gives you, and where it stops — it tells you the scheme exists
> and sends you to another website."

Then click **Am I eligible?**

> "Ours answers the question."

**Proves:** the differentiation, at the exact point where every other portal gives up.

### 4 · Log in and show the profile — 20 seconds
Sign in as **sunita / demo123**. The profile is already filled: Sunita Devi, Bhopal,
tailoring, family income ₹2.4 lakh, needs ₹1.2 lakh, eighth pass, photo.

Scroll to the notification card.

> "She has given a mobile number, so when a new scheme matches her profile she gets a
> message. The matching is real; delivery is a stub in this prototype."

**Proves:** profiles persist across devices — and say the stub out loud.

### 5 · The matches — 40 seconds. **This is the centre of the demo.**
Click **See my matches**.

> "Micro Finance Scheme, at 6.5%. A loan of ₹1,08,000 against her ₹1,20,000 project.
> Instalments quarterly, three-month moratorium."

Point at the amber card.

> "And this is the part nobody else does. Term Loan did **not** apply — because it starts
> at ₹1,40,001 and she asked for ₹1,20,000. We do not just hide it. We tell her the number
> that would change the answer."

Scroll to the door section.

> "Now — which office. Madhya Pradesh used 43.8% of its allocation last year, so we flag
> that and show her the alternatives with what each one costs."

Then the hero line.

> "The same project, at the same time, costs 6.5% through the SC corporation and 15%
> through an NBFC-MFI. **Eighteen thousand and sixty-one rupees**, on a one-lakh loan,
> decided entirely by which door she happened to walk through. Nobody tells her that
> today."

Open **Why this answer?**

> "And every one of those decisions is a published rule, not a guess. You can check each
> one against nsfdc.nic.in."

**Proves:** USP 1 and USP 2, plus provability.

### 6 · The assistant — 30 seconds
Go to **Assistant**. Type in Hindi: *"मुझे कौन सी योजना मिल सकती है?"* Read the answer and
point at the citation line.

> "It answers only from NSFDC's published scheme data, and it cites which scheme it read.
> It cannot invent an interest rate, because it is not allowed to answer from anything
> else."

Then hold the microphone and say: *"मैं भोपाल में सिलाई का काम करती हूँ, मशीन के लिए एक लाख
बीस हज़ार चाहिए।"* Let the transcript appear.

> "And she can just talk. Notice the transcript is editable — if it mishears a word, she
> fixes it before anything is decided. The machine never acts on something she has not
> confirmed."

**Proves:** USP 3, and the safety design.

### 7 · Close — 15 seconds
Return to the match page, click **Print my packet**. The browser's print preview opens on
the match page — her scheme, her cost, and the office address. Hold up the printed page.

> "Fifty-seven per cent of these applications are filed at the gram panchayat counter,
> not online. So it ends on paper — what she qualifies for, what it costs, and which
> office to walk into. We don't replace PM-SURAJ. We're the front door to it."

> ⚠️ **Do not claim a generated application packet or a QR code.** `POST /packet` does not
> exist and never did — the button uses the browser's own print dialog on the match page.
> What prints is genuinely useful and genuinely enough for this line; a claim of a
> pre-filled checklist with a QR to PM-SURAJ is one a judge could ask you to demonstrate.

---

## Rules for recording

- **Rehearse the exact path twice before recording.** Never improvise an input.
- **Disconnect the network and record it that way.** It works offline; showing that is
  free credibility.
- Record at 1280×720 or larger. Zoom the browser to 110% so numbers read on a projector.
- Say the two honest caveats — notification delivery is a stub, and partner data is
  state-level not partner-level. Both cost five seconds and both remove a question you
  would otherwise be asked in Q&A.
- Keep it under three minutes. Under two is better.

## The three questions you will be asked

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
runs. The decision is a rules table built from NSFDC's published terms — **forty-seven
automated tests, twelve test personas** — and the engine was rewritten in a second
language and proved identical to the rupee against the first one's own saved answers.
It is provable, not probable.
