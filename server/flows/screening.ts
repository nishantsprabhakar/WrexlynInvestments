/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Flow 1: Initial Screening — company name (+ optional deck), rated across
 * 8 PE dimensions from public-data research. Dimension set matches
 * Praevix's proven SCORE_SYSTEM shape (no need to reinvent it).
 */
import { runStructuredJson } from "../lib/aiFlow";
import { ingestUploadedFile, type UploadedFile } from "../lib/ingest";
import { dealWorkspaceRoot } from "../lib/workspace";
import { upsertDealByCompanyName, STAGES, type Deal } from "../pipeline/store";
import { ScreeningLlmOutputSchema } from "./schemas";
import { applyDeterministicScreening } from "./screening.calc";
import { recordAuditEntry } from "../domain/audit/auditLog";
import { syncDomainDeal } from "../domain/sync";
import { screeningAssessments, sources, researchFindings } from "../domain/repositories";
import { buildScreeningAssessmentRecord, buildResearchFindingInputs } from "./screening.persist";
import { buildSourceInput } from "../domain/sourceActions";
import { CLASSIFICATION_RULES } from "./promptFragments";

const SCREENING_SYSTEM = `You are a senior private-equity screening analyst producing an institutional-grade initial screen. You work ONLY from publicly available information (and any deck text supplied) — never fabricate financials with false precision; use ranges and say "estimated" where appropriate.

Score the company across EXACTLY these 8 dimensions, each 0.0-10.0 (one decimal), with a rationale of at least 60 words: Market Opportunity, Business Model & Moat, Financial Performance, Management Team, Competitive Position, Growth & Scalability, Risk Profile, Exit Potential.

Return ONLY valid JSON in exactly this shape:
{
  "companyName": "string",
  "sector": "string",
  "hq": "string",
  "dimensions": [{"name": "Market Opportunity", "score": 0.0, "rationale": "..."}],
  "keyFacts": [{"text": "specific, sourced-feeling fact about the business, financials, funding history", "classification": "sourced_fact"}],
  "redFlags": [{"text": "specific concern a diligence team should chase", "classification": "analyst_assumption"}],
  "recommendation": "Advance to Preliminary DD|Hold — needs more information|Pass"
}

Do not compute an overall rating or letter grade yourself — the platform derives both deterministically from your 8 dimension scores (equal-weight average ×10, rounded).

Every keyFact and redFlag must carry a "classification". ${CLASSIFICATION_RULES}
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
  let ingestedDeck: Awaited<ReturnType<typeof ingestUploadedFile>> | undefined;
  if (input.deckFile) {
    ingestedDeck = await ingestUploadedFile(root, input.deckFile);
    deckText = ingestedDeck.ok ? ingestedDeck.text : "";
  }

  const userContent = deckText
    ? `Company to screen: ${companyName}\n\n=== UPLOADED DECK (extracted text) ===\n${deckText.slice(0, 15000)}\n=== END DECK ===`
    : `Company to screen: ${companyName}\n\nNo deck was provided — screen based on publicly available information.`;

  const raw = await runStructuredJson(SCREENING_SYSTEM, userContent);
  const report = applyDeterministicScreening(ScreeningLlmOutputSchema.parse(raw));

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

  recordAuditEntry({
    dealId: updated.id,
    companyName,
    flow: "screening",
    inputSummary: input.deckFile ? `deck: ${input.deckFile.name}` : "no deck provided",
    outputSummary: { overallRating: report.overallRating, grade: report.grade, recommendation: report.recommendation },
    validationOk: true,
  });

  const { companyId, dealId: domainDealId } = syncDomainDeal(updated);
  screeningAssessments.create(buildScreeningAssessmentRecord(report, domainDealId));

  let sourceId: string | undefined;
  if (ingestedDeck?.ok) {
    sourceId = sources.create(buildSourceInput(domainDealId, companyId, ingestedDeck)).id;
  }
  for (const finding of buildResearchFindingInputs(report, domainDealId, companyId, sourceId)) {
    researchFindings.create(finding);
  }

  return { deal: updated, report };
}
