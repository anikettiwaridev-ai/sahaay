# The eight pages, element by element

Every page. What is on it, what it looks like, what happens when you click.
Element `id`s are fixed in `00-CONTRACTS.md` §6 — use those exactly.

## Look and feel

A government portal that does not look like it was built in 2009. Clean, calm, obviously
official, readable at arm's length.

| | |
|---|---|
| Background | White `#FFFFFF`, section bands `#F5F7FA` |
| Primary | `#1F5F8B` (deep blue) — header, buttons, links |
| Accent bar | A thin saffron/white/green strip at the very top, 4px. One nod to officialdom, no more. |
| Good / warn / stop | `#2E7D32` · `#B26A00` · `#B3261E` |
| Text | `#1B1B1F`, secondary `#5A5A63` |
| Body size | 17px minimum. Buttons and inputs at least 48px tall. |
| Font | System stack: `system-ui, "Segoe UI", Roboto, sans-serif`. Devanagari falls back to `"Nirmala UI", "Noto Sans Devanagari"`. No web fonts to download. |
| Cards | White, 1px `#E3E8EF` border, 10px radius, subtle shadow on hover only |
| Width | Content max 1100px, centred |

**No animations beyond a 150ms colour or transform change.** No blur effects.

### The header, on every page

```
┌──────────────────────────────────────────────────────────────┐
│ ▌saffron/white/green 4px strip                               │
├──────────────────────────────────────────────────────────────┤
│ 🚪 Sahaay  सहाय        Home Schemes Assistant Profile │
│    Ministry of Social Justice & Empowerment   [हिं|EN] [Login]│
└──────────────────────────────────────────────────────────────┘
```

`<nav id="site-nav">` is filled by `App.renderNav()`. It shows **Login** or the user's
name depending on `API.me()`.

---

# index.html — Home

**Hero band** (blue background, white text)
> ## सही योजना. सही दफ़्तर. सही जानकारी.
> ### The right scheme. The right office. The right answer.
> One line: *For Scheduled Caste entrepreneurs and students — find which NSFDC scheme
> fits you, what it will cost, and which office to walk into.*
>
> Two buttons: **[ Find my scheme ]** → `wizard.html` · **[ Browse all schemes ]** → `schemes.html`

**Stat strip** — four numbers across, on the grey band. **These are real. Do not invent
user counts.**

| 59.72 lakh | 59,002 | 14 | ₹18,061 |
|---|---|---|---|
| SC-owned enterprises in India | reached by NSFDC last year | schemes in one place | saved by choosing the right office |

Small grey source line beneath: *6th Economic Census · NSFDC performance data, 2025-26*

**"How it works" — three cards**
1. **Tell us about yourself** — type, or speak in Hindi. No login needed.
2. **We check every scheme** — against NSFDC's published rules, not a guess.
3. **We tell you where to go** — the nearest office that is actually processing applications.

**"What makes this different" — three cards, the USPs**
1. **We explain a "no."** Other portals show an empty list. We say *"Term Loan needs
   ₹1,40,001 — you asked for ₹1,20,000."*
2. **We tell you which door is open.** Fourteen State Channelizing Agencies are
   non-performing. We route you around them.
3. **You can just talk.** Hindi, by voice. Because 89% of the people these schemes exist
   for did not finish school.

**Footer** — links, and *"A prototype built for Smart India Hackathon 2026 · PS SIH26092"*

---

# login.html

Small centred card, max 420px.

- Heading: **Sign in**
- Sub-line, grey: *"You don't need an account to browse schemes or check eligibility. Sign
  in to save your profile and get told when a new scheme matches you."*
- `#login-username`, `#login-password`, `#login-submit`
- `#login-error` — hidden until a failure
- A visible demo box, dashed border: **Demo accounts:** `sunita / demo123` · `ramesh / demo123`
- Link: *"Continue without signing in →"* to `schemes.html`

On success: store token, go to `profile.html`.

---

# profile.html

Requires login (`App.requireAuth()`). Two columns on desktop, stacked on mobile.

**Left — the photo card**
- `#pf-photo-preview` — 140px circle, grey placeholder initially
- `#pf-photo` — file input, labelled "Upload a photo"
- Below it: name, and "Profile complete: 8 of 11 fields"

**Right — the form** `#profile-form`

| Group | Fields |
|---|---|
| About you | `#pf-name` · `#pf-age` · `#pf-category` (SC / ST / OBC / General) · `#pf-is-woman` |
| Where you are | `#pf-state` · `#pf-district` |
| Contact | `#pf-email` · `#pf-mobile` |
| Your plan | `#pf-purpose` (business / education) · `#pf-sector` · `#pf-amount` |
| Money | `#pf-income` (annual family income) |
| Education | `#pf-education` |
| Documents you have | `#pf-caste-cert` · `#pf-income-cert` |

`#pf-save` and `#pf-status`.

**Below the form — the notification card**
> 🔔 **Tell me about new schemes**
> When a new scheme matches your profile, we will send you a message.
> *(Preview — delivery is not connected in this prototype)*
>
> A rendered chat-bubble preview from `API.notificationPreview()`:
> *"नमस्ते सुनीता — एक नई योजना आपके लिए उपयुक्त है: सूक्ष्म वित्त योजना, 6.5% ब्याज। विवरण देखें।"*

After saving, a green bar: **"Saved. [ See my matches → ]"** to `match.html`.

---

