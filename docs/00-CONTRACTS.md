# Contracts — read this before writing any file

**This is the most important document in the project.** It exists so that four
different people (or four different AI models) can each write a file on their own
machine, never see each other's work, and have everything link up when the files are
dropped into the same folder.

The rule: **nothing talks to anything except through what is written here.** If you need
something that is not in this document, stop and ask — do not invent it.

---

## 1. How the pieces fit

```
Browser                          Python server (already exists)
  web/*.html   ──calls──►  js/api.js  ──HTTP──►  http://127.0.0.1:8000
  web/js/*.js                                     backend/ (unchanged)
  web/css/*.css                                   data/   (unchanged)
```

There is **no build step**. No npm, no compiling. You open `web/index.html` in a
browser and it works. Scripts load with plain `<script src="...">` tags.

---

## 2. HTTP API — what the server gives you

Base URL is always `http://127.0.0.1:8000`. Everything returns JSON.

### Already built and working — do not change these

| Method | Path | Send | Get back |
|---|---|---|---|
| POST | `/intake/transcribe` | audio file | `{transcript, lang, duration_ms}` |
| POST | `/intake/extract` | `{text, lang}` | a Profile (section 4) |
| POST | `/recommend` | a Profile | `{recommendations[], near_misses[], wrong_door_cost, best_door, worst_door, rules_fired[]}` |
| POST | `/cost` | `{scheme_id, amount_inr, channel_rate_key}` | `{loan, instalment, n_instalments, total_interest, total_repayment, moratorium_months, schedule[]}` |
| POST | `/route` | `{scheme_ids[], amount_inr, lat, lon, state}` | `{routes[]}` |
| POST | `/packet` | `{profile, scheme_id, partner_id, amount_inr}` | `{...packet, packet_pdf_url}` |
| GET | `/meta/health` | — | `{ok: true}` |

### New — to be built in Track A

| Method | Path | Send | Get back |
|---|---|---|---|
| POST | `/auth/login` | `{username, password}` | `{token, user:{username, display_name}}` or 401 |
| POST | `/auth/logout` | — | `{ok:true}` |
| GET | `/auth/me` | (token in header) | `{username, display_name}` or 401 |
| GET | `/profile` | (token) | a Profile, or `{}` if none saved |
| PUT | `/profile` | a Profile | `{ok:true, profile}` |
| POST | `/profile/photo` | image file | `{photo_url}` |
| GET | `/catalogue` | — | `{schemes:[CatalogueEntry]}` — all 14, section 5 |
| GET | `/catalogue/{id}` | — | one CatalogueEntry, plus `eligibility_text[]`, `documents[]`, `how_to_apply[]` |
| POST | `/assistant/ask` | `{question, lang, profile?}` | `{answer, cited_scheme_ids[], grounded:true}` |
| GET | `/notifications/preview` | (token) | `{channel, to, message}` — what *would* be sent |

**Auth is deliberately fake.** Two hardcoded accounts, a token that is just a random
string kept in a table. It is a demo login, clearly labelled as one. Do not build real
password hashing, OTP, or sessions — it is not what is being demonstrated.

Demo accounts: `sunita` / `demo123` and `ramesh` / `demo123`.

---

## 3. JavaScript contract — the global objects

There are exactly **two** global objects. Every page uses them. Nothing else is global.

### `window.API` — defined in `js/api.js`

Every function returns a Promise that resolves to the parsed JSON, or throws on error.

```js
API.login(username, password)      // -> {token, user}
API.logout()                       // -> {ok}
API.me()                           // -> {username, display_name} | null
API.getProfile()                   // -> Profile | {}
API.saveProfile(profile)           // -> {ok, profile}
API.uploadPhoto(fileObject)        // -> {photo_url}
API.getCatalogue()                 // -> [CatalogueEntry]
API.getScheme(id)                  // -> CatalogueEntry + details
API.recommend(profile)             // -> {recommendations, near_misses, wrong_door_cost, ...}
API.cost(schemeId, amount, rateKey)// -> CostSchedule
API.route(schemeIds, amount, lat, lon, state)  // -> {routes}
API.packet(profile, schemeId, partnerId, amount) // -> {packet_pdf_url, ...}
API.ask(question, lang, profile)   // -> {answer, cited_scheme_ids}
API.transcribe(audioBlob)          // -> {transcript, lang}
API.extract(text, lang)            // -> Profile
API.notificationPreview()          // -> {channel, to, message}
```

