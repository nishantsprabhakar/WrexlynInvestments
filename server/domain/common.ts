/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 4: shared metadata every material domain entity carries, plus the
 * cross-cutting vocabulary (claim classification, investment strategy,
 * deal stage/status) referenced by more than one entity file. New `zod`
 * dependency — no schema-validation library existed anywhere in either
 * repo before this; one schema definition here yields both the runtime
 * validator and the inferred TypeScript type.
 */
import { z } from "zod";
import { STAGES as LEGACY_DEAL_STAGES, STATUSES as LEGACY_DEAL_STATUSES } from "../pipeline/store";

/**
 * Core Principle 5 ("Evidence before claims") — every material fact must be
 * classified as one of these six. Never default silently to "sourced_fact".
 */
export const ClaimClassification = z.enum([
  "sourced_fact",
  "management_claim",
  "derived_calculation",
  "analyst_assumption",
  "ai_interpretation",
  "unverified_assertion",
]);
export type ClaimClassification = z.infer<typeof ClaimClassification>;

export const Provenance = z.object({
  classification: ClaimClassification,
  sourceId: z.string().optional(),
  /** Page, slide, sheet, cell, or section — free text, format depends on the source kind. */
  locator: z.string().optional(),
  supportingExcerpt: z.string().optional(),
  extractionMethod: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verifiedBy: z.string().optional(),
  verifiedAt: z.number().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

export const StatusHistoryEntry = z.object({
  status: z.string(),
  changedAt: z.number(),
  changedBy: z.string().optional(),
  note: z.string().optional(),
});
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntry>;

/** The discriminant that lets PE, growth-equity, and VC deals share one entity set instead of forking it. */
export const InvestmentStrategy = z.enum(["pe_buyout", "growth_equity", "vc"]);
export type InvestmentStrategy = z.infer<typeof InvestmentStrategy>;

/** Reused verbatim from pipeline/store.ts — not redefined — so migrated and new deals share one vocabulary. */
export const DEAL_STAGES = LEGACY_DEAL_STAGES;
export const DEAL_STATUSES = LEGACY_DEAL_STATUSES;
export const DealStage = z.string().refine((s) => (DEAL_STAGES as readonly string[]).includes(s), {
  message: `stage must be one of: ${LEGACY_DEAL_STAGES.join(", ")}`,
});
export const DealStatus = z.enum(DEAL_STATUSES);
export type DealStatus = z.infer<typeof DealStatus>;

/**
 * Fields every material entity carries per Phase 4's mandate: stable ID,
 * created/updated timestamps, version, owner, provenance where applicable,
 * an audit-event linkage, and status history where applicable. `createEntityStore`
 * (./store.ts) is the only place that's expected to populate id/timestamps/version —
 * callers pass everything else.
 */
export function withMeta<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object({
    id: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    version: z.number().int().min(1),
    owner: z.string().optional(),
    provenance: Provenance.optional(),
    auditRef: z.string().optional(),
    statusHistory: z.array(StatusHistoryEntry).optional(),
    ...shape,
  });
}

/** What a caller supplies to create an entity — everything withMeta adds automatically is omitted. */
export type NewEntityInput<T> = Omit<T, "id" | "createdAt" | "updatedAt" | "version" | "statusHistory">;
