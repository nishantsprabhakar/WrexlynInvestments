/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 5: overlays deterministically-computed financial figures onto a
 * validated evaluation note, replacing whatever the LLM claimed for
 * margin/growth/returns (Core Principle 6). The LLM still supplies the
 * base figures it extracted (revenue/EBITDA/debt) and the exit-multiple
 * assumption per scenario — those are legitimate LLM judgment calls; the
 * derived numbers are computed here instead.
 */
import { growthPct, marginPct, lboReturns } from "../domain/finance/calculations";
import type { EvaluationLlmOutput } from "./schemas";

/** Recomputes ebitdaMarginPct and each projected year's growthPct from the LLM-extracted revenue/EBITDA figures. */
export function applyDeterministicFinancials(note: EvaluationLlmOutput): any {
  const fa = note.financialAnalysis;
  const ebitdaMarginPct = marginPct(fa.ebitdaCr, fa.revenueCr);
  const hist = note.financialModel.historicalYears;
  const proj = note.financialModel.projectedYears;

  const updatedProj = proj.map((year, i) => {
    const priorRevenue = i === 0 ? hist[hist.length - 1]?.revenueCr : proj[i - 1].revenueCr;
    const growth = priorRevenue != null ? growthPct(priorRevenue, year.revenueCr) : null;
    return { ...year, growthPct: growth ?? undefined };
  });

  return {
    ...note,
    financialAnalysis: { ...fa, ebitdaMarginPct: ebitdaMarginPct ?? 0 },
    financialModel: { ...note.financialModel, projectedYears: updatedProj },
  };
}

/**
 * Computes IRR/MOIC per returns scenario from the LLM's exit-multiple
 * assumption, the matching projected year's EBITDA, entry net debt, and
 * the investment ask — never from LLM-stated IRR/MOIC text. Output keeps
 * the pre-Phase-5 display contract ({case, exitYear, irr, moic} strings)
 * so downstream document/spreadsheet generation needs no changes, and adds
 * raw `irrPct`/`moicValue` numeric fields (Phase 7) so persistence into a
 * ReturnsCase entity never has to re-parse formatted text like "18.4%".
 */
export function applyDeterministicReturns(note: any): any {
  const fa = note.financialAnalysis;
  const ask = note.valuation.askCr;
  const proj = note.financialModel.projectedYears;

  const returnsScenarios = note.financialModel.returnsScenarios.map((s: any) => {
    const exitEbitda = proj[s.exitYear - 1]?.ebitdaCr ?? 0;
    const exitEquity = s.exitMultiple * exitEbitda - (fa.debtCr ?? 0);
    const { irrPct, moic } = lboReturns({ entryValue: ask, exitValue: exitEquity, exitYear: s.exitYear });
    return {
      case: s.case,
      exitYear: s.exitYear,
      irr: irrPct != null ? `${irrPct.toFixed(1)}%` : "—",
      moic: moic != null ? `${moic.toFixed(2)}x` : "—",
      irrPct,
      moicValue: moic,
    };
  });

  return {
    ...note,
    financialModel: { ...note.financialModel, returnsScenarios },
  };
}
