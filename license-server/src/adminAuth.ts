/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * Admin session auth: a random token, no external session-store dependency.
 * Sessions live in an in-memory Map rather than Postgres — this is a
 * single-admin service, so losing sessions on a restart/redeploy (just log in
 * again) is an acceptable, much simpler tradeoff than a persistent session table.
 */
import * as crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const SESSION_COOKIE = "wrexlyn_investments_admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map<string, number>(); // token -> expiresAt

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** True if `candidate` matches the configured admin password (constant-time). */
export function checkAdminPassword(candidate: string, configured: string): boolean {
  return !!candidate && !!configured && safeEqual(candidate, configured);
}

/** Issues a new session, sets its cookie on `res`, and returns the raw token (mainly for tests). */
export function createSession(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

export function destroySession(req: Request, res: Response): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
}

function isValidSession(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const expiresAt = sessions.get(token);
  if (expiresAt === undefined) return false;
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Express middleware — redirects to /admin/login if there's no valid session cookie. */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (isValidSession(req.cookies?.[SESSION_COOKIE])) {
    next();
    return;
  }
  res.redirect("/admin/login");
}

/** Test-only: clears all sessions between test cases. */
export function _resetSessionsForTesting(): void {
  sessions.clear();
}
