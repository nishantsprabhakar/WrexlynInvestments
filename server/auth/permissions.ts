/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * The role -> capability matrix. Six roles map onto a handful of
 * capability buckets rather than one flag per API route (there are 44+
 * routes) — every mutating endpoint declares which bucket it needs, every
 * GET is readable by any authenticated role (this alone satisfies
 * Compliance's "read-only everywhere, including the audit trail").
 */
import type { Role } from "./users";

export type Capability =
  | "manage_users"
  | "run_ai_flows"
  | "edit_deal"
  | "decide"
  | "manage_fund_admin"
  | "manage_portfolio";

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  partner: ["manage_users", "run_ai_flows", "edit_deal", "decide", "manage_fund_admin", "manage_portfolio"],
  principal: ["run_ai_flows", "edit_deal", "decide", "manage_fund_admin", "manage_portfolio"],
  associate: ["run_ai_flows", "edit_deal", "manage_portfolio"],
  analyst: ["run_ai_flows", "edit_deal"],
  compliance: [],
  ops: ["manage_fund_admin", "manage_portfolio"],
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Maps every mutating route in server/index.ts to the capability it needs. GET requests need no
 * entry here — any authenticated role can read anything (see this file's header comment). Returns
 * null for a route this function doesn't recognize as needing write-gating (there should be none
 * in practice — server/index.ts's own auth gate treats an unmapped mutation as needing `partner`,
 * fail-closed, rather than silently allowing it).
 */
export function requiredCapability(method: string, pathname: string): Capability | null {
  if (method === "GET") return null;

  if (pathname === "/api/screening" || pathname === "/api/evaluation" || pathname === "/api/documentation") return "run_ai_flows";

  if (pathname === "/api/pipeline/deals") return "edit_deal";
  if (pathname === "/api/milestones") return "edit_deal";
  if (pathname === "/api/valuation-cases") return "edit_deal";
  if (pathname === "/api/debt-facilities") return "edit_deal";
  if (pathname === "/api/cap-tables" || pathname === "/api/cap-tables/dilution") return "edit_deal";
  if (pathname === "/api/diligence/workstreams" || pathname === "/api/diligence/requests") return "edit_deal";

  if (pathname === "/api/ic-decisions" || pathname === "/api/approval-conditions") return "decide";
  if (pathname === "/api/portfolio/follow-on-decisions" || pathname === "/api/portfolio/realised-proceeds") return "decide";

  if (pathname === "/api/contacts" || pathname === "/api/deal-teams") return "manage_fund_admin";
  if (pathname === "/api/investment-vehicles" || pathname === "/api/deals/vehicle" || pathname === "/api/investment-mandates") return "manage_fund_admin";

  if (pathname === "/api/portfolio/investments") return "manage_portfolio";
  if (pathname === "/api/portfolio/value-creation-initiatives") return "manage_portfolio";
  if (pathname === "/api/portfolio/kpis") return "manage_portfolio";
  if (pathname === "/api/portfolio/exit-scenarios") return "manage_portfolio";

  return null;
}