# schemes.html — the catalogue

This is the page that makes it look like a portal.

**Filter bar**, sticky under the header:
`#filter-search` (search box) · `#filter-category` · `#filter-status` · `#scheme-count`

**`#scheme-grid`** — cards, three across on desktop, one on mobile.

Each card:
```
┌────────────────────────────────┐
│ [LOAN]              ● Open     │
│ Micro Finance Scheme           │
│ सूक्ष्म वित्त योजना              │
│                                │
│ Up to ₹1.25 lakh for a small   │
│ business, at 6.5%.             │
│                                │
│ 6.5%  ·  max ₹1,25,000         │
│ [ View details → ]             │
└────────────────────────────────┘
```

- Category pill, colour-coded: loan blue · education purple · subsidy green ·
  training amber · marketing grey
- Status dot: green "Open", grey "Information only", red "Closed to new applications"
- **Closed schemes render greyed at 60% opacity** and sort last. They stay visible on
  purpose — older applicants search for "Mahila Samriddhi Yojana" and finding it, with an
  honest "this is closed, here is what replaced it", is genuinely useful.

Filtering is instant, client-side, no page reload.

---

# scheme.html — one scheme

Reached as `scheme.html?id=MFS`. Read with `App.qs('id')`.

- `#sc-title`, category pill, status
- A fact strip: `#sc-rate` · `#sc-max` · repayment period · moratorium
- `#sc-summary` — two or three sentences
- `#sc-eligibility` — who can apply, as a list
- `#sc-documents` — what to bring
- `#sc-howto` — numbered steps, ending with *"Apply through PM-SURAJ or at your State
  Channelizing Agency"*
- **`#sc-check-btn`** — "Am I eligible?" → if logged in, runs `API.recommend()` with the
  saved profile and fills `#sc-check-result` with a green "Yes, and here is the cost" or
  an amber "No — because X. Here is what would change it." If not logged in, it sends
  them to `wizard.html`.
- Source line at the bottom: *"Terms as published at nsfdc.nic.in/scheme"*

**This button is the whole differentiation.** myScheme's scheme page cannot tell you
whether you qualify. Ours can.

---

# match.html — your results

Requires a profile (from login, or from the wizard, held in `sessionStorage`).

**`#match-top`** — one large card
> **Your match: Micro Finance Scheme** · सूक्ष्म वित्त योजना
> **6.5%** — the lowest rate you qualify for
> Loan ₹1,08,000 of a ₹1,20,000 project · your share ₹12,000

**`#match-cost`** — a small table: instalment per quarter, number of instalments,
moratorium, total interest, total repayment. `App.money()` for every figure.

**`#match-nearmiss`** — amber-bordered cards. One sentence why not, one sentence what
would open it, with the number:
> **Term Loan — not yet**
> Term Loan starts at ₹1,40,001. Your project is ₹1,20,000.
> A project of ₹1,40,001 or more opens Term Loan at 8% over seven years.

**`#match-others`** — up to two more eligible schemes, small cards.

**`#match-door`** — the partner list. Each row: office name, type in plain words,
distance, rate, and a band pill showing that state's utilisation with the source. No map
required.

**`#match-wrongdoor`** — the hero line, big:
> **Choosing the right office saves you ₹18,061**
> The same ₹1.2 lakh project costs 6.5% through the SC corporation and 15% through an
> NBFC-MFI — over the same three years.

**`#match-why`** — a `<details>` element, collapsed: "Why this answer?" opens the list of
rules that fired, in plain sentences.

Buttons: **[ Print my packet ]** and **[ Ask a question → ]**

---

# assistant.html — chat and voice

Two panels on desktop, tabs on mobile.

**Left — chat**
- `#chat-log` — messages, user right, assistant left
- `#chat-form` + `#chat-input` + `#chat-send`
- Four suggestion chips above the input:
  *"मुझे कौन सी योजना मिल सकती है?"* · *"ब्याज कितना लगेगा?"* ·
  *"कौन से कागज़ चाहिए?"* · *"नज़दीकी दफ़्तर कहाँ है?"*

**Every assistant reply ends with a citation line**: *"Source: Micro Finance Scheme,
nsfdc.nic.in"*, built from `cited_scheme_ids`. If the question is outside our data, the
answer is *"I can only answer about NSFDC's schemes. For that, contact…"* — it does not
guess.

**Right — voice**
- `#mic-btn` — a large circle, hold to record
- `#mic-status` — "Listening…" → "Understood:"
- `#transcript-box` — **editable**. The user can fix what was misheard before anything
  is decided.
- **[ Use this → ]** sends the transcript through `API.extract()` and on to `match.html`

---

# wizard.html — the guided flow

Six steps in one page, `#wz-step` swapped each time. `#wz-progress` shows "Step 3 of 6".

1. **Speak or type** — big mic button, or a text box.
2. **Confirm** — every field understood, shown as an editable chip. Anything in
   `needs_confirmation` becomes a question with big buttons or a number pad. Cannot
   continue until all are answered.
3. **Your match** — same content as `#match-top`.
4. **What it costs** — the cost table.
5. **Which door** — the partner list and the wrong-door figure.
6. **Your packet** — document checklist, office address, print button, and a QR to PM-SURAJ.

At the end: *"Want to be told when a new scheme matches you? [ Create a profile ]"*

**This flow needs no login at any point.** That is the accessibility claim, and it must
stay true.
