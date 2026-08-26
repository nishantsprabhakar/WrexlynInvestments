/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 5: letter-grade derivation from a 0-100 overall rating. The
 * screening prompt states coarse bands (88+ = A+/A, 74-87 = B range,
 * 58-73 = C range, 40-57 = D, below 40 = F) but never specifies the +/-
 * sub-splits — this divides each multi-grade band evenly and applies the
 * result deterministically instead of trusting LLM-claimed text.
 */

export function deriveGrade(overallRating: number): string {
  const r = Math.round(overallRating);
  if (r >= 95) return "A+";
  if (r >= 88) return "A";
  if (r >= 83) return "B+";
  if (r >= 78) return "B";
  if (r >= 74) return "B-";
  if (r >= 68) return "C+";
  if (r >= 63) return "C";
  if (r >= 58) return "C-";
  if (r >= 40) return "D";
  return "F";
}
