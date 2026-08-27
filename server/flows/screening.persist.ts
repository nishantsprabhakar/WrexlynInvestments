/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 7: maps a validated + deterministically-scored screening report
 * into the shape server/domain/entities/pipeline.ts's ScreeningAssessment
 * expects — pure, no I/O, independently testable without mocking the LLM.
 */

export function buildScreeningAssessmentRecord(report: any, dealId: string) {
  return {
    dealId,
    overallRating: report.overallRating,
    grade: report.grade,
    dimensions: report.dimensions.map((d: any) => ({ name: d.name, score: d.score, rationale: d.rationale })),
    keyFacts: report.keyFacts,
    redFlags: report.redFlags,
    recommendation: report.recommendation,
    ranAt: Date.now(),
  };
}

/**
 * Phase 10: ScreeningAssessment.keyFacts is a point-in-time snapshot,
 * overwritten each time screening reruns. ResearchFinding is the
 * standalone, cross-run evidence layer domain/entities/pipeline.ts defines
 * for this — one row per keyFact, carrying its classification and (if a
 * deck was ingested) the Source it came from.
 */
export function buildResearchFindingInputs(report: any, dealId: string, companyId: string, sourceId?: string) {
  return (report.keyFacts || []).map((f: any) => ({
    dealId,
    companyId,
    summary: f.text,
    provenance: { classification: f.classification, sourceId },
    sourceId,
    tags: [],
  }));
}
