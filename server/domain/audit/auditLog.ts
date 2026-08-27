/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 6: an append-only audit trail — distinct in kind from the mutable
 * EntityStore (../store.ts). Deliberately exports no update/remove: an
 * audit record, once written, cannot be edited or deleted through this
 * module. Storage is JSON Lines (one `fs.appendFileSync` per record) so
 * writing never requires reading or rewriting the whole file.
 */
import * as fs from "fs";
import * as path from "path";
import { findProjectRoot } from "../../lib/projectRoot";

export type AuditFlow = "screening" | "evaluation" | "documentation";

export interface AuditEntry {
  id: string;
  dealId: string;
  companyName: string;
  flow: AuditFlow;
  createdAt: number;
  inputSummary: string;
  outputSummary: Record<string, unknown>;
  validationOk: boolean;
}

function auditLogPath(): string {
  return path.join(findProjectRoot(__dirname), "data", "audit.jsonl");
}

function genId(): string {
  return "aud_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function recordAuditEntry(entry: Omit<AuditEntry, "id" | "createdAt">): AuditEntry {
  const full: AuditEntry = { ...entry, id: genId(), createdAt: Date.now() };
  const p = auditLogPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(full) + "\n", "utf-8");
  return full;
}

export function listAuditEntries(filter?: { dealId?: string }): AuditEntry[] {
  const p = auditLogPath();
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf-8").split("\n").filter((l) => l.trim());
  const entries: AuditEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // A corrupted line is skipped rather than failing the whole read.
    }
  }
  return filter?.dealId ? entries.filter((e) => e.dealId === filter.dealId) : entries;
}
