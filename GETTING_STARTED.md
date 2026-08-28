# Getting Started with Wrexlyn for Investments

Wrexlyn for Investments is your fund's deal command center — from first screening
through to a realized exit — with AI assistance at each analysis-heavy step and a
deterministic (not AI-guessed) engine underneath every financial calculation.
Everything you enter stays local to this install; see [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
for exactly what, if anything, leaves your machine.

## The first five minutes

1. **Open the app** — it lands on the **Pipeline** tab, your fund's deal board. On
   a brand-new install this is empty; click **Load Sample Deals** to populate it
   with a few fictional deals across PE, growth-equity, and VC strategies so you
   can see how the funnel/sector charts and deal console look with real data —
   delete them later from the deal's own workspace ("Delete Deal") whenever you're
   ready to start on your own deals for real.
2. **Add your first real deal** — either click **+ New Deal** directly, or run it
   through **Screening** first (see below) so it enters the pipeline pre-rated.
3. **Click into a deal** from the Pipeline table to open its workspace — from
   there you can trigger Screening/Evaluation/Documentation directly, see every
   generated artifact, and review its audit trail.

## The tabs, in the order you'll actually use them

The nav is laid out to match a deal's real lifecycle, not alphabetically:

| Tab | What it's for |
|---|---|
| **Pipeline** | Your fund's deal board — funnel stage, sector mix, and every deal's current state. Home base. |
| **Screening** | Rate a company across 8 PE dimensions from public information (+ an optional deck) in one AI-assisted pass. |
| **Diligence** | Track structured due-diligence work by workstream (Commercial, Financial, Legal, Tech…) and individual data-room requests. |
| **Evaluation** | Upload a deck + financial model, get a full IC Note (thesis, financials, risks & mitigants) plus a real downloadable `.docx` and a formula-driven `.xlsx` model. |
| **Valuation** | DCF and ARR-multiple cases computed deterministically from your inputs (not asked of the AI); debt facilities tied to the deal's capital structure. |
| **Cap Table** | Save a company's cap table and model a new priced round's dilution before committing to it — the VC-side workflow. |
| **IC Decisions** | Record an actual investment-committee decision, linked to a versioned IC memorandum, with conditions tracked separately. Every decision requires a named human decision-maker — Wrexlyn never casts a vote. |
| **Documentation** | Upload any company document for an AI risk review, with a real Word tracked-change redline attempted on flagged clauses. |
| **Portfolio** | Once invested, track KPIs, follow-on decisions, exit scenarios, realized proceeds, and value-creation initiatives through to exit. |
| **Fund & Team** | Firm-level setup: contacts, deal teams, investment vehicles, and mandates — touched far less often than the tabs above. |

## A note on AI output vs. computed output

Two different things happen depending on the field: some content (screening
narratives, IC thesis text, risk write-ups) is genuinely AI-generated and should be
read the way you'd read an analyst's first draft — useful, but yours to verify.
Other numbers (EBITDA margins, growth rates, IRR/MOIC, DCF values, cap-table
dilution) are computed deterministically in code from the inputs you or the AI
extracted — the AI is never asked to state an IRR or a margin itself. Either way,
**you are responsible for verifying every figure before it informs a real
capital decision** — see [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md) Section 3.

## Troubleshooting

- **"Node.js is required but wasn't found"** on launch — install it from
  [nodejs.org](https://nodejs.org) (version 18+), then run the launcher again.
- **Screening/Evaluation/Documentation returns an error** — the free default AI
  provider is capped at 200 requests/hour; add your own API key (Groq,
  OpenRouter, Gemini, Cerebras, or Mistral all have free tiers) from the ⚙
  Settings icon in the top-right for higher limits.
- **A tab I expect isn't visible** — the nav wraps to a second row rather than
  hiding anything; if it looks cut off, widen the window or scroll down slightly.
- **I want a clean start** — every deal's data lives in local files under `data/`;
  deleting a deal from its own workspace removes it, or you can reset entirely
  by clearing that directory (back it up first if you're not sure).

## Where to go next

- [README.md](README.md) — technical setup, installers, and project layout.
- [SECURITY.md](SECURITY.md) — the app's security model, especially before
  changing the default network-binding behavior.
- [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md), [PRIVACY_POLICY.md](PRIVACY_POLICY.md),
  [LICENSE](LICENSE) — the legal terms governing your use of the Software.

Questions or issues: contact Nishant Prabhakar through the official repository
contact channel — see [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md) Section 18.
