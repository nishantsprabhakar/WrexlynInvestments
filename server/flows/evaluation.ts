/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Flow 2: Deal Evaluation — deck + financial model uploads → a full IC Note
 * (thesis, financials, valuation, risks paired with mitigants,
 * recommendation) rendered on-screen AND generated as a real .docx (via
 * Wrexlyn's create_docx) and a real .xlsx financial model with live
 * formulas (via Wrexlyn's create_xlsx) — not just a rendered report.
 */
import { runStructuredJson } from "../lib/aiFlow";
import { ingestUploadedFile, type UploadedFile } from "../lib/ingest";
import { dealWorkspaceRoot } from "../lib/workspace";
import { upsertDealByCompanyName, STAGES, type Deal } from "../pipeline/store";
import { createDocxTool, createXlsxTool } from "wrexlyn";
import { EvaluationLlmOutputSchema } from "./schemas";
import { applyDeterministicFinancials, applyDeterministicReturns } from "./evaluation.calc";
import { recordAuditEntry } from "../domain/audit/auditLog";
import { syncDomainDeal } from "../domain/sync";
import { financialPeriods, financialMetrics, capitalStructures, returnsCases, investmentArtifacts, risksAndMitigants } from "../domain/repositories";
import {
  buildEntryMetricInputs,
  buildProjectionYearInputs,
  buildCapitalStructureInput,
  buildReturnsCaseInputs,
  buildInvestmentArtifactInputs,
  buildRiskAndMitigantInputs,
} from "./evaluation.persist";
import { CLASSIFICATION_RULES } from "./promptFragments";

const EVALUATION_SYSTEM = `You are a senior private-equity investment associate drafting a full Investment Committee (IC) note from a company deck and financial model. Be decisive, specific, and quantitative — this feeds a real investment decision.

Return ONLY valid JSON in exactly this shape:
{
  "companyName": "string",
  "executiveSummary": "3-5 sentence summary of the opportunity and recommendation",
  "investmentThesis": "the core thesis for why this is (or isn't) an attractive investment, 150+ words",
  "businessOverview": "products, business model, go-to-market, moat, 150+ words",
  "financialAnalysis": {
    "revenueCr": 0, "ebitdaCr": 0, "patCr": 0, "debtCr": 0,
    "commentary": "trend analysis, quality of earnings, working capital, 100+ words"
  },
  "valuation": { "askCr": 0, "impliedMultiple": "e.g. 12x EV/EBITDA", "commentary": "valuation view vs comparable transactions, 80+ words" },
  "risksAndMitigants": [
    {"risk": "specific risk", "severity": "high|medium|low", "mitigant": "specific, concrete mitigant — never 'monitor closely' alone", "classification": "analyst_assumption"}
  ],
  "recommendation": "Advance|Hold|Pass",
  "proposedTerms": "proposed structure/terms if recommendation is Advance, else empty string",
  "financialModel": {
    "historicalYears": [{"year": "FY22", "revenueCr": 0, "ebitdaCr": 0}],
    "projectedYears": [
      {"year": "FY24", "revenueCr": 0, "ebitdaCr": 0}
    ],
    "returnsScenarios": [
      {"case": "Bear", "exitYear": 5, "exitMultiple": 8.0},
      {"case": "Base", "exitYear": 5, "exitMultiple": 10.0},
      {"case": "Bull", "exitYear": 5, "exitMultiple": 13.0}
    ]
  }
}

Rules:
- risksAndMitigants must have at least 5 entries, each risk paired with a genuinely specific mitigant.
- projectedYears must cover exactly 5 forward years.
- historicalYears covers up to 3 past years if the source data supports it, else an empty array.
- Base every number on the deck/model text provided; where data is missing, use clearly-labeled conservative estimates rather than omitting the field.
- exitMultiple is your assumed exit EV/EBITDA multiple for that scenario (a number, e.g. 10.0, not a string) — do not state IRR or MOIC yourself, the platform computes both deterministically from this assumption plus the projected exit-year EBITDA and the investment ask.
- exitYear must be an integer 1-5, matching one of the 5 projectedYears entries.
- Do not include ebitdaMarginPct or growthPct fields — the platform computes both deterministically from your revenue/EBITDA figures.
- Every risksAndMitigants entry must carry a "classification". ${CLASSIFICATION_RULES}
Return ONLY the JSON object, no markdown fences, no commentary.`;

function icNoteBlocks(note: any): any[] {
  const fa = note.financialAnalysis || {};
  const val = note.valuation || {};
  const risks = note.risksAndMitigants || [];

  const blocks: any[] = [
    { type: "heading", level: 1, text: `${note.companyName || "Company"} — Investment Committee Note` },
    { type: "toc" },
    { type: "heading", level: 2, text: "Executive Summary" },
    { type: "paragraph", text: note.executiveSummary || "" },
    { type: "heading", level: 2, text: "Investment Thesis" },
    { type: "paragraph", text: note.investmentThesis || "" },
    { type: "heading", level: 2, text: "Business Overview" },
    { type: "paragraph", text: note.businessOverview || "" },
    { type: "heading", level: 2, text: "Financial Analysis" },
    {
      type: "table",
      headers: ["Metric", "Value"],
      rows: [
        ["Revenue (Cr)", String(fa.revenueCr ?? "—")],
        ["EBITDA (Cr)", String(fa.ebitdaCr ?? "—")],
        ["EBITDA Margin %", fa.ebitdaMarginPct != null ? `${fa.ebitdaMarginPct}%` : "—"],
        ["PAT (Cr)", String(fa.patCr ?? "—")],
        ["Debt (Cr)", String(fa.debtCr ?? "—")],
      ],
    },
    { type: "paragraph", text: fa.commentary || "" },
    { type: "heading", level: 2, text: "Valuation" },
    { type: "paragraph", text: `Investment ask: ${val.askCr != null ? val.askCr + " Cr" : "—"}. Implied multiple: ${val.impliedMultiple || "—"}.` },
    { type: "paragraph", text: val.commentary || "" },
    { type: "heading", level: 2, text: "Risks & Mitigants" },
    {
      type: "table",
      headers: ["Risk", "Severity", "Mitigant"],
      rows: risks.map((r: any) => [String(r.risk || ""), String(r.severity || ""), String(r.mitigant || "")]),
    },
    { type: "heading", level: 2, text: "Recommendation" },
    { type: "paragraph", text: `**Recommendation: ${note.recommendation || "—"}**` },
  ];
  if (note.proposedTerms) {
    blocks.push({ type: "paragraph", text: note.proposedTerms });
  }
  return blocks;
}

function financialModelSheets(fm: any): any[] {
  const hist = (fm?.historicalYears || []).map((y: any) => ({ ...y, kind: "Actual" }));
  const proj = (fm?.projectedYears || []).map((y: any) => ({ ...y, kind: "Projected" }));
  const rows = [...hist, ...proj];

  const revenueRows = rows.map((y, i) => {
    const rowNum = i + 2; // header is row 1
    const revenueCol = "B";
    const ebitdaCol = "C";
    return [
      y.year,
      y.kind,
      y.revenueCr ?? 0,
      y.ebitdaCr ?? 0,
      `=${ebitdaCol}${rowNum}/${revenueCol}${rowNum}*100`,
      y.growthPct != null ? y.growthPct : "",
    ];
  });

  const returnsRows = (fm?.returnsScenarios || []).map((s: any) => [s.case, s.exitYear, s.irr, s.moic]);

  return [
    {
      name: "Financial Model",
      headers: [
        { name: "Year" },
        { name: "Type" },
        { name: "Revenue (Cr)", numberFormat: "#,##0.0" },
        { name: "EBITDA (Cr)", numberFormat: "#,##0.0" },
        { name: "EBITDA Margin %", numberFormat: "0.0" },
        { name: "Growth %", numberFormat: "0.0" },
      ],
      rows: revenueRows,
    },
    {
      name: "Returns Scenarios",
      headers: ["Case", "Exit Year", "IRR", "MOIC"],
      rows: returnsRows,
    },
  ];
}

export interface EvaluationInput {
  companyName: string;
  deckFile: UploadedFile;
  modelFile: UploadedFile;
}

export async function runEvaluationFlow(input: EvaluationInput) {
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("Company name is required.");
  if (!input.deckFile) throw new Error("A company deck is required for evaluation.");
  if (!input.modelFile) throw new Error("A financial model is required for evaluation.");

  const deal = upsertDealByCompanyName(companyName, {});
  const root = dealWorkspaceRoot(deal.id);

  const [deckIngest, modelIngest] = await Promise.all([
    ingestUploadedFile(root, input.deckFile),
    ingestUploadedFile(root, input.modelFile),
  ]);

  const userContent = [
    `Company: ${companyName}`,
    `\n=== COMPANY DECK (extracted text) ===\n${(deckIngest.ok ? deckIngest.text : "").slice(0, 15000)}\n=== END DECK ===`,
    `\n=== FINANCIAL MODEL (extracted data) ===\n${(modelIngest.ok ? modelIngest.text : "").slice(0, 12000)}\n=== END FINANCIAL MODEL ===`,
  ].join("\n");

  const raw = await runStructuredJson(EVALUATION_SYSTEM, userContent);
  const validated = EvaluationLlmOutputSchema.parse(raw);
  const note = applyDeterministicReturns(applyDeterministicFinancials(validated));

  const docxResult = await createDocxTool.run(
    { path: "IC_Note.docx", title: `${companyName} — Investment Committee Note`, blocks: icNoteBlocks(note) },
    { root }
  );
  const xlsxResult = await createXlsxTool.run(
    { path: "Financial_Model.xlsx", sheets: financialModelSheets(note.financialModel) },
    { root }
  );

  const updated = upsertDealByCompanyName(companyName, {
    stage: [STAGES[0], STAGES[1]].includes(deal.stage) ? STAGES[2] : deal.stage,
    financials: {
      revenueCr: note.financialAnalysis?.revenueCr,
      ebitdaCr: note.financialAnalysis?.ebitdaCr,
      ebitdaMarginPct: note.financialAnalysis?.ebitdaMarginPct,
    },
    evaluation: {
      icNoteDocPath: docxResult.ok ? `${deal.id}/IC_Note.docx` : undefined,
      modelXlsxPath: xlsxResult.ok ? `${deal.id}/Financial_Model.xlsx` : undefined,
      recommendation: note.recommendation,
      ranAt: Date.now(),
    },
  } as Partial<Deal>);

  recordAuditEntry({
    dealId: updated.id,
    companyName,
    flow: "evaluation",
    inputSummary: `deck: ${input.deckFile.name}, model: ${input.modelFile.name}`,
    outputSummary: {
      ebitdaMarginPct: note.financialAnalysis?.ebitdaMarginPct,
      recommendation: note.recommendation,
      returnsScenarios: note.financialModel?.returnsScenarios,
    },
    validationOk: true,
  });

  const { companyId, dealId: domainDealId } = syncDomainDeal(updated);

  const entryPeriod = financialPeriods.create({
    companyId,
    dealId: domainDealId,
    label: "Entry (evaluation flow)",
    periodType: "actual",
    currency: "INR",
  });
  for (const metric of buildEntryMetricInputs(note)) {
    financialMetrics.create({ financialPeriodId: entryPeriod.id, ...metric });
  }
  for (const year of buildProjectionYearInputs(note)) {
    const period = financialPeriods.create({ companyId, dealId: domainDealId, label: year.label, periodType: year.periodType, currency: "INR" });
    for (const metric of year.metrics) financialMetrics.create({ financialPeriodId: period.id, ...metric });
  }

  capitalStructures.create(buildCapitalStructureInput(note, domainDealId));
  for (const returnsCase of buildReturnsCaseInputs(note, domainDealId)) returnsCases.create(returnsCase);
  for (const risk of buildRiskAndMitigantInputs(note, domainDealId)) risksAndMitigants.create(risk);
  for (const artifact of buildInvestmentArtifactInputs(
    domainDealId,
    docxResult.ok ? `${deal.id}/IC_Note.docx` : undefined,
    xlsxResult.ok ? `${deal.id}/Financial_Model.xlsx` : undefined
  )) {
    investmentArtifacts.create(artifact);
  }

  return {
    deal: updated,
    note,
    docx: docxResult,
    xlsx: xlsxResult,
  };
}