`API` stores the auth token in `localStorage` under the key `sahaay_token` and sends
it automatically. No page needs to think about tokens.

### `window.App` — defined in `js/app.js`

```js
App.t(key)                 // translated string, current language
App.setLang('hi' | 'en')   // switch language, re-render, remember in localStorage
App.getLang()              // -> 'hi' | 'en'
App.requireAuth()          // if not logged in, redirect to login.html
App.renderNav()            // fills the <nav id="site-nav"> on every page
App.money(1234567)         // -> "₹12,34,567"
App.toast(message)         // small message at the bottom of the screen
App.qs(name)               // read a query-string parameter
```

---

## 4. The Profile object

This is the single most important data shape. It is what the engine already accepts —
do not rename its fields.

```json
{
  "lang": "hi",
  "name": "Sunita Devi",
  "is_sc": true,
  "state": "MP",
  "district": "Bhopal",
  "location": { "lat": 23.25, "lon": 77.41 },
  "purpose": "enterprise",
  "sector": "tailoring",
  "activity_text": "silai ka kaam",
  "amount_inr": 120000,
  "annual_family_income_inr": 240000,
  "education": "middle",
  "is_woman": true,
  "age": 34,
  "has_caste_certificate": true,
  "has_income_certificate": false,
  "email": "sunita@example.com",
  "mobile": "9876543210",
  "photo_url": "/uploads/sunita.jpg",
  "needs_confirmation": []
}
```

`email`, `mobile` and `photo_url` are **new** — added for the profile page and
notifications. The engine ignores them. Everything else already exists.

**Rule:** the engine refuses to run while `needs_confirmation` is not empty. If
`/recommend` returns HTTP 422, read `needs_confirmation` from the response and ask the
user those questions.

---

## 5. CatalogueEntry — how a scheme appears in the browse list

```json
{
  "id": "MFS",
  "name_en": "Micro Finance Scheme",
  "name_hi": "सूक्ष्म वित्त योजना",
  "category": "loan",
  "status": "open",
  "one_line_en": "Up to ₹1.25 lakh for a small business, at 6.5%.",
  "one_line_hi": "छोटे काम के लिए ₹1.25 लाख तक, 6.5% ब्याज पर।",
  "has_full_logic": true,
  "rate_text": "6.5%",
  "max_amount_inr": 125000
}
```

- `category` is one of: `loan` · `education` · `subsidy` · `training` · `marketing`
- `status` is one of: `open` · `informational` · `closed`
- `has_full_logic: true` means we can tell you if you qualify and what it costs.
  `false` means we show information only.

**The 14 entries.** Five with full logic, five informational, four closed.

| id | name | category | status | full logic |
|---|---|---|---|---|
| MFS | Micro Finance Scheme | loan | open | yes |
| TL | Term Loan | loan | open | yes |
| AMY | Aajeevika Micro-Finance Yojana | loan | open | yes |
| UNY | Udyam Nidhi Yojana | loan | open | yes |
| ELS | Education Loan Scheme | education | open | yes |
| VISVAS | VISVAS Yojana (interest subvention) | subsidy | informational | no |
| SEED | SEED Scheme (self-help groups) | subsidy | informational | no |
| NFSC | National Fellowship for Scheduled Castes | education | informational | no |
| SKILL | Skill Development Training | training | informational | no |
| MARKET | Marketing Support (stalls at exhibitions) | marketing | informational | no |
| MSY | Mahila Samriddhi Yojana | loan | closed | no |
| LVY | Laghu Vyavasaya Yojana | loan | closed | no |
| UTKARSH | Utkarsh | loan | closed | no |
| SUVIDHA | Suvidha | loan | closed | no |

Closed schemes are shown, greyed, marked *"no longer open to new applications"*. They
exist because older applicants know those names and will search for them. This is a
feature, not clutter — see `DEMO-SCRIPT.md`.

---

## 6. DOM element IDs — the part that makes parallel work possible

**Whoever writes the HTML must use exactly these `id` attributes. Whoever writes the
JavaScript may assume they exist and must use no others.** This is the entire trick: two
people can work on the same page without talking, as long as both obey this table.

### On every page
| id | element | what JS does with it |
|---|---|---|
| `site-nav` | `<nav>` | `App.renderNav()` fills it |
| `lang-toggle` | `<button>` | click switches Hindi/English |
| `toast` | `<div>` | `App.toast()` shows messages here |

