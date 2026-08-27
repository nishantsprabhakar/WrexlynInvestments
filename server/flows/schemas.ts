/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 5: the validation gate on AI-generated output. Before Phase 5,
 * `runStructuredJson`'s parsed result was used as-is with zero shape
 * check — a malformed or partially-wrong LLM response flowed straight
 * into document/spreadsheet generation and the deal store. These schemas
 * mirror exactly what each flow's system prompt asks the LLM to return;
 * `.parse()` throws a clear error on any mismatch instead of failing
 * silently downstream.
 */
import { z } from "zod";
import { ClaimClassification } from "../domain/common";

const ScreeningDimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(10),
  rationale: z.string().min(1),
});

/** Phase 6: every unsourced assertion carries the Core Principle 5 classification instead of being a bare string. */
const ClassifiedClaimSchema = z.object({
  text: z.string().min(1),
  classification: ClaimClassification,
});

export const ScreeningLlmOutputSchema = z.object({
  companyName: z.string().min(1),
  sector: z.string().default(""),
  hq: z.string().default(""),
  dimensions: z.array(ScreeningDimensionSchema).length(8),
  keyFacts: z.array(ClassifiedClaimSchema).default([]),
  redFlags: z.array(ClassifiedClaimSchema).default([]),
  recommendation: z.enum(["Advance to Preliminary DD", "Hold — needs more information", "Pass"]),
});
export type ScreeningLlmOutput = z.infer<typeof ScreeningLlmOutputSchema>;

const FinancialAnalysisSchema = z.object({
  revenueCr: z.number(),
  ebitdaCr: z.number(),
  patCr: z.number(),
  debtCr: z.number(),
  commentary: z.string().default(""),
});

const ValuationSchema = z.object({
  askCr: z.number(),
  impliedMultiple: z.string().default(""),
  commentary: z.string().default(""),
});

const RiskAndMitigantSchema = z.object({
  risk: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  mitigant: z.string().min(1),
  classification: ClaimClassification,
});

const HistoricalYearSchema = z.object({
  year: z.string().min(1),
  revenueCr: z.number(),
  ebitdaCr: z.number(),
});

const ProjectedYearSchema = z.object({
  year: z.string().min(1),
  revenueCr: z.number(),
  ebitdaCr: z.number(),
});

const ReturnsScenarioSchema = z.object({
  case: z.enum(["Bear", "Base", "Bull"]),
  exitYear: z.number().int().min(1).max(5),
  exitMultiple: z.number().positive(),
});

const FinancialModelSchema = z.object({
  historicalYears: z.array(HistoricalYearSchema).max(3).default([]),
  projectedYears: z.array(ProjectedYearSchema).length(5),
  returnsScenarios: z.array(ReturnsScenarioSchema).min(3),
});

export const EvaluationLlmOutputSchema = z.object({
  companyName: z.string().min(1),
  executiveSummary: z.string().min(1),
  investmentThesis: z.string().min(1),
  businessOverview: z.string().min(1),
  financialAnalysis: FinancialAnalysisSchema,
  valuation: ValuationSchema,
  risksAndMitigants: z.array(RiskAndMitigantSchema).min(5),
  recommendation: z.enum(["Advance", "Hold", "Pass"]),
  proposedTerms: z.string().default(""),
  financialModel: FinancialModelSchema,
});
export type EvaluationLlmOutput = z.infer<typeof EvaluationLlmOutputSchema>;

/** Phase 9: documentation.ts had zero shape validation until now — the one flow Phase 5 didn't gate. */
const DocumentationRiskFlagSchema = z.object({
  flag: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1),
  recommendedAction: z.string().default(""),
  quotedText: z.string().default(""),
  suggestedReplacementText: z.string().default(""),
  classification: ClaimClassification,
});

export const DocumentationLlmOutputSchema = z.object({
  documentType: z.string().min(1),
  keyFindings: z.array(z.string()).default([]),
  riskFlags: z.array(DocumentationRiskFlagSchema).default([]),
  complianceGaps: z.array(z.string()).default([]),
  missingItems: z.array(z.string()).default([]),
});
export type DocumentationLlmOutput = z.infer<typeof DocumentationLlmOutputSchema>;
