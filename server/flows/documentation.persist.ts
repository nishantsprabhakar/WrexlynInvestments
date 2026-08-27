/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 7: maps a documentation review into the shapes
 * server/domain/entities/diligence.ts's RiskAndMitigant and
 * server/domain/entities/artifact.ts's InvestmentArtifact expect — pure,
 * no I/O, independently testable without mocking the LLM.
 */

/** sourceId (Phase 10) is the document being reviewed's own Source — each flag is a direct claim about that one document. */
export function buildRiskAndMitigantInputs(review: any, dealId: string, sourceId?: string) {
  return (review.riskFlags || []).map((f: any) => ({
    dealId,
    risk: f.flag,
    severity: (f.severity || "medium") as "high" | "medium" | "low",
    mitigant: f.recommendedAction || undefined,
    status: "open" as const,
    provenance: { classification: f.classification, sourceId },
  }));
}

export function buildInvestmentArtifactInput(dealId: string, redlinedDocPath: string) {
  return { dealId, kind: "redline" as const, relPath: redlinedDocPath, generatedBy: "ai" as const, sourceFlow: "documentation" };
}
