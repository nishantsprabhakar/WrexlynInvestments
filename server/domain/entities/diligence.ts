/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4 domain entities: the diligence command-centre primitives —
 * workstreams, individual data-room/DDQ requests, and tracked risks.
 */
import { z } from "zod";
import { withMeta, Provenance } from "../common";

export const DiligenceWorkstreamSchema = withMeta({
  dealId: z.string(),
  name: z.string().min(1), // e.g. "Commercial", "Financial", "Legal", "Tech"
  owner: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "complete", "blocked"]).default("not_started"),
});
export type DiligenceWorkstream = z.infer<typeof DiligenceWorkstreamSchema>;

export const DiligenceRequestSchema = withMeta({
  workstreamId: z.string(),
  question: z.string().min(1),
  status: z.enum(["open", "answered", "overdue"]).default("open"),
  askedAt: z.number(),
  answeredAt: z.number().optional(),
  response: z.string().optional(),
});
export type DiligenceRequest = z.infer<typeof DiligenceRequestSchema>;

export const RiskAndMitigantSchema = withMeta({
  dealId: z.string(),
  risk: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  mitigant: z.string().optional(),
  provenance: Provenance.optional(),
  status: z.enum(["open", "mitigated", "accepted"]).default("open"),
});
export type RiskAndMitigant = z.infer<typeof RiskAndMitigantSchema>;
