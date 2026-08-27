/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 4: migrates records from the legacy pipeline/store.ts flat Deal
 * shape into the new domain entities. Run explicitly via `npm run
 * migrate:legacy` — deliberately not automatic on server boot, since a
 * data migration is a consequential action a human should trigger and
 * observe, not something that happens silently in the background.
 *
 * Additive and idempotent: the legacy data/deals.json is never modified or
 * deleted, and each migrated Deal gets a deterministic id (`legacy:<oldId>`)
 * so re-running skips anything already migrated instead of duplicating it.
 * Values the legacy system never actually persisted (full screening
 * dimension breakdowns, full documentation reviews) are not fabricated —
 * only what was really there is carried over.
 */
import { listDeals, type Deal as LegacyDeal } from "../pipeline/store";
import { deals, screeningAssessments, financialPeriods, financialMetrics, investmentArtifacts, sources } from "./repositories";
import { findOrCreateCompany, DEFAULT_STRATEGY as DEFAULT_MIGRATED_STRATEGY } from "./sync";
import { sourceKindFromFileName } from "./sourceActions";

export interface MigrationSummary {
  totalLegacyDeals: number;
  migrated: number;
  alreadyMigrated: number;
  companiesCreatedOrReused: number;
  screeningAssessmentsCreated: number;
  financialMetricsCreated: number;
  artifactsCreated: number;
  sourcesCreated: number;
}

export function migrateLegacyDeals(): MigrationSummary {
  const legacyDeals: LegacyDeal[] = listDeals();
  const summary: MigrationSummary = {
    totalLegacyDeals: legacyDeals.length,
    migrated: 0,
    alreadyMigrated: 0,
    companiesCreatedOrReused: 0,
    screeningAssessmentsCreated: 0,
    financialMetricsCreated: 0,
    artifactsCreated: 0,
    sourcesCreated: 0,
  };

  for (const old of legacyDeals) {
    const newDealId = `legacy:${old.id}`;
    if (deals.get(newDealId)) {
      summary.alreadyMigrated++;
      continue;
    }

    const companyId = findOrCreateCompany(old.companyName, old.sector);
    summary.companiesCreatedOrReused++;

    const noteParts: string[] = [];
    if (old.notes) noteParts.push(old.notes);
    if (old.dealSize) noteParts.push(`Deal size (legacy, unparsed): ${old.dealSize}`);
    noteParts.push(
      `Migrated from legacy pipeline record ${old.id} on ${new Date().toISOString().slice(0, 10)}. ` +
        `Strategy defaulted to "${DEFAULT_MIGRATED_STRATEGY}" — the legacy record never captured PE/growth/VC strategy explicitly.`
    );

    deals.upsertRaw({
      id: newDealId,
      companyId,
      strategy: DEFAULT_MIGRATED_STRATEGY,
      stage: old.stage,
      status: old.status,
      currency: "USD",
      rejectionReason: old.rejectionReason,
      notes: noteParts.join("\n\n"),
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
      version: 1,
    } as any);
    summary.migrated++;

    if (old.screening) {
      screeningAssessments.create({
        dealId: newDealId,
        overallRating: old.screening.overallRating,
        grade: old.screening.grade,
        dimensions: [],
        keyFacts: [],
        redFlags: [],
        recommendation: old.screening.recommendation,
        ranAt: old.screening.ranAt,
      });
      summary.screeningAssessmentsCreated++;
    }

    if (old.financials) {
      const period = financialPeriods.create({
        companyId,
        dealId: newDealId,
        label: "Latest available (legacy)",
        periodType: "actual",
        currency: "INR", // legacy figures are in Rs Cr (crores)
      });
      const metricEntries: Array<[string, number | undefined, string]> = [
        ["revenue", old.financials.revenueCr, "INR_Cr"],
        ["ebitda", old.financials.ebitdaCr, "INR_Cr"],
        ["ebitda_margin", old.financials.ebitdaMarginPct, "pct"],
      ];
      for (const [metric, value, unit] of metricEntries) {
        if (value == null) continue;
        financialMetrics.create({
          financialPeriodId: period.id,
          metric,
          value,
          unit,
          // Came from the AI evaluation flow, not a verified source document — classify honestly.
          provenance: { classification: "ai_interpretation" },
        });
        summary.financialMetricsCreated++;
      }
    }

    if (old.evaluation?.icNoteDocPath) {
      investmentArtifacts.create({
        dealId: newDealId,
        kind: "ic_memo",
        relPath: old.evaluation.icNoteDocPath,
        generatedBy: "ai",
        sourceFlow: "evaluation",
      });
      summary.artifactsCreated++;
    }
    if (old.evaluation?.modelXlsxPath) {
      investmentArtifacts.create({
        dealId: newDealId,
        kind: "financial_model",
        relPath: old.evaluation.modelXlsxPath,
        generatedBy: "ai",
        sourceFlow: "evaluation",
      });
      summary.artifactsCreated++;
    }

    for (const doc of old.documentation ?? []) {
      sources.create({
        dealId: newDealId,
        kind: sourceKindFromFileName(doc.fileName),
        title: doc.fileName,
        retrievedAt: doc.ranAt,
      });
      summary.sourcesCreated++;
      if (doc.redlinedDocPath) {
        investmentArtifacts.create({
          dealId: newDealId,
          kind: "redline",
          relPath: doc.redlinedDocPath,
          generatedBy: "ai",
          sourceFlow: "documentation",
        });
        summary.artifactsCreated++;
      }
    }
  }

  return summary;
}

if (require.main === module) {
  const summary = migrateLegacyDeals();
  console.log("Legacy deal migration complete:");
  console.log(JSON.stringify(summary, null, 2));
}
