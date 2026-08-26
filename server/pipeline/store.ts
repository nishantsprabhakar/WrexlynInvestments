/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Deal pipeline store — real server-side JSON-file persistence (an upgrade
 * over Praevix's localStorage), taxonomy taken verbatim from the reference
 * SKEGEN Fund Intelligence dashboard: 9 funnel stages, 4 statuses.
 */
import * as fs from "fs";
import * as path from "path";
import { findProjectRoot } from "../lib/projectRoot";

export const STAGES: string[] = [
  "1. Deal Sourcing",
  "2. Initial Screening",
  "3. Preliminary DD",
  "4. IC Approval – Prelim",
  "5. Full Due Diligence",
  "6. IC Approval – Final",
  "7. Term Sheet / Negotiation",
  "8. Definitive Agreements",
  "9. Close / Investment",
];

export const STATUSES = ["Active", "Invested", "Rejected", "On Hold"] as const;
export type DealStatus = (typeof STATUSES)[number];

export interface ScreeningRecord {
  overallRating: number;
  grade: string;
  recommendation: string;
  ranAt: number;
}

export interface EvaluationRecord {
  icNoteDocPath?: string;
  modelXlsxPath?: string;
  recommendation?: string;
  ranAt: number;
}

export interface DocumentationRecord {
  id: string;
  fileName: string;
  overallRiskGrade?: string;
  ranAt: number;
  redlinedDocPath?: string;
}

/** Plain string-literal type, not imported from ../domain/common — that module imports STAGES/STATUSES from here, so the reverse import would cycle. */
export type LegacyInvestmentStrategy = "pe_buyout" | "growth_equity" | "vc";

export interface Deal {
  id: string;
  companyName: string;
  sector?: string;
  stage: string;
  status: DealStatus;
  strategy?: LegacyInvestmentStrategy;
  dealSize?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  screening?: ScreeningRecord;
  evaluation?: EvaluationRecord;
  documentation?: DocumentationRecord[];
  financials?: { revenueCr?: number; ebitdaCr?: number; ebitdaMarginPct?: number };
  rejectionReason?: string;
}

function dataPath(): string {
  return path.join(findProjectRoot(__dirname), "data", "deals.json");
}

function readAll(): Deal[] {
  try {
    const filePath = dataPath();
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(deals: Deal[]): void {
  const filePath = dataPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(deals, null, 2), "utf-8");
}

function genId(): string {
  return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function listDeals(): Deal[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDeal(id: string): Deal | null {
  return readAll().find((d) => d.id === id) ?? null;
}

export function findDealByCompanyName(companyName: string): Deal | null {
  const norm = companyName.trim().toLowerCase();
  return readAll().find((d) => d.companyName.trim().toLowerCase() === norm) ?? null;
}

export function createDeal(input: Partial<Deal> & { companyName: string }): Deal {
  const deals = readAll();
  const now = Date.now();
  const deal: Deal = {
    id: genId(),
    companyName: input.companyName,
    sector: input.sector,
    stage: input.stage || STAGES[0],
    status: input.status || "Active",
    strategy: input.strategy,
    dealSize: input.dealSize,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  deals.push(deal);
  writeAll(deals);
  return deal;
}

export function updateDeal(id: string, patch: Partial<Deal>): Deal | null {
  const deals = readAll();
  const idx = deals.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  deals[idx] = { ...deals[idx], ...patch, id: deals[idx].id, updatedAt: Date.now() };
  writeAll(deals);
  return deals[idx];
}

export function deleteDeal(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id));
}

/** Finds or creates a deal by company name, then applies a patch — the "flows feed the pipeline" hook. */
export function upsertDealByCompanyName(companyName: string, patch: Partial<Deal>): Deal {
  const existing = findDealByCompanyName(companyName);
  if (existing) {
    return updateDeal(existing.id, patch) as Deal;
  }
  const created = createDeal({ companyName, ...patch });
  return created;
}
