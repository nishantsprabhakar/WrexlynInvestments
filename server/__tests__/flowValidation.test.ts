/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 5 tests: the schema validation gate on raw LLM JSON, plus the
 * actual correctness proof — a deliberately wrong LLM-claimed number gets
 * overwritten by the deterministic engine, not trusted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { ScreeningLlmOutputSchema, EvaluationLlmOutputSchema, DocumentationLlmOutputSchema } from "../flows/schemas";
import { applyDeterministicScreening } from "../flows/screening.calc";
import { applyDeterministicFinancials, applyDeterministicReturns } from "../flows/evaluation.calc";

function makeDimension(name: string, score: number) {
  return { name, score, rationale: "a".repeat(65) };
}

const VALID_SCREENING_RAW = {
  companyName: "Acme Corp",
  sector: "Industrials",
  hq: "Mumbai",
  dimensions: [
    makeDimension("Market Opportunity", 8),
    makeDimension("Business Model & Moat", 7),
    makeDimension("Financial Performance", 6),
    makeDimension("Management Team", 9),
    makeDimension("Competitive Position", 7),
    makeDimension("Growth & Scalability", 8),
    makeDimension("Risk Profile", 5),
    makeDimension("Exit Potential", 8),
  ],
  keyFacts: [
    { text: "Founded 2015", classification: "sourced_fact" },
    { text: "Raised $10M Series A", classification: "management_claim" },
  ],
  redFlags: [{ text: "Customer concentration", classification: "analyst_assumption" }],
  recommendation: "Advance to Preliminary DD",
};

test("ScreeningLlmOutputSchema: valid payload parses", () => {
  const parsed = ScreeningLlmOutputSchema.parse(VALID_SCREENING_RAW);
  assert.equal(parsed.companyName, "Acme Corp");
  assert.equal(parsed.dimensions.length, 8);
  assert.equal(parsed.keyFacts[0].classification, "sourced_fact");
});

test("ScreeningLlmOutputSchema: a keyFact/redFlag missing or with an invalid classification is rejected", () => {
  const missingClassification = { ...VALID_SCREENING_RAW, keyFacts: [{ text: "Founded 2015" }] };
  assert.throws(() => ScreeningLlmOutputSchema.parse(missingClassification));

  const invalidClassification = { ...VALID_SCREENING_RAW, redFlags: [{ text: "Customer concentration", classification: "just_a_guess" }] };
  assert.throws(() => ScreeningLlmOutputSchema.parse(invalidClassification));
});

test("ScreeningLlmOutputSchema: all 6 classification values are accepted", () => {
  const allSix = {
    ...VALID_SCREENING_RAW,
    keyFacts: [
      { text: "a", classification: "sourced_fact" },
      { text: "b", classification: "management_claim" },
      { text: "c", classification: "derived_calculation" },
      { text: "d", classification: "analyst_assumption" },
      { text: "e", classification: "ai_interpretation" },
      { text: "f", classification: "unverified_assertion" },
    ],
  };
  const parsed = ScreeningLlmOutputSchema.parse(allSix);
  assert.equal(parsed.keyFacts.length, 6);
});

test("ScreeningLlmOutputSchema: missing dimension / bad enum is rejected", () => {
  const badDimensionCount = { ...VALID_SCREENING_RAW, dimensions: VALID_SCREENING_RAW.dimensions.slice(0, 7) };
  assert.throws(() => ScreeningLlmOutputSchema.parse(badDimensionCount));

  const badRecommendation = { ...VALID_SCREENING_RAW, recommendation: "Maybe" };
  assert.throws(() => ScreeningLlmOutputSchema.parse(badRecommendation));
});

test("applyDeterministicScreening: overrides a wrong LLM-claimed overallRating/grade", () => {
  const report = ScreeningLlmOutputSchema.parse(VALID_SCREENING_RAW) as any;
  report.overallRating = 3; // a deliberately wrong claim, as if the LLM had stated it
  report.grade = "F";

  const result = applyDeterministicScreening(report);

  // avg of [8,7,6,9,7,8,5,8] = 7.25 -> 72.5 -> rounds to 73 -> grade C+
  assert.equal(result.overallRating, 73);
  assert.equal(result.grade, "C+");
});

const VALID_EVALUATION_RAW = {
  companyName: "Acme Corp",
  executiveSummary: "A solid opportunity.",
  investmentThesis: "b".repeat(160),
  businessOverview: "c".repeat(160),
  financialAnalysis: { revenueCr: 100, ebitdaCr: 20, patCr: 10, debtCr: 15, commentary: "steady growth" },
  valuation: { askCr: 200, impliedMultiple: "10x EV/EBITDA", commentary: "in line with comparables" },
  risksAndMitigants: [
    { risk: "r1", severity: "high", mitigant: "m1", classification: "analyst_assumption" },
    { risk: "r2", severity: "medium", mitigant: "m2", classification: "management_claim" },
    { risk: "r3", severity: "low", mitigant: "m3", classification: "sourced_fact" },
    { risk: "r4", severity: "medium", mitigant: "m4", classification: "ai_interpretation" },
    { risk: "r5", severity: "high", mitigant: "m5", classification: "unverified_assertion" },
  ],
  recommendation: "Advance",
  proposedTerms: "",
  financialModel: {
    historicalYears: [{ year: "FY22", revenueCr: 80, ebitdaCr: 14 }],
    projectedYears: [
      { year: "FY24", revenueCr: 110, ebitdaCr: 22 },
      { year: "FY25", revenueCr: 130, ebitdaCr: 27 },
      { year: "FY26", revenueCr: 150, ebitdaCr: 33 },
      { year: "FY27", revenueCr: 175, ebitdaCr: 40 },
      { year: "FY28", revenueCr: 200, ebitdaCr: 48 },
    ],
    returnsScenarios: [
      { case: "Bear", exitYear: 5, exitMultiple: 8 },
      { case: "Base", exitYear: 5, exitMultiple: 10 },
      { case: "Bull", exitYear: 5, exitMultiple: 13 },
    ],
  },
};