### login.html
| id | element |
|---|---|
| `login-form` | `<form>` |
| `login-username` | `<input>` |
| `login-password` | `<input type="password">` |
| `login-error` | `<div>` — empty until a login fails |
| `login-submit` | `<button>` |

### profile.html
| id | element |
|---|---|
| `profile-form` | `<form>` |
| `pf-name` `pf-email` `pf-mobile` `pf-state` `pf-district` | `<input>` |
| `pf-income` `pf-amount` `pf-age` | `<input type="number">` |
| `pf-category` `pf-education` `pf-sector` `pf-purpose` | `<select>` |
| `pf-is-woman` `pf-caste-cert` `pf-income-cert` | `<input type="checkbox">` |
| `pf-photo` | `<input type="file">` |
| `pf-photo-preview` | `<img>` |
| `pf-save` | `<button>` |
| `pf-status` | `<div>` — "Saved" message |

### schemes.html
| id | element |
|---|---|
| `scheme-grid` | `<div>` — JS injects the cards here |
| `filter-category` | `<select>` — all / loan / education / subsidy / training / marketing |
| `filter-status` | `<select>` — all / open / closed |
| `filter-search` | `<input type="search">` |
| `scheme-count` | `<span>` — "Showing 5 of 14" |

### scheme.html
| id | element |
|---|---|
| `sc-title` `sc-category` `sc-rate` `sc-max` `sc-summary` | text containers |
| `sc-eligibility` `sc-documents` `sc-howto` | `<ul>` |
| `sc-check-btn` | `<button>` — "Am I eligible?" |
| `sc-check-result` | `<div>` |

### match.html
| id | element |
|---|---|
| `match-top` | `<div>` — the single best scheme |
| `match-others` | `<div>` — up to two more |
| `match-nearmiss` | `<div>` — the "you don't qualify because…" cards |
| `match-cost` | `<div>` — instalment, moratorium, total |
| `match-door` | `<div>` — partner list |
| `match-wrongdoor` | `<div>` — the ₹18,061 line |
| `match-why` | `<details>` — the rules that fired |

### assistant.html
| id | element |
|---|---|
| `chat-log` | `<div>` — messages appended here |
| `chat-form` | `<form>` |
| `chat-input` | `<input>` |
| `chat-send` | `<button>` |
| `mic-btn` | `<button>` — hold to record |
| `mic-status` | `<div>` — "Listening…" / "Understood:" |
| `transcript-box` | `<textarea>` — editable transcript |

### wizard.html
| id | element |
|---|---|
| `wz-step` | `<div>` — the current step's content |
| `wz-next` `wz-back` | `<button>` |
| `wz-progress` | `<div>` — "Step 3 of 6" |

---

## 7. Text and translation

Every visible string comes from `web/js/strings.js`, which defines:

```js
window.STRINGS = {
  en: { "nav.home": "Home", "nav.schemes": "Schemes", ... },
  hi: { "nav.home": "मुख्य पृष्ठ", "nav.schemes": "योजनाएँ", ... }
};
```

Both objects must have **identical key sets**. In HTML, mark translatable text with:

```html
<span data-t="nav.home">Home</span>
```

`App.setLang()` walks every `[data-t]` element and replaces its text. Never hardcode a
sentence in a page or in JavaScript.

---

## 8. Rules that stop this from breaking

1. **No page reads the API directly.** Only through `API.*`.
2. **No JavaScript invents a DOM id.** If you need a new element, add it to section 6 first.
3. **No hardcoded text.** Add a key to `strings.js` in both languages.
4. **No file imports another file.** Load order in every HTML page is fixed:
   `strings.js` → `api.js` → `app.js` → the page's own script.
5. **No framework.** No React, no jQuery, no npm. `document.querySelector` is enough.
6. **Money is formatted only by `App.money()`.** Never write `₹` and a number by hand.

---

## 9. Amendments — found during integration, 8 Sept 2026

Tracks A, B, C and D were written in parallel against sections 1–8 above. They
fitted together on the part this document actually pinned — **all 61 element
ids in §6 were correct in the HTML, and the JavaScript used no others** — and
came apart on three things it did not pin. Those three are recorded here so
the next person does not rediscover them.

### 9.1 What the contract did not fix, and now does

