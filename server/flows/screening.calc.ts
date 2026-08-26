/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 5: overlays the deterministic overall rating + grade onto a
 * validated screening report, replacing whatever the LLM claimed for
 * those two fields (Core Principle 6 — LLMs never authoritative for
 * financial/scoring calculations).
 */
import { weightedAverageScore } from "../domain/finance/calculations";
import { deriveGrade } from "../domain/finance/grading";
import type { ScreeningLlmOutput } from "./schemas";

export function applyDeterministicScreening(
  report: ScreeningLlmOutput
): ScreeningLlmOutput & { overallRating: number; grade: string } {
  const overallRating = weightedAverageScore(report.dimensions.map((d) => d.score));
  const grade = deriveGrade(overallRating);
  return { ...report, overallRating, grade };
}
