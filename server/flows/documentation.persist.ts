/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 7: maps a documentation review into the shapes
 * server/domain/entities/diligence.ts's RiskAndMitigant and
 * server/domain/entities/artifact.ts's InvestmentArtifact expect — pure,
 * no I/O, independently testable without mocking the LLM.
 */

export function buildRiskAndMitigantInputs(review: any, dealId: string) {
  return (review.riskFlags || []).map((f: any) => ({
    dealId,
    risk: f.flag,
    severity: (f.severity || "medium") as "high" | "medium" | "low",
    mitigant: f.recommendedAction || undefined,
    status: "open" as const,
    provenance: { classification: f.classification },
  }));
}

export function buildInvestmentArtifactInput(dealId: string, redlinedDocPath: string) {
  return { dealId, kind: "redline" as const, relPath: redlinedDocPath, generatedBy: "ai" as const, sourceFlow: "documentation" };
}