**a. The string keys.** §7 fixed the *mechanism* (`data-t`, `STRINGS.en` /
`STRINGS.hi`, identical key sets) and gave `nav.home` as an example, but never
enumerated the keys. Track B wrote the pages against `hero.*`, `pf.*`, `sc.*`,
`wz.*`, `ast.*`; Track C wrote `strings.js` against `match.*`, `wizard.*`,
`profile.*`, `scheme.*`. 125 of the 130 keys in the HTML resolved to nothing,
and `App.t()` returns the key when it misses, so every page rendered its own
key names. Both vocabularies now exist in `strings.js` (337 keys per language).

> **The rule:** `web/js/strings.js` is the enumerated key list. Adding a
> `data-t` to a page means adding the key there, in **both** languages, in the
> same commit.

**b. The CSS class names.** Track B styled the markup it wrote. `js/pages.js`
replaces most of that markup at runtime with nodes of its own, under different
class names — `.pill` where the page said `.cat-pill`, `.status` where it said
`.badge`, `.scheme-card-title` where it said `.scheme-title-en`. 52 of the 58
classes the JavaScript emits had no rule anywhere, so every page lost its
styling the moment its data arrived. Both vocabularies are now defined in
`web/css/style.css`, and the runtime ones are commented `js/pages.js emits
this` so neither gets deleted as dead.

> **The rule:** all styling lives in `css/gov.css` (tokens, base elements) and
> `css/style.css` (everything else). **No `<style>` block in a page** — the
> runtime markup appears on pages whose own block could not reach it.

**c. The `<option>` values.** §6 named the select ids and not their contents.
Track B wrote `SC`, `agriculture`, `retail`, `below_middle`, `12th`. The
engine validates against `Literal`s in `backend/models.py` and rejects all
five. Corrected in `profile.html`.

> **The rule:** every `value=` on a profile select is the engine's own
> vocabulary. `Purpose`, `Sector` and `Education` in `backend/models.py` are
> the list; category is `sc` · `st` · `obc` · `general`, lowercase.

### 9.2 Additions to §6 — element ids

| id | page | why |
|---|---|---|
| `sc-status` | scheme.html | The status was hardcoded "● Open", so a closed scheme read as open. |
| `sc-tenure` | scheme.html | Was hardcoded "3 Years" — MFS's figure, shown on Term Loan's page too. |
| `sc-moratorium` | scheme.html | Same, hardcoded "3 Months". |
| `wz-input-text` | wizard.html | The step-1 textarea in the static markup. |

### 9.3 Additions to §6 — the four `data-*` hooks

`js/pages.js` also looks for these. They are attributes, not ids, because more
than one may exist per page. All four were missing from the HTML, and all four
are guarded, so the features were silently dead rather than broken.

| attribute | page | what it does |
|---|---|---|
| `data-action="print-packet"` | match.html | The print button. |
| `data-use-transcript` | assistant.html | Sends the edited transcript through `API.extract()`. |
| `data-notify-preview` | profile.html | Container for `GET /notifications/preview`. |
| `data-profile-complete` | profile.html | The "8 of 11 fields" line. |

### 9.4 Corrections to §2, §4 and §5

1. **`POST /packet` does not exist.** §2 lists it under *"already built — do
   not change"*. It is not in `backend/main.py`, which says so in its own
   docstring. `DEMO-SCRIPT.md` step 7 ends on "Print my packet", so the button
   now falls back to `window.print()` against a print stylesheet that strips
   the site chrome. **That is a working close, not the PDF the contract
   describes.** Building the endpoint is still an open decision.
2. **The auth header is `Authorization: Bearer <token>`.** §2 said only
   "(token in header)". `X-Sahaay-Token` is also accepted.
3. **§4's Profile needs `location.source`.** The engine's `Location` model
   requires it (`gazetteer` · `gps` · `manual`); a profile shaped exactly as
   §4 prints it is rejected by `/recommend` with 422.
4. **§5's `rate_text` and `max_amount_inr` are nullable.** No verified rate or
   ceiling exists for the five informational and four closed schemes.
   Inventing one would be the exact failure the architecture exists to avoid.
5. **`GET /catalogue/{id}` takes `?lang=hi|en`** (default `en`) and also
   returns every list under `_en` / `_hi` suffixes, so a page switches language
   without refetching. It now also returns `tenure_text` and
   `moratorium_text` (and their suffixed pairs), `null` for the nine entries
   with no published terms.
6. **LVY is "Laghu Vyavsay Yojana"**, per `data/scheme_aliases.json`, which is
   the file the engine parses disbursement rows with. §5 spells it
   "Laghu Vyavasaya Yojana".
