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

Serves on `http://localhost:4500` by default (override with the `PORT` env var). Works out of the box with Wrexlyn's free, keyless `kilo` provider; add your own Groq/OpenRouter/Gemini/Cerebras/Mistral key from the in-app Settings panel for higher limits — keys are stored via OS-native secure storage, shared with the Wrexlyn coding-agent app if installed.

## Project layout

- `server/lib/` — vendored Wrexlyn backend modules (LLM providers, document tools, secret storage) plus a few small additions (`read_docx`/`read_pptx`/`read_xlsx`) for ingesting uploads.
- `server/flows/` — the three analysis flows.
- `server/pipeline/` — the JSON-file-backed deal store.
- `public/` — the frontend (vanilla JS, no framework).

## License

Proprietary — all rights reserved. See `package.json`.
