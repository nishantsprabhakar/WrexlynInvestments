/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 7 tests: syncDomainDeal keeps the domain Company/Deal in lockstep
 * with a legacy pipeline deal — creates on first call, updates in place
 * (not duplicating) on repeat calls, and defaults/respects strategy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { syncDomainDeal } from "../domain/sync";
import { companies, deals } from "../domain/repositories";
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
  deals.remove(`legacy:${legacyDealId}`);
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
