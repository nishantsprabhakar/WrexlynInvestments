/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 8: post-investment portfolio orchestration. `PortfolioInvestment`
 * requires a `fundId`, and `Fund` requires an `organizationId` — neither
 * concept exists anywhere in the live product yet, so
 * findOrCreateFundForStrategy auto-provisions a single house organization
 * and one fund per strategy the first time it's needed, mirroring
 * ./sync.ts's findOrCreateCompany pattern rather than building a real
 * fund-management UI (real scope creep for this phase).
 *
 * buildExitScenarioInput/buildRealisedProceedsInput are pure — no I/O — so
 * they're testable without touching the entity stores, same pattern as
 * Phase 5/7's *.calc.ts / *.persist.ts files. Both reuse Phase 5's existing
 * calculation engine verbatim instead of trusting a human-entered IRR/MOIC
 * (Core Principle 6, applied to outcomes instead of just decisions).
 */
import { organizations, funds, portfolioInvestments } from "./repositories";
import { lboReturns, xirr, moic } from "./finance/calculations";
import type { InvestmentStrategy } from "./common";

const HOUSE_ORG_NAME = "Wrexlyn House Capital";

export function findOrCreateFundForStrategy(strategy: InvestmentStrategy): string {
  let org = organizations.list().find((o) => o.name === HOUSE_ORG_NAME);
  if (!org) org = organizations.create({ name: HOUSE_ORG_NAME, type: "gp" });

  const existingFund = funds.list().find((f) => f.organizationId === org!.id && f.strategy === strategy);
  if (existingFund) return existingFund.id;

  const created = funds.create({
    name: `House Fund — ${strategy}`,
    organizationId: org.id,
    strategy,
    vintageYear: new Date().getFullYear(),
    status: "investing",
  });
  return created.id;
}

export interface UpsertPortfolioInvestmentInput {
  dealId: string;
  companyId: string;
  fundId: string;
  investedM: number;
  ownershipPct: number;
  investedAt: number;
}

/** Creates a PortfolioInvestment for a domain deal, or updates the existing one in place — never a duplicate per dealId. */
export function upsertPortfolioInvestment(input: UpsertPortfolioInvestmentInput) {
  const existing = portfolioInvestments.list().find((p) => p.dealId === input.dealId);
  if (existing) {
    return portfolioInvestments.update(existing.id, {
      investedM: input.investedM,
      ownershipPct: input.ownershipPct,
    })!;
  }
  return portfolioInvestments.create({
    dealId: input.dealId,
    companyId: input.companyId,
    fundId: input.fundId,
    investedM: input.investedM,
    investedAt: input.investedAt,
    ownershipPct: input.ownershipPct,
    status: "active",
  });
}

export interface ExitScenarioBody {
  portfolioInvestmentId: string;
  scenario: "bear" | "base" | "bull";
  exitRoute: "strategic_sale" | "sponsor_to_sponsor" | "ipo" | "secondary" | "write_off" | "other";
  exitYear?: number;
  expectedProceedsM?: number;
}

/** expectedIrr/expectedMoic are always computed from lboReturns — a human can supply the exit assumption, never the return itself. */
export function buildExitScenarioInput(investedM: number, body: ExitScenarioBody) {
  const { irrPct, moic: moicValue } = lboReturns({
    entryValue: investedM,
    exitValue: body.expectedProceedsM ?? 0,
    exitYear: body.exitYear ?? 1,
  });
  return {
    portfolioInvestmentId: body.portfolioInvestmentId,
    scenario: body.scenario,
    exitRoute: body.exitRoute,
    exitYear: body.exitYear,
    expectedProceedsM: body.expectedProceedsM,
    expectedMoic: moicValue ?? undefined,
    expectedIrr: irrPct ?? undefined,
  };
}

export interface RealisedProceedsBody {
  exitDate: string;
  exitRoute: "strategic_sale" | "sponsor_to_sponsor" | "ipo" | "secondary" | "write_off" | "other";
  grossProceedsM: number;
  netProceedsM?: number;
  currency?: string;
}

/**
 * realizedMoic/realizedIrr are always computed here — from the investment's
 * real investedAt and the given exitDate via xirr, the first live caller of
 * xirr with genuine calendar dates rather than a year-count. A
 * null/non-computable result clamps to 0 (mirrors lboReturns' own
 * total-loss clamp) rather than being fabricated.
 */
export function buildRealisedProceedsInput(investment: { id: string; investedM: number; investedAt: number }, body: RealisedProceedsBody) {
  const proceedsForReturn = body.netProceedsM ?? body.grossProceedsM;
  const irr = xirr([
    { amount: -investment.investedM, date: new Date(investment.investedAt) },
    { amount: proceedsForReturn, date: new Date(body.exitDate) },
  ]);
  const m = moic(investment.investedM, proceedsForReturn);
  return {
    portfolioInvestmentId: investment.id,
    exitDate: body.exitDate,
    exitRoute: body.exitRoute,
    grossProceedsM: body.grossProceedsM,
    netProceedsM: body.netProceedsM,
    realizedMoic: m ?? 0,
    realizedIrr: irr != null ? irr * 100 : 0,
    currency: body.currency || "USD",
  };
}
