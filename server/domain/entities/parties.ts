/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4 domain entities: the parties around a deal — organizations,
 * people, funds/vehicles, and the mandate + team that work a deal.
 */
import { z } from "zod";
import { withMeta, InvestmentStrategy } from "../common";

export const OrganizationSchema = withMeta({
  name: z.string().min(1),
  type: z.enum(["gp", "lp", "co_investor", "advisor", "target_parent", "other"]),
  website: z.string().optional(),
  hq: z.string().optional(),
  notes: z.string().optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const ContactSchema = withMeta({
  name: z.string().min(1),
  role: z.string().optional(),
  companyId: z.string().optional(),
  organizationId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const FundSchema = withMeta({
  name: z.string().min(1),
  organizationId: z.string(),
  strategy: InvestmentStrategy,
  vintageYear: z.number().int().optional(),
  targetSizeM: z.number().optional(),
  committedCapitalM: z.number().optional(),
  currency: z.string().default("USD"),
  status: z.enum(["fundraising", "investing", "harvesting", "closed"]),
});
export type Fund = z.infer<typeof FundSchema>;

export const InvestmentVehicleSchema = withMeta({
  fundId: z.string(),
  name: z.string().min(1),
  vehicleType: z.enum(["main_fund", "co_invest_spv", "continuation_vehicle", "other"]),
  currency: z.string().default("USD"),
});
export type InvestmentVehicle = z.infer<typeof InvestmentVehicleSchema>;

export const InvestmentMandateSchema = withMeta({
  fundId: z.string(),
  strategy: InvestmentStrategy,
  sectors: z.array(z.string()).default([]),
  geographies: z.array(z.string()).default([]),
  checkSizeMinM: z.number().optional(),
  checkSizeMaxM: z.number().optional(),
  ownershipTargetPct: z.number().min(0).max(100).optional(),
  holdPeriodYearsMin: z.number().optional(),
  holdPeriodYearsMax: z.number().optional(),
});
export type InvestmentMandate = z.infer<typeof InvestmentMandateSchema>;

export const DealTeamSchema = withMeta({
  dealId: z.string(),
  members: z
    .array(
      z.object({
        contactId: z.string().optional(),
        name: z.string().optional(),
        role: z.enum(["lead", "associate", "operating_partner", "legal", "other"]),
      })
    )
    .default([]),
});
export type DealTeam = z.infer<typeof DealTeamSchema>;
