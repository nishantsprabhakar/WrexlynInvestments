/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4 domain entities: post-close portfolio monitoring through to
 * realized exit. FollowOnDecision carries the same human-authority rule as
 * ICDecisionSchema (decidedBy required, non-empty) — a follow-on
 * commitment is a real capital decision, not something Wrexlyn ever casts.
 */
import { z } from "zod";
import { Provenance, withMeta } from "../common";

export const PortfolioInvestmentSchema = withMeta({
  dealId: z.string(),
  companyId: z.string(),
  fundId: z.string(),
  investedM: z.number(),
  investedAt: z.number(),
  ownershipPct: z.number().min(0).max(100),
  status: z.enum(["active", "exited", "written_off"]).default("active"),
});
export type PortfolioInvestment = z.infer<typeof PortfolioInvestmentSchema>;

export const PortfolioKPISchema = withMeta({
  portfolioInvestmentId: z.string(),
  period: z.string(), // e.g. "2026-Q2"
  kpi: z.string().min(1),
  value: z.number(),
  targetValue: z.number().optional(),
  provenance: Provenance.optional(),
});
export type PortfolioKPI = z.infer<typeof PortfolioKPISchema>;

export const ValueCreationInitiativeSchema = withMeta({
  portfolioInvestmentId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  targetImpactM: z.number().optional(),
  status: z.enum(["planned", "in_progress", "complete", "abandoned"]).default("planned"),
});
export type ValueCreationInitiative = z.infer<typeof ValueCreationInitiativeSchema>;

export const FollowOnDecisionSchema = withMeta({
  portfolioInvestmentId: z.string(),
  roundName: z.string().optional(),
  decision: z.enum(["participate_pro_rata", "participate_super_pro_rata", "pass", "increase"]),
  /** Human identifiers who made this capital decision — required and non-empty; never populated by AI. */
  decidedBy: z.array(z.string()).min(1),
  decidedAt: z.number(),
  amountM: z.number().optional(),
  rationale: z.string().optional(),
});
export type FollowOnDecision = z.infer<typeof FollowOnDecisionSchema>;

export const ExitScenarioSchema = withMeta({
  portfolioInvestmentId: z.string(),
  scenario: z.enum(["bear", "base", "bull"]),
  exitRoute: z.enum(["strategic_sale", "sponsor_to_sponsor", "ipo", "secondary", "write_off", "other"]),
  exitYear: z.number().int().optional(),
  expectedProceedsM: z.number().optional(),
  expectedMoic: z.number().optional(),
  expectedIrr: z.number().optional(),
});
export type ExitScenario = z.infer<typeof ExitScenarioSchema>;

/** Closes the loop from thesis to actual outcome — the realized counterpart to ExitScenario. */
export const RealisedProceedsSchema = withMeta({
  portfolioInvestmentId: z.string(),
  exitDate: z.string(),
  exitRoute: z.enum(["strategic_sale", "sponsor_to_sponsor", "ipo", "secondary", "write_off", "other"]),
  grossProceedsM: z.number(),
  netProceedsM: z.number().optional(),
  realizedMoic: z.number(),
  realizedIrr: z.number(),
  currency: z.string().default("USD"),
});
export type RealisedProceeds = z.infer<typeof RealisedProceedsSchema>;
