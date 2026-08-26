/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 4 domain entities: the origination/pipeline spine — Company through
 * to a tracked Deal, plus the evidence primitives (Source, ResearchFinding)
 * and the formalized ScreeningAssessment shape the existing screening flow
 * already produces informally.
 */
import { z } from "zod";
import { withMeta, InvestmentStrategy, DealStage, DealStatus, Provenance, ClaimClassification } from "../common";

export const CompanySchema = withMeta({
  legalName: z.string().min(1),
  brandName: z.string().optional(),
  sector: z.string().optional(),
  subSector: z.string().optional(),
  hq: z.string().optional(),
  foundedYear: z.number().int().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  employeeCount: z.number().int().optional(),
  status: z.enum(["prospect", "portfolio", "exited", "passed"]).default("prospect"),
});
export type Company = z.infer<typeof CompanySchema>;

export const OpportunitySchema = withMeta({
  companyId: z.string(),
  mandateId: z.string().optional(),
  sourceId: z.string().optional(),
  stage: z.enum(["identified", "initial_contact", "nda_signed", "passed_to_deal", "rejected"]),
  strategy: InvestmentStrategy,
  notes: z.string().optional(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

/** The rich successor to pipeline/store.ts's flat Deal — reuses its exact stage/status vocabulary. */
export const DealSchema = withMeta({
  companyId: z.string(),
  opportunityId: z.string().optional(),
  fundId: z.string().optional(),
  vehicleId: z.string().optional(),
  dealTeamId: z.string().optional(),
  strategy: InvestmentStrategy,
  stage: DealStage,
  status: DealStatus,
  dealSizeM: z.number().optional(),
  currency: z.string().default("USD"),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});
export type Deal = z.infer<typeof DealSchema>;

export const SourceSchema = withMeta({
  dealId: z.string().optional(),
  companyId: z.string().optional(),
  kind: z.enum(["pdf", "docx", "pptx", "xlsx", "url", "interview", "other"]),
  title: z.string().min(1),
  publisher: z.string().optional(),
  publishedAt: z.number().optional(),
  retrievedAt: z.number().optional(),
  storedPath: z.string().optional(),
  url: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ResearchFindingSchema = withMeta({
  dealId: z.string(),
  companyId: z.string().optional(),
  summary: z.string().min(1),
  provenance: Provenance,
  sourceId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;

/** Formalizes the JSON shape the existing screening flow (server/flows/screening.ts) already produces. */
export const ScreeningAssessmentSchema = withMeta({
  dealId: z.string(),
  overallRating: z.number().min(0).max(100),
  grade: z.string(),
  dimensions: z
    .array(
      z.object({
        name: z.string(),
        score: z.number().min(0).max(10),
        rationale: z.string(),
        provenance: Provenance.optional(),
      })
    )
    .default([]),
  /** Matches server/flows/schemas.ts's ClassifiedClaimSchema — Phase 6 added classification to the live output; this entity stays in sync rather than dropping it. */
  keyFacts: z.array(z.object({ text: z.string(), classification: ClaimClassification })).default([]),
  redFlags: z.array(z.object({ text: z.string(), classification: ClaimClassification })).default([]),
  recommendation: z.string(),
  ranAt: z.number(),
});
export type ScreeningAssessment = z.infer<typeof ScreeningAssessmentSchema>;
