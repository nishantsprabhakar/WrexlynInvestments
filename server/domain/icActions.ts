/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 11: small pure helpers for the IC process — no I/O, testable
 * without touching the entity stores, same pattern as portfolioActions.ts.
 */

/** An ICDecision resolves the ICMemorandum it was made against — never left in "draft" once a human has actually decided. */
export function mapDecisionToMemorandumStatus(
  decision: "approve" | "reject" | "approve_with_conditions" | "defer"
): "approved" | "rejected" | "submitted" {
  if (decision === "approve" || decision === "approve_with_conditions") return "approved";
  if (decision === "reject") return "rejected";
  return "submitted"; // defer — still in play, not terminal
}
