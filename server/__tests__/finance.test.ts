/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 5 finance-engine tests: every deterministic calculation function
 * checked against a hand-computed expected value.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  growthPct,
  marginPct,
  weightedAverageScore,
  xirr,
  moic,
  lboReturns,
  dcfValue,
  terminalValueGordonGrowth,
  impliedValuationFromMultiple,
  capTableSumCheck,
  capTableDilution,
} from "../domain/finance/calculations";
import { deriveGrade } from "../domain/finance/grading";

test("growthPct: standard case and guards", () => {
  assert.equal(growthPct(100, 120), 20);
  assert.equal(growthPct(0, 120), null);
  assert.equal(growthPct(-10, 120), null);
});

test("marginPct: standard case and zero-denominator guard", () => {
  assert.equal(marginPct(25, 100), 25);
  assert.equal(marginPct(25, 0), null);
});

test("weightedAverageScore: equal-weight average x10, rounded", () => {
  const scores = [8, 8, 7, 6, 9, 5, 7, 8]; // avg = 7.25 -> 72.5 -> 73
  assert.equal(weightedAverageScore(scores), 73);
  assert.equal(weightedAverageScore([]), 0);
});

test("deriveGrade: boundary values match documented sub-buckets", () => {
  assert.equal(deriveGrade(39), "F");
  assert.equal(deriveGrade(40), "D");
  assert.equal(deriveGrade(57), "D");
  assert.equal(deriveGrade(58), "C-");
  assert.equal(deriveGrade(73), "C+");
  assert.equal(deriveGrade(74), "B-");
  assert.equal(deriveGrade(87), "B+");
  assert.equal(deriveGrade(88), "A");
  assert.equal(deriveGrade(95), "A+");
});

test("xirr: simple 2-flow case matches hand-computed CAGR", () => {
  const rate = xirr([
    { amount: -100, date: "2020-01-01" },
    { amount: 200, date: "2025-01-01" },
  ]);
  assert.ok(rate !== null);
  const expected = Math.pow(2, 1 / 5) - 1; // ~14.87%
  assert.ok(Math.abs((rate as number) - expected) < 0.001);
});

test("xirr: irregular multi-round VC-style cash flows", () => {
  // Invest 50 at t0, invest 30 one year later (follow-on), distribute 240 three years after that.
  const rate = xirr([
    { amount: -50, date: "2021-01-01" },
    { amount: -30, date: "2022-01-01" },
    { amount: 240, date: "2025-01-01" },
  ]);
  assert.ok(rate !== null);
  // Sanity check: plugging the solved rate back into NPV should be ~0.
  const t0 = new Date("2021-01-01").getTime();
  const yearsMs = 365 * 24 * 60 * 60 * 1000;
  const npv =
    -50 / Math.pow(1 + (rate as number), 0) +
    -30 / Math.pow(1 + (rate as number), (new Date("2022-01-01").getTime() - t0) / yearsMs) +
    240 / Math.pow(1 + (rate as number), (new Date("2025-01-01").getTime() - t0) / yearsMs);
  assert.ok(Math.abs(npv) < 0.01);
});

test("xirr: all-same-sign flows return null (no possible IRR)", () => {
  assert.equal(
    xirr([
      { amount: 10, date: "2020-01-01" },
      { amount: 20, date: "2021-01-01" },
    ]),
    null
  );
});

test("moic: standard case and non-positive-contribution guard", () => {
  assert.equal(moic(100, 320), 3.2);
  assert.equal(moic(0, 320), null);
});

test("lboReturns: matches hand-computed CAGR for a 5-year hold", () => {
  const result = lboReturns({ entryValue: 100, exitValue: 200, exitYear: 5 });
  assert.equal(result.moic, 2);
  assert.ok(result.irrPct !== null);
  const expected = (Math.pow(2, 1 / 5) - 1) * 100;
  assert.ok(Math.abs((result.irrPct as number) - expected) < 0.1);
});

test("lboReturns: non-positive exit clamps to a total loss, no NaN/Infinity", () => {
  const result = lboReturns({ entryValue: 100, exitValue: -20, exitYear: 5 });
  assert.deepEqual(result, { irrPct: -100, moic: 0 });
});

test("dcfValue: simple hand-computed case", () => {
  // Two years of $10 cash flow at 10% discount, no terminal value.
  const value = dcfValue({ cashFlows: [10, 10], discountRate: 0.1 });
  const expected = 10 / 1.1 + 10 / 1.21;
  assert.ok(Math.abs(value - expected) < 1e-9);
});

test("terminalValueGordonGrowth: standard case and discount<=growth guard", () => {
  const tv = terminalValueGordonGrowth(10, 0.1, 0.03);
  assert.ok(Math.abs((tv as number) - (10 * 1.03) / 0.07) < 1e-9);
  assert.equal(terminalValueGordonGrowth(10, 0.03, 0.1), null);
});

test("impliedValuationFromMultiple", () => {
  assert.equal(impliedValuationFromMultiple(50, 10), 500);
});

test("capTableSumCheck: valid and invalid sums", () => {
  assert.equal(capTableSumCheck([{ ownershipPct: 60 }, { ownershipPct: 40 }]).valid, true);
  const invalid = capTableSumCheck([{ ownershipPct: 60 }, { ownershipPct: 30 }]);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.totalPct, 90);
});

test("capTableDilution: standard priced-round example sums to 100", () => {
  const result = capTableDilution({
    existingRows: [
      { holder: "Founders", ownershipPct: 70 },
      { holder: "Seed Investors", ownershipPct: 30 },
    ],
    preMoneyM: 40,
    newInvestmentM: 10,
  });
  assert.equal(result.postMoneyM, 50);
  assert.equal(result.newInvestorPct, 20);
  const founders = result.updatedRows.find((r) => r.holder === "Founders")!;
  assert.ok(Math.abs(founders.ownershipPct - 56) < 1e-9); // 70 * (40/50)
  const totalPct = result.updatedRows.reduce((s, r) => s + r.ownershipPct, 0) + result.newInvestorPct;
  assert.ok(Math.abs(totalPct - 100) < 1e-9);
});
