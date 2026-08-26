/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 4: one generic, validated JSON-file repository factory reused for
 * all 33 domain entities (see repositories.ts) — matching pipeline/store.ts's
 * existing local-first, no-DB-dependency pattern, and "reuse before
 * building" applied inside the domain layer itself rather than 33
 * hand-rolled CRUD modules.
 *
 * Validates with the entity's own zod schema on every read AND write —
 * corruption or a bad write is caught immediately, not silently persisted.
 * Auto-manages id/createdAt/updatedAt/version, and appends a
 * StatusHistoryEntry whenever a `status` or `stage` field changes value.
 */
import * as fs from "fs";
import * as path from "path";
import type { z } from "zod";
import { findProjectRoot } from "../lib/projectRoot";

/** Exported so tests can locate/clean up a store's backing file without re-deriving this path themselves. */
export function domainDataDir(): string {
  return path.join(findProjectRoot(__dirname), "data", "domain");
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface EntityStore<T extends { id: string }> {
  list(): T[];
  get(id: string): T | null;
  create(input: Omit<T, "id" | "createdAt" | "updatedAt" | "version" | "statusHistory">): T;
  update(id: string, patch: Partial<T>, changedBy?: string): T | null;
  remove(id: string): void;
  /** Inserts a fully-formed record as-is (id/timestamps included) — used only by migrateLegacy.ts,
   *  which needs deterministic ids for idempotent re-runs. Still validated against the schema. */
  upsertRaw(record: T): T;
}

export function createEntityStore<
  T extends {
    id: string;
    createdAt: number;
    updatedAt: number;
    version: number;
    status?: unknown;
    stage?: unknown;
    statusHistory?: any[];
  }
>(
  entityName: string,
  fileName: string,
  schema: z.ZodType<T>
): EntityStore<T> {
  const idPrefix = entityName.slice(0, 3).toLowerCase();

  function filePath(): string {
    return path.join(domainDataDir(), fileName);
  }

  function readAll(): T[] {
    try {
      const p = filePath();
      if (!fs.existsSync(p)) return [];
      const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (!Array.isArray(raw)) return [];
      const valid: T[] = [];
      for (const item of raw) {
        const result = schema.safeParse(item);
        if (result.success) valid.push(result.data);
        else console.warn(`[domain:${entityName}] dropped a record failing validation on read: ${result.error.message}`);
      }
      return valid;
    } catch {
      return [];
    }
  }

  function writeAll(items: T[]): void {
    for (const item of items) schema.parse(item); // throws on any invalid record — never persist bad data
    const p = filePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(items, null, 2), "utf-8");
  }

  return {
    list() {
      return readAll();
    },
    get(id) {
      return readAll().find((r) => r.id === id) ?? null;
    },
    create(input) {
      const now = Date.now();
      const record = schema.parse({
        ...input,
        id: genId(idPrefix),
        createdAt: now,
        updatedAt: now,
        version: 1,
      } as unknown as T);
      const all = readAll();
      all.push(record);
      writeAll(all);
      return record;
    },
    update(id, patch, changedBy) {
      const all = readAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const current = all[idx];
      const statusHistory = Array.isArray(current.statusHistory) ? [...current.statusHistory] : [];
      for (const field of ["status", "stage"] as const) {
        if (field in patch && (patch as any)[field] !== undefined && (patch as any)[field] !== (current as any)[field]) {
          statusHistory.push({ status: `${field}:${(patch as any)[field]}`, changedAt: Date.now(), changedBy });
        }
      }
      const updated = schema.parse({
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
        version: ((current as any).version ?? 1) + 1,
        statusHistory,
      } as unknown as T);
      all[idx] = updated;
      writeAll(all);
      return updated;
    },
    remove(id) {
      writeAll(readAll().filter((r) => r.id !== id));
    },
    upsertRaw(record) {
      const validated = schema.parse(record);
      const all = readAll();
      const idx = all.findIndex((r) => r.id === validated.id);
      if (idx >= 0) all[idx] = validated;
      else all.push(validated);
      writeAll(all);
      return validated;
    },
  };
}
