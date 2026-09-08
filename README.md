# Sahaay

A portal that tells a Scheduled Caste entrepreneur or student **which NSFDC
loan scheme they qualify for, exactly what it will cost them, and which
office to actually walk into** — using NSFDC's own published figures, plain
deterministic rules, and a local AI that only ever turns speech into form
fields. It never invents a number, and it never lets a language model decide
eligibility.

Built for Smart India Hackathon (problem statement SIH26092).

## Read this first

| Doc | What's in it |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | **Start here if you're new.** What Sahaay is, how to run it from nothing, what flows into what, every feature (and every stub), all 14 schemes, and the demo. Written for someone who knows HTML/CSS/JS and nothing else. |
| [`PROJECT-GUIDE.md`](PROJECT-GUIDE.md) | The architecture and a lookup table from every URL to the file that answers it. Keep it open while working in the code. |
| [`STACK-CONTEXT.md`](STACK-CONTEXT.md) | Why this moved from Python/FastAPI to Node/Express, and what changed. |
| [`PROJECT-CONTEXT.md`](PROJECT-CONTEXT.md) | The competition, the research behind it, and what Sahaay actually is. |
| [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md) | The walkthrough used to demo it. |
| [`SLIDE-BUILD-SHEET.md`](SLIDE-BUILD-SHEET.md) | The six-slide SIH deck, element by element — and what changed after the migration. |

## Run it

Two processes, from the repo root:

```bash
# terminal 1 — local AI (Whisper + Ollama), port 8001
.venv\Scripts\python.exe -m uvicorn python-ai.app:app --host 127.0.0.1 --port 8001

# terminal 2 — the portal, port 3000
cd server && npm start
```

Open **http://127.0.0.1:3000**. Demo logins: `sunita` / `demo123`,
`ramesh` / `demo123`.

The portal works fully without the AI process — only the microphone and the
assistant need it. Full details, including what each demo login shows and
what's a deliberate stub, are in `PROJECT-GUIDE.md`.

## What it is

```
Browser ──► Express (port 3000) ─────► decides everything: eligibility,
            server/                    cost, routing, accounts, catalogue
               │
               │  only for speech + the grounded assistant
               ▼
            Python AI (port 8001)
            python-ai/
```

- **5 schemes** with full eligibility and cost logic, **106 partner offices**
  across India, ranked by real published state-utilisation data — never a
  guess about a named bank.
- **Explainable, not black-box.** Every eligibility decision and near-miss
  comes with a plain-language reason, in Hindi and English.
- **The engine is deterministic JavaScript**, tested against the answers of
  its original Python implementation to the rupee (47 tests, 0 differences —
  see `STACK-CONTEXT.md` for how).
- **The AI never decides anything.** It transcribes speech and extracts form
  fields; the rules that follow are plain code, checkable against
  nsfdc.nic.in by anyone in the room.

## Tests

```bash
cd server && npm test
```
