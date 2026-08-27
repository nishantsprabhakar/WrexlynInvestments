/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 7 tests: each build* helper in the 3 new *.persist.ts files, given
 * a validated sample report/note/review, produces the exact expected
 * entity-shaped object — no LLM mocking needed since these are pure
 * mapping functions over already-validated data.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildScreeningAssessmentRecord } from "../flows/screening.persist";
import {
  buildEntryMetricInputs,
  buildProjectionYearInputs,
  buildCapitalStructureInput,
  buildReturnsCaseInputs,
  buildInvestmentArtifactInputs,
  buildRiskAndMitigantInputs as buildEvaluationRiskInputs,
  buildIcMemorandumInput,
  buildDebtFacilityInput,
} from "../flows/evaluation.persist";
import { buildRiskAndMitigantInputs as buildDocumentationRiskInputs, buildInvestmentArtifactInput } from "../flows/documentation.persist";

test("buildScreeningAssessmentRecord: maps a scored report onto the ScreeningAssessment shape", () => {
  const report = {
    overallRating: 73,
    grade: "C+",
    dimensions: [{ name: "Market Opportunity", score: 8, rationale: "x", extraField: "dropped" }],
    keyFacts: [{ text: "Founded 2015", classification: "sourced_fact" }],
    redFlags: [{ text: "Customer concentration", classification: "analyst_assumption" }],
    recommendation: "Advance to Preliminary DD",
  };

  const record = buildScreeningAssessmentRecord(report, "legacy:deal-1");

  assert.equal(record.dealId, "legacy:deal-1");
  assert.equal(record.overallRating, 73);
  assert.equal(record.grade, "C+");
  assert.deepEqual(record.dimensions, [{ name: "Market Opportunity", score: 8, rationale: "x" }]);
  assert.deepEqual(record.keyFacts, report.keyFacts);
  assert.deepEqual(record.redFlags, report.redFlags);
  assert.equal(record.recommendation, "Advance to Preliminary DD");
  assert.ok(typeof record.ranAt === "number");
});

const SAMPLE_NOTE = {
  financialAnalysis: { revenueCr: 100, ebitdaCr: 20, ebitdaMarginPct: 20, patCr: 10, debtCr: 15 },
  valuation: { askCr: 200 },
  financialModel: {
    historicalYears: [{ year: "FY23", revenueCr: 100, ebitdaCr: 20 }],
    projectedYears: [
      { year: "FY24", revenueCr: 110, ebitdaCr: 22, growthPct: 10 },
      { year: "FY28", revenueCr: 200, ebitdaCr: 48, growthPct: 14.28 },
    ],
    returnsScenarios: [{ case: "Base", exitYear: 5, irr: "18.4%", moic: "2.33x", irrPct: 18.4, moicValue: 2.325 }],
  },
};

test("buildEntryMetricInputs: revenue/ebitda/pat/debt are ai_interpretation, ebitda_margin is derived_calculation", () => {
  const metrics = buildEntryMetricInputs(SAMPLE_NOTE);
  const byMetric = Object.fromEntries(metrics.map((m) => [m.metric, m]));

  assert.equal(byMetric.revenue.value, 100);
  assert.equal(byMetric.revenue.provenance.classification, "ai_interpretation");
  assert.equal(byMetric.ebitda_margin.value, 20);
  assert.equal(byMetric.ebitda_margin.provenance.classification, "derived_calculation");
  assert.equal(byMetric.pat.value, 10);
  assert.equal(byMetric.debt.value, 15);
});

test("buildProjectionYearInputs: one entry per historical+projected year, growthPct only when present", () => {
  const years = buildProjectionYearInputs(SAMPLE_NOTE);
  assert.equal(years.length, 3); // 1 historical + 2 projected

  const historical = years.find((y) => y.label === "FY23")!;
  assert.equal(historical.periodType, "actual");
  assert.ok(!historical.metrics.some((m) => m.metric === "revenue_growth")); // historical year has no growthPct in the fixture

  const projected = years.find((y) => y.label === "FY24")!;
  assert.equal(projected.periodType, "projection");
  const growthMetric = projected.metrics.find((m) => m.metric === "revenue_growth")!;
  assert.equal(growthMetric.value, 10);
  assert.equal(growthMetric.provenance.classification, "derived_calculation");
});

test("buildCapitalStructureInput: converts Rs Cr to *M fields (1 Cr = 10 M)", () => {
  const input = buildCapitalStructureInput(SAMPLE_NOTE, "legacy:deal-1");
  assert.equal(input.dealId, "legacy:deal-1");
  assert.equal(input.equityM, 2000); // 200 Cr * 10
  assert.equal(input.seniorDebtM, 150); // 15 Cr * 10
  assert.equal(input.currency, "INR");
});

