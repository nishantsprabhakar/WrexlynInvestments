/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 13 tests: buildValuationCaseInput calls Phase 5's valuation engine
 * for dcf/arr_multiple, and passes impliedValueM through untouched for
 * methods with no deterministic calculation available.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildValuationCaseInput } from "../domain/valuationActions";

test("buildValuationCaseInput: dcf method matches hand-checked dcfValue/terminalValueGordonGrowth", () => {
  const input = buildValuationCaseInput("legacy:deal-1", {
    method: "dcf",
    cashFlows: [10, 12, 14],
    discountRate: 0.1,
    perpetualGrowthRate: 0.03,
  });
  assert.equal(input.dealId, "legacy:deal-1");
  assert.equal(input.method, "dcf");
  assert.equal(input.assumptions.discountRate, 0.1);
  assert.equal(input.assumptions.perpetualGrowthRate, 0.03);
  assert.ok(input.impliedValueM != null);
  assert.ok(Math.abs((input.impliedValueM as number) - 184.2975) < 0.01);
});

test("buildValuationCaseInput: dcf method without a growth rate omits terminal value", () => {
  const input = buildValuationCaseInput("legacy:deal-1", {
    method: "dcf",
    cashFlows: [10, 10],
    discountRate: 0.1,
  });
  // matches finance.test.ts's own dcfValue({cashFlows: [10, 10], discountRate: 0.1}) fixture
  assert.ok(Math.abs((input.impliedValueM as number) - (10 / 1.1 + 10 / 1.21)) < 0.001);
  assert.equal(input.assumptions.perpetualGrowthRate, undefined);
});

test("buildValuationCaseInput: arr_multiple method matches impliedValuationFromMultiple", () => {
  const input = buildValuationCaseInput("legacy:deal-1", {
    method: "arr_multiple",
    metricValue: 5,
    multiple: 8,
  });
  assert.equal(input.impliedValueM, 40);
  assert.equal(input.assumptions.metricValue, 5);
  assert.equal(input.assumptions.multiple, 8);
});

test("buildValuationCaseInput: a pass-through method (comps) records the human-entered impliedValueM as-is, computes nothing", () => {
  const input = buildValuationCaseInput("legacy:deal-1", {
    method: "comps",
    impliedValueM: 250,
    notes: "Median of 4 comparable SaaS transactions",
  });
  assert.equal(input.method, "comps");
  assert.equal(input.impliedValueM, 250);
  assert.deepEqual(input.assumptions, {});
  assert.equal(input.notes, "Median of 4 comparable SaaS transactions");
});
