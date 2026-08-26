/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 4 domain entity: generated/attached documents. Generalizes what
 * server/flows/evaluation.ts and documentation.ts already track ad hoc as
 * loose fields on the legacy pipeline/store.ts Deal record.
 */
import { z } from "zod";
import { withMeta } from "../common";

export const InvestmentArtifactSchema = withMeta({
  dealId: z.string(),
  kind: z.enum(["ic_memo", "financial_model", "redline", "board_pack", "screening_report", "other"]),
  relPath: z.string().min(1),
  generatedBy: z.enum(["ai", "human", "hybrid"]),
  sourceFlow: z.string().optional(),
});
export type InvestmentArtifact = z.infer<typeof InvestmentArtifactSchema>;