test("EvaluationLlmOutputSchema: valid payload parses", () => {
  const parsed = EvaluationLlmOutputSchema.parse(VALID_EVALUATION_RAW);
  assert.equal(parsed.financialModel.projectedYears.length, 5);
});

test("EvaluationLlmOutputSchema: a risksAndMitigants entry missing classification is rejected", () => {
  const missingClassification = {
    ...VALID_EVALUATION_RAW,
    risksAndMitigants: VALID_EVALUATION_RAW.risksAndMitigants.map(({ classification, ...rest }) => rest),
  };
  assert.throws(() => EvaluationLlmOutputSchema.parse(missingClassification));
});

test("EvaluationLlmOutputSchema: too few risks / wrong projectedYears count is rejected", () => {
  const tooFewRisks = { ...VALID_EVALUATION_RAW, risksAndMitigants: VALID_EVALUATION_RAW.risksAndMitigants.slice(0, 2) };
  assert.throws(() => EvaluationLlmOutputSchema.parse(tooFewRisks));

  const wrongYearCount = {
    ...VALID_EVALUATION_RAW,
    financialModel: { ...VALID_EVALUATION_RAW.financialModel, projectedYears: VALID_EVALUATION_RAW.financialModel.projectedYears.slice(0, 3) },
  };
  assert.throws(() => EvaluationLlmOutputSchema.parse(wrongYearCount));
});

test("applyDeterministicFinancials: overrides a wrong LLM-claimed margin/growth", () => {
  const note = EvaluationLlmOutputSchema.parse(VALID_EVALUATION_RAW) as any;
  note.financialAnalysis.ebitdaMarginPct = 999; // a deliberately wrong claim
  note.financialModel.projectedYears[0].growthPct = -50; // a deliberately wrong claim

  const result = applyDeterministicFinancials(note);

  assert.ok(Math.abs(result.financialAnalysis.ebitdaMarginPct - 20) < 1e-9); // 20/100*100
  const firstProjectedGrowth = ((110 - 80) / 80) * 100; // vs. last historical year revenue (80)
  assert.ok(Math.abs(result.financialModel.projectedYears[0].growthPct - firstProjectedGrowth) < 1e-9);
});

test("applyDeterministicReturns: overrides wrong LLM-claimed irr/moic with the computed value", () => {
  const note = EvaluationLlmOutputSchema.parse(VALID_EVALUATION_RAW) as any;
  note.financialModel.returnsScenarios[1].irr = "999%"; // a deliberately wrong claim
  note.financialModel.returnsScenarios[1].moic = "999x";

  const result = applyDeterministicReturns(note);
  const base = result.financialModel.returnsScenarios.find((s: any) => s.case === "Base");

  // exit equity = 10 * 48 (FY28 EBITDA) - 15 (entry debt) = 465; moic = 465/200
  const expectedMoic = (10 * 48 - 15) / 200;
  assert.equal(base.moic, `${expectedMoic.toFixed(2)}x`);
  assert.notEqual(base.irr, "999%");
  assert.notEqual(base.moic, "999x");
});

const VALID_DOCUMENTATION_RAW = {
  documentType: "Share Purchase Agreement",
  keyFindings: ["Closing conditioned on regulatory approval"],
  riskFlags: [
    {
      flag: "Uncapped indemnification",
      severity: "high",
      rationale: "Exposes the buyer to unlimited liability post-closing.",
      recommendedAction: "Negotiate a cap at 20% of deal value.",
      quotedText: "The Seller shall indemnify the Buyer without limitation.",
      suggestedReplacementText: "The Seller's indemnification liability shall not exceed 20% of the Purchase Price.",
      classification: "sourced_fact",
    },
  ],
  complianceGaps: [],
  missingItems: [],
};

test("DocumentationLlmOutputSchema: valid payload parses", () => {
  const parsed = DocumentationLlmOutputSchema.parse(VALID_DOCUMENTATION_RAW);
  assert.equal(parsed.riskFlags[0].classification, "sourced_fact");
});

test("DocumentationLlmOutputSchema: a riskFlag missing classification, or with an invalid one, is rejected", () => {
  const { classification, ...flagWithoutClassification } = VALID_DOCUMENTATION_RAW.riskFlags[0];
  const missing = { ...VALID_DOCUMENTATION_RAW, riskFlags: [flagWithoutClassification] };
  assert.throws(() => DocumentationLlmOutputSchema.parse(missing));

  const invalid = { ...VALID_DOCUMENTATION_RAW, riskFlags: [{ ...VALID_DOCUMENTATION_RAW.riskFlags[0], classification: "just_a_guess" }] };
  assert.throws(() => DocumentationLlmOutputSchema.parse(invalid));
});

test("DocumentationLlmOutputSchema: missing documentType is rejected", () => {
  const { documentType, ...rest } = VALID_DOCUMENTATION_RAW;
  assert.throws(() => DocumentationLlmOutputSchema.parse(rest));
});
