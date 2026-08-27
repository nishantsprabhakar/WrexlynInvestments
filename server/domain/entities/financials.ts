/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4 domain entities: financials, valuation, and capital structure.
 * FinancialPeriod/FinancialMetric are deliberately generic (a metric name +
 * value pair) so the same shape covers PE's revenue/EBITDA and VC's
 * ARR/burn/CAC without separate schemas — the "PE and VC configurations
 * without three applications" requirement, applied at the schema level.
 * Deterministic calculation of any of these values belongs in Phase 5's
 * finance services, never in an LLM — this file only defines the record
 * shape a calculation (or a sourced/extracted figure) is stored in.
 */
import { z } from "zod";
import { withMeta, Provenance } from "../common";

export const FinancialPeriodSchema = withMeta({
  companyId: z.string(),
  dealId: z.string().optional(),
  label: z.string().min(1), // e.g. "FY24", "2026-Q2"
  periodType: z.enum(["actual", "budget", "projection"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().default("USD"),
});
export type FinancialPeriod = z.infer<typeof FinancialPeriodSchema>;

export const FinancialMetricSchema = withMeta({
  financialPeriodId: z.string(),
  metric: z.string().min(1), // e.g. "revenue", "ebitda", "arr", "burn_rate", "cac"
  value: z.number(),
  unit: z.string().optional(), // e.g. "USD_M", "pct", "months"
  provenance: Provenance,
});
export type FinancialMetric = z.infer<typeof FinancialMetricSchema>;

export const ValuationCaseSchema = withMeta({
  dealId: z.string(),
  method: z.enum(["dcf", "comps", "precedent_transactions", "arr_multiple", "lbo_implied", "other"]),
  assumptions: z.record(z.string(), z.unknown()).default({}),
  impliedValueM: z.number().optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
});
export type ValuationCase = z.infer<typeof ValuationCaseSchema>;

/** The PE LBO sources-and-uses stack — equity + one or more debt tranches (see DebtFacility). */
export const CapitalStructureSchema = withMeta({
  dealId: z.string(),
  valuationCaseId: z.string().optional(),
  equityM: z.number(),
  seniorDebtM: z.number().optional(),
  subDebtM: z.number().optional(),
  otherDebtM: z.number().optional(),
  totalSourcesM: z.number().optional(),
  currency: z.string().default("USD"),
});
export type CapitalStructure = z.infer<typeof CapitalStructureSchema>;

/** Shared by a PE rollover/sponsor cap table and a VC founder/investor/option-pool cap table. */
export const CapTableSchema = withMeta({
  companyId: z.string(),
  dealId: z.string().optional(),
  asOfDate: z.string(),
  rows: z
    .array(
      z.object({
        holder: z.string(),
        holderType: z.enum(["founder", "employee_pool", "investor", "sponsor", "management_rollover", "other"]),
        shares: z.number().optional(),
        ownershipPct: z.number().min(0).max(100),
        shareClass: z.string().optional(),
      })
    )
    .default([]),
});
export type CapTable = z.infer<typeof CapTableSchema>;

export const DebtFacilitySchema = withMeta({
  capitalStructureId: z.string(),
  name: z.string(),
  type: z.enum(["term_loan_a", "term_loan_b", "revolver", "subordinated", "mezzanine", "other"]),
  principalM: z.number(),
  interestRateDescription: z.string().optional(),
  maturityDate: z.string().optional(),
  covenants: z.array(z.string()).default([]),
});
export type DebtFacility = z.infer<typeof DebtFacilitySchema>;

export const ReturnsCaseSchema = withMeta({
  dealId: z.string(),
  valuationCaseId: z.string().optional(),
  scenario: z.enum(["bear", "base", "bull"]),
  exitYear: z.number().int(),
  exitAssumption: z.string().optional(),
  irrPct: z.number().optional(),
  moic: z.number().optional(),
  provenance: Provenance.optional(),
});
export type ReturnsCase = z.infer<typeof ReturnsCaseSchema>;
