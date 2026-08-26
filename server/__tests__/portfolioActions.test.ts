/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 8 tests: fund auto-provisioning, idempotent PortfolioInvestment
 * upsert, and the two pure return-calculation builders (exit scenarios via
 * lboReturns, realised proceeds via real-dated xirr/moic).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { findOrCreateFundForStrategy, upsertPortfolioInvestment, buildExitScenarioInput, buildRealisedProceedsInput } from "../domain/portfolioActions";
import { organizations, funds, portfolioInvestments } from "../domain/repositories";

test("findOrCreateFundForStrategy: creates once per strategy and reuses on repeat", () => {
  const first = findOrCreateFundForStrategy("pe_buyout");
  const second = findOrCreateFundForStrategy("pe_buyout");
  assert.equal(first, second);

  const fund = funds.get(first)!;
  assert.equal(fund.strategy, "pe_buyout");
  assert.equal(fund.status, "investing");

  const orgs = organizations.list().filter((o) => o.name === "Wrexlyn House Capital");
  assert.equal(orgs.length, 1); // reused, not duplicated
});

test("findOrCreateFundForStrategy: a different strategy gets a distinct fund under the same organization", () => {
  const peId = findOrCreateFundForStrategy("pe_buyout");
  const vcId = findOrCreateFundForStrategy("vc");
  assert.notEqual(peId, vcId);
  assert.equal(funds.get(peId)!.organizationId, funds.get(vcId)!.organizationId);
});

test("upsertPortfolioInvestment: creates on first call, updates in place (not duplicated) on a second", () => {
  const dealId = `test-portfolio-${Date.now()}`;
  const fundId = findOrCreateFundForStrategy("growth_equity");
  try {
    const first = upsertPortfolioInvestment({
      dealId,
      companyId: "com_test",
      fundId,
      investedM: 10,
      ownershipPct: 15,
      investedAt: Date.now(),
    });
    assert.equal(first.investedM, 10);
    assert.equal(first.status, "active");

    const second = upsertPortfolioInvestment({
      dealId,
      companyId: "com_test",
      fundId,
      investedM: 12,
      ownershipPct: 18,
      investedAt: Date.now(),
    });
    assert.equal(second.id, first.id);
    assert.equal(second.investedM, 12);
    assert.equal(second.ownershipPct, 18);

    const all = portfolioInvestments.list().filter((p) => p.dealId === dealId);
    assert.equal(all.length, 1);
  } finally {
    const leftover = portfolioInvestments.list().find((p) => p.dealId === dealId);
    if (leftover) portfolioInvestments.remove(leftover.id);
  }
});

test("buildExitScenarioInput: matches a hand-checked lboReturns example", () => {
  const input = buildExitScenarioInput(100, {
    portfolioInvestmentId: "pfi_1",
    scenario: "base",
    exitRoute: "strategic_sale",
    exitYear: 5,
    expectedProceedsM: 200,
  });
  assert.equal(input.expectedMoic, 2);
  const expectedIrr = (Math.pow(2, 1 / 5) - 1) * 100;
  assert.ok(Math.abs((input.expectedIrr as number) - expectedIrr) < 0.01);
});

test("buildExitScenarioInput: a total-loss exit clamps rather than producing NaN", () => {
  const input = buildExitScenarioInput(100, {
    portfolioInvestmentId: "pfi_1",
    scenario: "bear",
    exitRoute: "write_off",
    exitYear: 3,
    expectedProceedsM: 0,
  });
  assert.equal(input.expectedMoic, 0);
  assert.equal(input.expectedIrr, -100);
});

test("buildRealisedProceedsInput: matches a hand-checked real-dated xirr/moic example", () => {
  const investment = { id: "pfi_1", investedM: 50, investedAt: new Date("2021-01-01").getTime() };
  const result = buildRealisedProceedsInput(investment, {
    exitDate: "2026-01-01",
    exitRoute: "ipo",
    grossProceedsM: 250,
  });
  assert.equal(result.realizedMoic, 5);
  const expectedIrr = (Math.pow(5, 1 / 5) - 1) * 100; // 5-year hold
  assert.ok(Math.abs(result.realizedIrr - expectedIrr) < 0.5);
});

test("buildRealisedProceedsInput: zero proceeds clamps to 0, not NaN/undefined", () => {
  const investment = { id: "pfi_1", investedM: 50, investedAt: new Date("2021-01-01").getTime() };
  const result = buildRealisedProceedsInput(investment, {
    exitDate: "2023-01-01",
    exitRoute: "write_off",
    grossProceedsM: 0,
  });
  assert.equal(result.realizedMoic, 0);
  assert.equal(result.realizedIrr, 0);
});
