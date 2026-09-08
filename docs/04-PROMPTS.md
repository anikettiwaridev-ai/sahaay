# Paste-ready prompts

One per track. Start A, B and C at the same time, in three different places.

**Before pasting anything into a tool that cannot see your files** (Gemini, ChatGPT):
paste the full text of `00-CONTRACTS.md` first, then the prompt. That document is the
whole reason the pieces fit together.

---

## Track A — Backend · give to Claude Code, in `SIH-new/`

> Read `docs/00-CONTRACTS.md` and `docs/01-ARCHITECTURE.md` in full, then
> `docs/03-BUILD-BRIEFS.md` Track A. Build Track A exactly as specified.
>
> Start by copying `backend/` and `data/` from `C:\Users\HP\Desktop\SIH` into this
> folder. **Change nothing that already exists** — the 84 tests must still pass
> untouched. Then add the accounts, the saved profiles, the fourteen-entry catalogue and
> the assistant endpoint.
>
> The five schemes with full logic must read their rates and limits from the existing
> `data/schemes.json`. Do not retype a rate anywhere — if a number appears in two files,
> that is a bug.
>
> The assistant must answer only from the catalogue entries you put in its prompt, and
> must refuse anything outside them. Prove the refusal works.
>
> Do not write any HTML, CSS, or frontend JavaScript — another track owns those.
> Demonstrate all seven acceptance criteria with real command output, not claims.

---

## Track B — HTML and CSS · give to Gemini or Codex

> I am building a government scheme portal for India's Smart India Hackathon. I need the
> HTML and CSS only — no JavaScript logic at all.
>
> I have pasted the contracts document above. Read section 6 carefully: **every element
> your HTML creates that JavaScript will later touch must use exactly the `id` given
> there, and you must not invent any other id.** Every visible piece of text needs a
> `data-t="some.key"` attribute so it can be translated later.
>
> Build these files, one at a time, and give me each complete so I can paste it into a
> file: `index.html`, `login.html`, `profile.html`, `schemes.html`, `scheme.html`,
> `match.html`, `assistant.html`, `wizard.html`, `css/style.css`, `css/gov.css`.
>
> The design brief and the exact content of every page is in the pages document I have
> also pasted. Use realistic placeholder content so each page looks finished when I open
> it directly — I will replace the placeholders with live data later.
>
> Plain HTML and CSS. No framework, no Tailwind, no build step, no CDN links. It must
> work opened straight from the filesystem. Responsive down to 360px, every button at
> least 48px tall, and it should look like a real government portal — clean and official,
> not decorated.
>
> End every page with exactly these four script tags and nothing else:
> ```html
> <script src="js/strings.js"></script>
> <script src="js/api.js"></script>
> <script src="js/app.js"></script>
> <script src="js/pages.js"></script>
> ```
>
> Start with `css/style.css` and `index.html`, then wait for me to ask for the next file.

---

## Track C — JavaScript · give to Claude Code, in `SIH-new/`

> Read `docs/00-CONTRACTS.md` in full, then `docs/02-PAGES.md`, then
> `docs/03-BUILD-BRIEFS.md` Track C. Build Track C exactly as specified.
>
> The HTML does not exist yet — another track is writing it in parallel. That is fine and
> expected. Write against the DOM ids in contracts §6 exactly as if they were already
> there, and guard every lookup so that a missing element logs a warning and continues
> instead of throwing. A half-built page must never break the rest of the site.
>
> Four files: `web/js/strings.js`, `web/js/api.js`, `web/js/app.js`, `web/js/pages.js`.
> Plain browser JavaScript, no modules, no imports, no npm. `window.API` and `window.App`
> are the only globals.
>
> Never write a visible sentence in the code — every string goes in `strings.js` under a
> key, in both Hindi and English, with identical key sets.
>
> Demonstrate all four acceptance criteria.

---

## Track D — Assistant · after A and C exist

> Read `docs/00-CONTRACTS.md` §2 and §6, and `docs/03-BUILD-BRIEFS.md` Track D. Build the
> chat and voice panels of the assistant page.
>
> Chat calls `API.ask()` and renders the citation line under every reply from
> `cited_scheme_ids`. Voice uses `MediaRecorder` on `#mic-btn`, posts to
> `API.transcribe()`, and puts the transcript in `#transcript-box` **as editable text** —
> the user must be able to correct a misheard word before anything is decided. That is a
> requirement, not a nicety.
>
> Handle three failures visibly with a plain sentence and a retry: microphone permission
> denied, audio empty or too short, server unreachable. Demonstrate each.

---

## Track E — Integration · Claude Code, last

> Read every document in `docs/`, then `DEMO-SCRIPT.md`. All four tracks are complete and
> in the repo. Integrate them: replace placeholder content with live data, fix what does
> not line up, and make the whole `DEMO-SCRIPT.md` path work end to end with no console
> errors.
>
> Then write `run.bat` and `run.sh` that start the server and open the browser, and a
> `README.md` that explains what each of the fourteen frontend files does in one line —
> written for someone who knows HTML and CSS but not backend development.
>
> Report anything on the demo path that is fragile. Do not add features.

---

## Handing work between tools

When Gemini gives you a file, save it at the exact path in the brief. Then, in Claude:

> I have added `web/schemes.html` from the other track. Check it against
> `docs/00-CONTRACTS.md` §6 — confirm every required id is present and that it invents
> none. List anything wrong; do not fix it yet.

That check takes seconds and catches the one failure mode this whole structure exists to
prevent: two tracks quietly disagreeing about a name.
