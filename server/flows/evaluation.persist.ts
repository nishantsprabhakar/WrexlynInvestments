/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 7: maps a validated + deterministically-computed evaluation note
 * into the shapes server/domain/entities/financials.ts's FinancialMetric,
 * CapitalStructure, and ReturnsCase expect — pure, no I/O, independently
 * testable without mocking the LLM.
 */

export interface FinancialMetricInput {
  metric: string;
  value: number;
  unit: string;
  provenance: { classification: "ai_interpretation" | "derived_calculation"; sourceId?: string };
}

/**
 * The base-year actuals from financialAnalysis — revenue/EBITDA/PAT/debt
 * are LLM-extracted, ebitda_margin is Phase 5's deterministic calculation.
 * sourceId (Phase 10) is the financial model's Source, since these figures
 * are drawn from it.
 */
export function buildEntryMetricInputs(note: any, sourceId?: string): FinancialMetricInput[] {
  const fa = note.financialAnalysis;
  const entries: Array<[string, number | undefined, string, "ai_interpretation" | "derived_calculation"]> = [
    ["revenue", fa.revenueCr, "INR_Cr", "ai_interpretation"],
    ["ebitda", fa.ebitdaCr, "INR_Cr", "ai_interpretation"],
    ["ebitda_margin", fa.ebitdaMarginPct, "pct", "derived_calculation"],
    ["pat", fa.patCr, "INR_Cr", "ai_interpretation"],
    ["debt", fa.debtCr, "INR_Cr", "ai_interpretation"],
  ];
  return entries
    .filter(([, value]) => value != null)
    .map(([metric, value, unit, classification]) => ({ metric, value: value as number, unit, provenance: { classification, sourceId } }));
}

export interface ProjectionYearInput {
  label: string;
  periodType: "actual" | "projection";
  metrics: FinancialMetricInput[];
}

/** One FinancialPeriod's worth of metrics per historical/projected year. sourceId is the financial model's Source. */
export function buildProjectionYearInputs(note: any, sourceId?: string): ProjectionYearInput[] {
  const toYear = (y: any, periodType: "actual" | "projection"): ProjectionYearInput => {
    const metrics: FinancialMetricInput[] = [
      { metric: "revenue", value: y.revenueCr, unit: "INR_Cr", provenance: { classification: "ai_interpretation", sourceId } },
      { metric: "ebitda", value: y.ebitdaCr, unit: "INR_Cr", provenance: { classification: "ai_interpretation", sourceId } },
    ];
    if (y.growthPct != null) {
      metrics.push({ metric: "revenue_growth", value: y.growthPct, unit: "pct", provenance: { classification: "derived_calculation", sourceId } });
    }
    return { label: y.year, periodType, metrics };
  };
  const hist = (note.financialModel.historicalYears || []).map((y: any) => toYear(y, "actual"));
  const proj = (note.financialModel.projectedYears || []).map((y: any) => toYear(y, "projection"));
  return [...hist, ...proj];
}

const CR_TO_M = 10; // domain entities use *M (millions); the flow's figures are Rs Cr (crores) — 1 Cr = 10 M.

export function buildCapitalStructureInput(note: any, dealId: string) {
  const fa = note.financialAnalysis;
  return {
    dealId,
    equityM: note.valuation.askCr * CR_TO_M,
    seniorDebtM: fa.debtCr != null ? fa.debtCr * CR_TO_M : undefined,
    currency: "INR",
  };
}

export function buildReturnsCaseInputs(note: any, dealId: string) {
  return (note.financialModel.returnsScenarios || []).map((s: any) => ({
    dealId,
    scenario: String(s.case).toLowerCase() as "bear" | "base" | "bull",
    exitYear: s.exitYear,
    irrPct: s.irrPct ?? undefined,
    moic: s.moicValue ?? undefined,
    provenance: { classification: "derived_calculation" as const },
  }));
}

/**
 * Evaluation's risksAndMitigants were never persisted into the domain
 * RiskAndMitigant entity before Phase 9 — only documentation's riskFlags
 * were (Phase 7). sourceId (Phase 10) is the deck's Source, since risk
 * narrative typically comes from the deck rather than the model.
 */
export function buildRiskAndMitigantInputs(note: any, dealId: string, sourceId?: string) {
  return (note.risksAndMitigants || []).map((r: any) => ({
    dealId,
    risk: r.risk,
    severity: r.severity as "high" | "medium" | "low",
    mitigant: r.mitigant,
    status: "open" as const,
    provenance: { classification: r.classification, sourceId },
  }));
}

/**
 * Phase 11: a real, versioned ICMemorandum instead of only a generated
 * .docx — maps note's narrative fields into the sections shape
 * domain/entities/ic.ts's ICMemorandum expects, dropping empty ones so a
 * missing field isn't recorded as an empty-string section.
 */
export function buildIcMemorandumInput(note: any, dealId: string, memoVersion: number) {
  const sectionEntries: Array<[string, string | undefined]> = [
    ["executiveSummary", note.executiveSummary],
    ["investmentThesis", note.investmentThesis],
    ["businessOverview", note.businessOverview],
    ["financialAnalysisCommentary", note.financialAnalysis?.commentary],
    ["valuationCommentary", note.valuation?.commentary],
    ["recommendation", note.recommendation],
    ["proposedTerms", note.proposedTerms],
  ];
  const sections: Record<string, string> = {};
  for (const [key, value] of sectionEntries) {
    if (value) sections[key] = value;
  }
  return { dealId, memoVersion, sections, status: "draft" as const };
}

export function buildInvestmentArtifactInputs(dealId: string, docxPath?: string, xlsxPath?: string) {
  const inputs: Array<{ dealId: string; kind: "ic_memo" | "financial_model"; relPath: string; generatedBy: "ai"; sourceFlow: string }> = [];
  if (docxPath) inputs.push({ dealId, kind: "ic_memo", relPath: docxPath, generatedBy: "ai", sourceFlow: "evaluation" });
  if (xlsxPath) inputs.push({ dealId, kind: "financial_model", relPath: xlsxPath, generatedBy: "ai", sourceFlow: "evaluation" });
  return inputs;
}
