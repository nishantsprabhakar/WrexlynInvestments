/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Session tokens for logged-in users. Same shape as
 * license-server/src/adminAuth.ts (random bearer token, in-memory Map), but
 * persisted to disk: that service is an occasional admin dashboard where
 * losing sessions on a redeploy is an acceptable tradeoff; this is the main
 * app used all day, so a restart forcing every user to re-enter a password
 * would be real, avoidable friction. The Map is the source of truth at
 * runtime; the JSON file just reloads it on the next process start.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { findProjectRoot } from "../lib/projectRoot";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

let cachePathOverride: string | null = null;
/** Overridable only by tests — production code must never call this. */
export function _setSessionsPathForTesting(p: string | null): void {
  cachePathOverride = p;
  sessions = null; // force a reload from the new path on next access
}

function sessionsPath(): string {
  return cachePathOverride ?? path.join(findProjectRoot(__dirname), "data", "domain", "sessions.json");
}

let sessions: Map<string, SessionRecord> | null = null;

function load(): Map<string, SessionRecord> {
  if (sessions) return sessions;
  sessions = new Map();
  try {
    const p = sessionsPath();
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, SessionRecord>;
      const now = Date.now();
      for (const [token, record] of Object.entries(raw)) {
        if (record.expiresAt > now) sessions.set(token, record);
      }
    }
  } catch {
    // best-effort, matches every other local-JSON-store's read failure handling in this codebase
  }
  return sessions;
}

function persist(): void {
  try {
    const p = sessionsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const obj = Object.fromEntries(load().entries());
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // best-effort
  }
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  load().set(token, { userId, expiresAt });
  persist();
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  if (load().delete(token)) persist();
}

/** Returns the session's userId, or null if the token is missing/expired. Prunes an expired entry on read. */
export function validateSession(token: string | undefined | null): string | null {
  if (!token) return null;
  const record = load().get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    load().delete(token);
    persist();
    return null;
  }
  return record.userId;
}

/** Test-only: clears the in-memory session map (does not touch the file until the next create/destroy). */
export function _resetSessionsForTesting(): void {
  sessions = new Map();
}
