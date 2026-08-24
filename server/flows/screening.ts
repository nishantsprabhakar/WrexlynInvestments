/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Flow 1: Initial Screening — company name (+ optional deck), rated across
 * 8 PE dimensions from public-data research. Dimension set matches
 * Praevix's proven SCORE_SYSTEM shape (no need to reinvent it).
 */
import { runStructuredJson } from "../lib/aiFlow";
import { ingestUploadedFile, type UploadedFile } from "../lib/ingest";
import { dealWorkspaceRoot } from "../lib/workspace";
import { upsertDealByCompanyName, STAGES, type Deal } from "../pipeline/store";

const SCREENING_SYSTEM = `You are a senior private-equity screening analyst producing an institutional-grade initial screen. You work ONLY from publicly available information (and any deck text supplied) — never fabricate financials with false precision; use ranges and say "estimated" where appropriate.

Score the company across EXACTLY these 8 dimensions, each 0.0-10.0 (one decimal), with a rationale of at least 60 words: Market Opportunity, Business Model & Moat, Financial Performance, Management Team, Competitive Position, Growth & Scalability, Risk Profile, Exit Potential.

Return ONLY valid JSON in exactly this shape:
{
  "companyName": "string",
  "sector": "string",
  "hq": "string",
  "overallRating": 0-100,
  "grade": "A+|A|A-|B+|B|B-|C+|C|C-|D|F",
  "dimensions": [{"name": "Market Opportunity", "score": 0.0, "rationale": "..."}],
  "keyFacts": ["specific, sourced-feeling facts about the business, financials, funding history"],
  "redFlags": ["specific concerns a diligence team should chase"],
  "recommendation": "Advance to Preliminary DD|Hold — needs more information|Pass"
}

Grade scale: 88+ = A+/A, 74-87 = B range, 58-73 = C range, 40-57 = D, below 40 = F.
overallRating is the weighted average of the 8 dimension scores (equal weight, ×10, rounded).
Return ONLY the JSON object, no markdown fences, no commentary.`;

export interface ScreeningInput {
  companyName: string;
  deckFile?: UploadedFile;
}

export async function runScreeningFlow(input: ScreeningInput) {
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("Company name is required.");

  const deal = upsertDealByCompanyName(companyName, {});
  const root = dealWorkspaceRoot(deal.id);

  let deckText = "";
  if (input.deckFile) {
    const ingested = await ingestUploadedFile(root, input.deckFile);
    deckText = ingested.ok ? ingested.text : "";
  }

  const userContent = deckText
    ? `Company to screen: ${companyName}\n\n=== UPLOADED DECK (extracted text) ===\n${deckText.slice(0, 15000)}\n=== END DECK ===`
    : `Company to screen: ${companyName}\n\nNo deck was provided — screen based on publicly available information.`;

  const report = await runStructuredJson(SCREENING_SYSTEM, userContent);

  const updated = upsertDealByCompanyName(companyName, {
    sector: report.sector || deal.sector,
    stage: deal.stage === STAGES[0] ? STAGES[1] : deal.stage,
    screening: {
      overallRating: report.overallRating,
      grade: report.grade,
      recommendation: report.recommendation,
      ranAt: Date.now(),
    },
  } as Partial<Deal>);

  return { deal: updated, report };
}
