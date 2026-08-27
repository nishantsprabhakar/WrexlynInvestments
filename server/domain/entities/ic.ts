/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4 domain entities: investment-committee process. ICDecisionSchema
 * requires `decidedBy: string[]` (human identifiers) as a non-empty,
 * required field — Core Principle 7 ("Human decision authority": Wrexlyn
 * may recommend/analyze/draft but must never cast an IC vote) enforced at
 * the schema level, not left to convention.
 */
import { z } from "zod";
import { withMeta } from "../common";

export const ICMemorandumSchema = withMeta({
  dealId: z.string(),
  memoVersion: z.number().int().min(1),
  sections: z.record(z.string(), z.string()).default({}),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).default("draft"),
});
export type ICMemorandum = z.infer<typeof ICMemorandumSchema>;

export const ICDecisionSchema = withMeta({
  dealId: z.string(),
  icMemorandumId: z.string().optional(),
  decision: z.enum(["approve", "reject", "approve_with_conditions", "defer"]),
  /** Human identifiers who cast this decision — required and non-empty; never populated by AI. */
  decidedBy: z.array(z.string()).min(1),
  decidedAt: z.number(),
  rationale: z.string().optional(),
});
export type ICDecision = z.infer<typeof ICDecisionSchema>;

export const ApprovalConditionSchema = withMeta({
  icDecisionId: z.string(),
  condition: z.string().min(1),
  status: z.enum(["open", "satisfied", "waived"]).default("open"),
  dueDate: z.string().optional(),
});
export type ApprovalCondition = z.infer<typeof ApprovalConditionSchema>;

export const TransactionMilestoneSchema = withMeta({
  dealId: z.string(),
  milestone: z.enum(["loi_signed", "spa_signed", "regulatory_approval", "financing_close", "closing", "other"]),
  targetDate: z.string().optional(),
  actualDate: z.string().optional(),
  status: z.enum(["pending", "complete", "at_risk"]).default("pending"),
});
export type TransactionMilestone = z.infer<typeof TransactionMilestoneSchema>;
