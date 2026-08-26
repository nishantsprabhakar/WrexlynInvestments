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