test("buildDebtFacilityInput: converts Rs Cr debt to *M and labels it a disclosed single-tranche default", () => {
  const input = buildDebtFacilityInput(SAMPLE_NOTE, "cst_1")!;
  assert.equal(input.capitalStructureId, "cst_1");
  assert.equal(input.name, "Term Loan A");
  assert.equal(input.type, "term_loan_a");
  assert.equal(input.principalM, 150); // 15 Cr * 10
  assert.deepEqual(input.covenants, []);
});

test("buildDebtFacilityInput: returns null when the note discloses no debt", () => {
  const noteWithoutDebt = { ...SAMPLE_NOTE, financialAnalysis: { ...SAMPLE_NOTE.financialAnalysis, debtCr: undefined } };
  assert.equal(buildDebtFacilityInput(noteWithoutDebt, "cst_1"), null);
});

test("buildReturnsCaseInputs: one ReturnsCase per scenario, using the raw numeric fields not the formatted strings", () => {
  const cases = buildReturnsCaseInputs(SAMPLE_NOTE, "legacy:deal-1");
  assert.equal(cases.length, 1);
  assert.equal(cases[0].scenario, "base");
  assert.equal(cases[0].exitYear, 5);
  assert.equal(cases[0].irrPct, 18.4);
  assert.equal(cases[0].moic, 2.325);
  assert.equal(cases[0].provenance.classification, "derived_calculation");
});

test("buildInvestmentArtifactInputs: one row per generated file, none for a missing path", () => {
  const both = buildInvestmentArtifactInputs("legacy:deal-1", "d1/IC_Note.docx", "d1/Financial_Model.xlsx");
  assert.equal(both.length, 2);
  assert.equal(both[0].kind, "ic_memo");
  assert.equal(both[1].kind, "financial_model");

  const docxOnly = buildInvestmentArtifactInputs("legacy:deal-1", "d1/IC_Note.docx", undefined);
  assert.equal(docxOnly.length, 1);
});

test("documentation buildRiskAndMitigantInputs: maps riskFlags onto RiskAndMitigant rows, status open, classification carried into provenance", () => {
  const review = {
    riskFlags: [
      { flag: "Customer concentration", severity: "high", recommendedAction: "Diversify", classification: "analyst_assumption" },
      { flag: "FX exposure", severity: "medium", classification: "sourced_fact" },
    ],
  };
  const rows = buildDocumentationRiskInputs(review, "legacy:deal-1");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].risk, "Customer concentration");
  assert.equal(rows[0].severity, "high");
  assert.equal(rows[0].mitigant, "Diversify");
  assert.equal(rows[0].status, "open");
  assert.equal(rows[0].provenance.classification, "analyst_assumption");
  assert.equal(rows[1].mitigant, undefined);
  assert.equal(rows[1].provenance.classification, "sourced_fact");
});

test("evaluation buildRiskAndMitigantInputs: maps risksAndMitigants onto RiskAndMitigant rows with provenance", () => {
  const note = {
    risksAndMitigants: [
      { risk: "Customer concentration", severity: "high", mitigant: "Diversify", classification: "analyst_assumption" },
      { risk: "Regulatory change", severity: "medium", mitigant: "Monitor filings", classification: "ai_interpretation" },
    ],
  };
  const rows = buildEvaluationRiskInputs(note, "legacy:deal-1");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dealId, "legacy:deal-1");
  assert.equal(rows[0].risk, "Customer concentration");
  assert.equal(rows[0].mitigant, "Diversify");
  assert.equal(rows[0].status, "open");
  assert.equal(rows[0].provenance.classification, "analyst_assumption");
  assert.equal(rows[1].provenance.classification, "ai_interpretation");
});

test("buildInvestmentArtifactInput: a redline artifact", () => {
  const artifact = buildInvestmentArtifactInput("legacy:deal-1", "d1/contract_redlined.docx");
  assert.deepEqual(artifact, {
    dealId: "legacy:deal-1",
    kind: "redline",
    relPath: "d1/contract_redlined.docx",
    generatedBy: "ai",
    sourceFlow: "documentation",
  });
});

test("buildIcMemorandumInput: maps note's narrative fields into sections, omitting empty ones, draft status", () => {
  const note = {
    executiveSummary: "A solid opportunity.",
    investmentThesis: "Strong growth trajectory.",
    businessOverview: "",
    financialAnalysis: { commentary: "Steady margins." },
    valuation: { commentary: undefined },
    recommendation: "Advance",
    proposedTerms: "",
  };
  const memo = buildIcMemorandumInput(note, "legacy:deal-1", 2);
  assert.equal(memo.dealId, "legacy:deal-1");
  assert.equal(memo.memoVersion, 2);
  assert.equal(memo.status, "draft");
  assert.deepEqual(memo.sections, {
    executiveSummary: "A solid opportunity.",
    investmentThesis: "Strong growth trajectory.",
    financialAnalysisCommentary: "Steady margins.",
    recommendation: "Advance",
  });
  assert.ok(!("businessOverview" in memo.sections));
  assert.ok(!("valuationCommentary" in memo.sections));
  assert.ok(!("proposedTerms" in memo.sections));
});
