/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 7: keeps the domain model (Company/Deal) in lockstep with the
 * legacy pipeline/store.ts Deal every time a flow touches it, instead of
 * relying solely on the one-time migrateLegacy.ts backfill. Reuses the
 * exact `legacy:<id>` correlation convention migrateLegacy.ts established,
 * and its findOrCreateCompany — moved here so both call sites share one
 * implementation.
 */
import { companies, deals } from "./repositories";
import type { Deal as LegacyDeal } from "../pipeline/store";
import type { InvestmentStrategy } from "./common";

/** Legacy deals never recorded an explicit PE/growth/VC strategy until Phase 7's UI addition — default to the most neutral bucket, matching migrateLegacy.ts's existing default. */
export const DEFAULT_STRATEGY: InvestmentStrategy = "growth_equity";

export function findOrCreateCompany(name: string, sector?: string): string {
  const existing = companies.list().find((c) => c.legalName.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const created = companies.create({ legalName: name, sector, status: "prospect" });
  return created.id;
}

export interface SyncedDomainDeal {
  companyId: string;
  dealId: string;
}

/** Upserts the domain Company + Deal for a legacy pipeline deal. Idempotent: re-running for the same legacy deal updates the existing domain Deal in place. */
export function syncDomainDeal(legacyDeal: LegacyDeal): SyncedDomainDeal {
  const companyId = findOrCreateCompany(legacyDeal.companyName, legacyDeal.sector);
  const domainDealId = `legacy:${legacyDeal.id}`;
  const existing = deals.get(domainDealId);
  const strategy: InvestmentStrategy = (legacyDeal.strategy as InvestmentStrategy) || existing?.strategy || DEFAULT_STRATEGY;

  deals.upsertRaw({
    id: domainDealId,
    companyId,
    strategy,
    stage: legacyDeal.stage,
    status: legacyDeal.status,
    currency: "USD",
    rejectionReason: legacyDeal.rejectionReason,
    notes: existing?.notes,
    createdAt: existing?.createdAt ?? legacyDeal.createdAt,
    updatedAt: Date.now(),
    version: (existing?.version ?? 0) + 1,
  } as any);

  return { companyId, dealId: domainDealId };
}
