# Wrexlyn for Investments

A private-equity intelligence platform built on Wrexlyn's backend (multi-provider LLM calling, real PDF/DOCX/XLSX/PPTX generation, OS-native API-key storage, Word tracked-change redlining).

## Flows

1. **Initial Screening** — company name (+ optional deck) → rated across 8 PE dimensions from public information.
2. **Deal Evaluation** — deck + financial model → a full IC Note (thesis, financials, risks & mitigants, recommendation), generated as a real downloadable `.docx` and a formula-driven `.xlsx` financial model.
3. **Documentation Review** — any company document → risk review, with a real Word tracked-change redline attempted on flagged `.docx` clauses.
4. **Deal Pipeline** — a live dashboard (KPI strip, 9-stage funnel, sector/rejection charts, searchable deal console) fed automatically by the other three flows.

Theme: 9 selectable themes (an amber "Bloomberg" terminal default, plus Wrexlyn's own 8 themes), Wrexlyn's own monogram as the brand mark.

## Setup

```bash
npm install
npm run build
npm start
```

Serves on `http://127.0.0.1:4500` by default (override the port with `PORT`, and the bind address with `HOST` — see [SECURITY.md](SECURITY.md) before changing `HOST`). Works out of the box with Wrexlyn's free, keyless `kilo` provider; add your own Groq/OpenRouter/Gemini/Cerebras/Mistral key from the in-app Settings panel for higher limits — keys are stored via OS-native secure storage, shared with the Wrexlyn coding-agent app if installed.

## Installation (Windows / macOS / Linux)

No install is required to develop against this repo (`npm run dev` is enough) — the options below
are for running it as a standalone desktop app with a double-click launcher, Start Menu/Desktop
shortcut, and uninstaller, without needing a terminal on every subsequent launch.

**Windows** — build `Wrexlyn-Investments-Setup.exe` with [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```bash
"C:\Users\<you>\AppData\Local\Programs\Inno Setup 6\ISCC.exe" installer\windows\wrexlyn-investments.iss
```

The resulting installer (in `installer\windows\output\`) needs no admin rights, and creates
Desktop/Start Menu shortcuts plus an uninstaller. First launch runs `npm install`/`npm run build`
automatically; every later launch just starts the app and opens your browser.

**macOS / Linux** — run the installer script from inside a checkout of this repo:

```bash
./install.sh
```

This copies the app to a per-user location (`~/Library/Application Support/Wrexlyn Investments` on
macOS, `~/.local/share/wrexlyn-investments` on Linux), adds a `wrexlyn-investments` command, and
registers a launcher (a `.app` bundle under `~/Applications` on macOS, a desktop entry on Linux) —
no `sudo`, no code signing. See the script's own comments for exact uninstall steps.

**Manual / any OS** — double-click `Start Wrexlyn Investments.bat` (Windows) or
`Start Wrexlyn Investments.sh` (macOS/Linux, after `chmod +x`) from a checkout of this repo; both
just run `scripts/launch.ps1` / `scripts/launch.sh`, which install dependencies, build, start the
server, and open your browser — no separate `npm install`/`npm run build`/`npm start` needed.

Every path above requires [Node.js](https://nodejs.org) 18+ already installed; the launchers detect
its absence and tell you where to get it rather than failing silently.

## Project layout

- `server/lib/` — vendored Wrexlyn backend modules (LLM providers, document tools, secret storage) plus a few small additions (`read_docx`/`read_pptx`/`read_xlsx`) for ingesting uploads.
- `server/flows/` — the three analysis flows.
- `server/pipeline/` — the JSON-file-backed deal store.
- `public/` — the frontend (vanilla JS, no framework).

## License

Copyright (c) 2026 Nishant Prabhakar. All rights reserved. Wrexlyn for Investments is proprietary,
source-available software — not open source. See [`LICENSE`](LICENSE) for the specific (limited,
evaluation-only) grant of rights, [`TERMS_OF_SERVICE.md`](TERMS_OF_SERVICE.md) for disclaimers and
assumption of risk (including around AI-generated and computed financial output),
[`ACCEPTABLE_USE_POLICY.md`](ACCEPTABLE_USE_POLICY.md), [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md),
[`SECURITY.md`](SECURITY.md), and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Unauthorized
copying, modification, or distribution is prohibited.
