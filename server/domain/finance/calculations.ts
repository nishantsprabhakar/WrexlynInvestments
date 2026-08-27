/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 5: deterministic finance engine — Core Principle 6 ("LLMs never
 * authoritative for financial calculations"). Every function here is pure
 * (no I/O, no LLM calls) and unit-tested in ../../__tests__/finance.test.ts.
 */

export function growthPct(prior: number, current: number): number | null {
  if (!Number.isFinite(prior) || !Number.isFinite(current) || prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

export function marginPct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/** Equal-weight average of 0-10 dimension scores, scaled ×10 and rounded to a 0-100 rating. */
export function weightedAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round(avg * 10);
}

export interface CashFlow {
  amount: number;
  date: Date | string;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_YEAR;
}

function npv(rate: number, flows: { amount: number; t: number }[]): number {
  return flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, f.t), 0);
}

function npvDerivative(rate: number, flows: { amount: number; t: number }[]): number {
  return flows.reduce((sum, f) => sum - (f.t * f.amount) / Math.pow(1 + rate, f.t + 1), 0);
}

/**
 * Internal rate of return for irregular, dated cash flows. Newton-Raphson
 * first, falling back to bisection over a bounded [-99%, +1000%] annual
 * range if Newton-Raphson doesn't converge. Returns null if the flows can't
 * bracket a root (e.g. all one sign — no possible IRR).
 */
export function xirr(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((f) => f.amount > 0);
  const hasNegative = cashFlows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const dates = cashFlows.map((f) => toDate(f.date));
  const t0 = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  const flows = cashFlows.map((f, i) => ({ amount: f.amount, t: yearsBetween(t0, dates[i]) }));

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, flows);
    const deriv = npvDerivative(rate, flows);
    if (Math.abs(deriv) < 1e-12) break;
    const next = rate - value / deriv;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-9) {
      rate = next;
      break;
    }
    rate = next;
  }
  if (Number.isFinite(rate) && rate > -1 && Math.abs(npv(rate, flows)) < 1e-4) return rate;

  let lo = -0.99;
  let hi = 10;
  let npvLo = npv(lo, flows);
  const npvHi = npv(hi, flows);
  if (Math.abs(npvLo) < 1e-7) return lo;
  if (Math.abs(npvHi) < 1e-7) return hi;
  if (npvLo > 0 === npvHi > 0) return null; // no sign change in range — can't bracket a root

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid, flows);
    if (Math.abs(npvMid) < 1e-7) return mid;
    if (npvMid > 0 === npvLo > 0) {
      lo = mid;
      npvLo = npvMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function moic(contributions: number, distributions: number): number | null {
  if (!Number.isFinite(contributions) || contributions <= 0) return null;
  return distributions / contributions;
}

export interface LboReturnsInput {
  entryValue: number;
  exitValue: number;
  exitYear: number;
  entryDate?: Date | string;
}

export interface LboReturnsResult {
  irrPct: number | null;
  moic: number | null;
}

/** Single entry / single exit return, expressed as IRR + MOIC. A total loss (exitValue <= 0) clamps rather than producing NaN/Infinity. */
export function lboReturns(input: LboReturnsInput): LboReturnsResult {
  if (input.exitValue <= 0) return { irrPct: -100, moic: 0 };
  const m = moic(input.entryValue, input.exitValue);
  if (m === null) return { irrPct: null, moic: null };
  const entryDate = toDate(input.entryDate ?? new Date(0));
  const exitDate = new Date(entryDate.getTime() + input.exitYear * MS_PER_YEAR);
  const irr = xirr([
    { amount: -input.entryValue, date: entryDate },
    { amount: input.exitValue, date: exitDate },
  ]);
  return { irrPct: irr !== null ? irr * 100 : null, moic: m };
}

export interface DcfInput {
  cashFlows: number[];
  discountRate: number;
  terminalValue?: number;
}

export function dcfValue(input: DcfInput): number {
  const { cashFlows, discountRate, terminalValue = 0 } = input;
  let value = cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1), 0);
  if (terminalValue) value += terminalValue / Math.pow(1 + discountRate, cashFlows.length);
  return value;
}

export function terminalValueGordonGrowth(
  finalCashFlow: number,
  discountRate: number,
  perpetualGrowthRate: number
): number | null {
  if (discountRate <= perpetualGrowthRate) return null;
  return (finalCashFlow * (1 + perpetualGrowthRate)) / (discountRate - perpetualGrowthRate);
}

export function impliedValuationFromMultiple(metricValue: number, multiple: number): number {
  return metricValue * multiple;
}

export interface CapTableRow {
  holder: string;
  ownershipPct: number;
}

export function capTableSumCheck(
  rows: { ownershipPct: number }[],
  toleranceBp = 25
): { valid: boolean; totalPct: number } {
  const totalPct = rows.reduce((sum, r) => sum + r.ownershipPct, 0);
  const toleranceCheckPct = toleranceBp / 100;
  return { valid: Math.abs(totalPct - 100) <= toleranceCheckPct, totalPct };
}

export interface CapTableDilutionInput {
  existingRows: CapTableRow[];
  preMoneyM: number;
  newInvestmentM: number;
}

export interface CapTableDilutionResult {
  postMoneyM: number;
  newInvestorPct: number;
  dilutionFactor: number;
  updatedRows: CapTableRow[];
}

/** Standard priced-round dilution: existing holders scale by preMoney/postMoney, the new investor takes the remainder. */
export function capTableDilution(input: CapTableDilutionInput): CapTableDilutionResult {
  const { existingRows, preMoneyM, newInvestmentM } = input;
  const postMoneyM = preMoneyM + newInvestmentM;
  const newInvestorPct = (newInvestmentM / postMoneyM) * 100;
  const dilutionFactor = preMoneyM / postMoneyM;
  const updatedRows = existingRows.map((r) => ({ holder: r.holder, ownershipPct: r.ownershipPct * dilutionFactor }));
  return { postMoneyM, newInvestorPct, dilutionFactor, updatedRows };
}
