/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 7 tests: syncDomainDeal keeps the domain Company/Deal in lockstep
 * with a legacy pipeline deal — creates on first call, updates in place
 * (not duplicating) on repeat calls, and defaults/respects strategy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { syncDomainDeal } from "../domain/sync";
import { companies, deals, opportunities } from "../domain/repositories";
import type { Deal as LegacyDeal } from "../pipeline/store";

function makeLegacyDeal(overrides: Partial<LegacyDeal> = {}): LegacyDeal {
  const now = Date.now();
  return {
    id: `test-sync-${now}-${Math.random().toString(36).slice(2, 8)}`,
    companyName: `Sync Test Co ${now}`,
    stage: "1. Deal Sourcing",
    status: "Active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function cleanup(legacyDealId: string, companyName: string) {
  const dealId = `legacy:${legacyDealId}`;
  const deal = deals.get(dealId);
  if (deal?.opportunityId) opportunities.remove(deal.opportunityId);
  deals.remove(dealId);
  const company = companies.list().find((c) => c.legalName === companyName);
  if (company) companies.remove(company.id);
}

test("syncDomainDeal: creates a domain Company + Deal on first call", () => {
  const legacy = makeLegacyDeal();
  try {
    const { companyId, dealId } = syncDomainDeal(legacy);
    assert.equal(dealId, `legacy:${legacy.id}`);

    const domainDeal = deals.get(dealId);
    assert.ok(domainDeal);
    assert.equal(domainDeal!.companyId, companyId);
    assert.equal(domainDeal!.stage, legacy.stage);
    assert.equal(domainDeal!.status, legacy.status);
    assert.equal(domainDeal!.version, 1);

    const company = companies.get(companyId);
    assert.equal(company!.legalName, legacy.companyName);
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: a second call updates the same domain Deal in place, not a duplicate", () => {
  const legacy = makeLegacyDeal();
  try {
    syncDomainDeal(legacy);
    const changed = { ...legacy, stage: "2. Initial Screening", updatedAt: Date.now() };
    const { dealId } = syncDomainDeal(changed);

    const all = deals.list().filter((d) => d.id === dealId);
    assert.equal(all.length, 1);
    assert.equal(all[0].stage, "2. Initial Screening");
    assert.equal(all[0].version, 2);
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: defaults strategy to growth_equity when the legacy deal has none", () => {
  const legacy = makeLegacyDeal();
  try {
    const { dealId } = syncDomainDeal(legacy);
    assert.equal(deals.get(dealId)!.strategy, "growth_equity");
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: respects an explicit strategy on the legacy deal", () => {
  const legacy = makeLegacyDeal({ strategy: "pe_buyout" });
  try {
    const { dealId } = syncDomainDeal(legacy);
    assert.equal(deals.get(dealId)!.strategy, "pe_buyout");
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: backfills an Opportunity at 'passed_to_deal' on first sync and links Deal.opportunityId", () => {
  const legacy = makeLegacyDeal();
  try {
    const { dealId } = syncDomainDeal(legacy);
    const domainDeal = deals.get(dealId)!;
    assert.ok(domainDeal.opportunityId);

    const opportunity = opportunities.get(domainDeal.opportunityId!);
    assert.ok(opportunity);
    assert.equal(opportunity!.stage, "passed_to_deal");
    assert.equal(opportunity!.companyId, domainDeal.companyId);
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: a second sync does not create a duplicate Opportunity", () => {
  const legacy = makeLegacyDeal();
  try {
    const first = syncDomainDeal(legacy);
    const firstOpportunityId = deals.get(first.dealId)!.opportunityId;

    const changed = { ...legacy, stage: "2. Initial Screening", updatedAt: Date.now() };
    const second = syncDomainDeal(changed);
    const secondOpportunityId = deals.get(second.dealId)!.opportunityId;

    assert.equal(secondOpportunityId, firstOpportunityId);
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: preserves dealTeamId/vehicleId/fundId set by another endpoint across a subsequent sync", () => {
  const legacy = makeLegacyDeal();
  try {
    const { dealId } = syncDomainDeal(legacy);
    // Simulate what /api/deal-teams and /api/deals/vehicle do: a direct update outside syncDomainDeal.
    deals.update(dealId, { dealTeamId: "dea_test123", vehicleId: "veh_test456", fundId: "fun_test789" });

    syncDomainDeal(legacy); // a second, unrelated sync — must not wipe the fields just set
    const domainDeal = deals.get(dealId)!;

    assert.equal(domainDeal.dealTeamId, "dea_test123");
    assert.equal(domainDeal.vehicleId, "veh_test456");
    assert.equal(domainDeal.fundId, "fun_test789");
  } finally {
    cleanup(legacy.id, legacy.companyName);
  }
});

test("syncDomainDeal: reuses an existing Company by name rather than duplicating it", () => {
  const legacyA = makeLegacyDeal();
  const legacyB = makeLegacyDeal({ id: `${legacyA.id}-b`, companyName: legacyA.companyName });
  try {
    const first = syncDomainDeal(legacyA);
    const second = syncDomainDeal(legacyB);
    assert.equal(first.companyId, second.companyId);
  } finally {
    cleanup(legacyA.id, legacyA.companyName);
    cleanup(legacyB.id, legacyB.companyName);
  }
});
