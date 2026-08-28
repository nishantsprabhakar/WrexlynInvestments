/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * The admin dashboard: login, user list with usage/retention metrics, and revoke/restore.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db";
import { checkAdminPassword, createSession, destroySession, requireAdminSession } from "../adminAuth";
import {
  renderLoginPage,
  renderDashboard,
  toCsv,
  type Stats,
  type SparkPoint,
  type UserRow,
  type LatestRelease,
} from "../views";

async function loadLatestRelease(db: Db): Promise<LatestRelease | null> {
  const result = await db.query<{ value: LatestRelease }>("SELECT value FROM app_config WHERE key = 'latest_release'");
  return result.rows[0]?.value ?? null;
}

async function loadStats(db: Db): Promise<Stats> {
  const [total, active, revoked, active7, active30] = await Promise.all([
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users"),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE status = 'revoked'"),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE last_seen_at > now() - interval '7 days'"),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE last_seen_at > now() - interval '30 days'"),
  ]);
  return {
    total: Number(total.rows[0].count),
    active: Number(active.rows[0].count),
    revoked: Number(revoked.rows[0].count),
    activeLast7d: Number(active7.rows[0].count),
    activeLast30d: Number(active30.rows[0].count),
  };
}

async function loadUsers(db: Db, search: string): Promise<UserRow[]> {
  const result = await db.query<any>(
    `SELECT u.id, u.name, u.email, u.device_id, u.status, u.revoke_reason, u.created_at, u.last_seen_at,
            COUNT(e.id) AS checkin_count
     FROM users u
     LEFT JOIN usage_events e ON e.user_id = u.id
     WHERE ($1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
     GROUP BY u.id, u.name, u.email, u.device_id, u.status, u.revoke_reason, u.created_at, u.last_seen_at
     ORDER BY u.last_seen_at DESC NULLS LAST, u.created_at DESC`,
    [search]
  );
  return result.rows.map((row) => ({ ...row, checkin_count: Number(row.checkin_count) }));
}

/** Builds a full 30-point day series (zero-filled for days with no check-ins), since the raw
 *  SQL query only returns days that actually have at least one row. */
async function loadSparkline(db: Db): Promise<SparkPoint[]> {
  const result = await db.query<{ day: string; count: string }>(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(DISTINCT user_id) AS count
     FROM usage_events
     WHERE created_at > now() - interval '30 days'
     GROUP BY day`
  );
  const byDay = new Map(result.rows.map((r) => [r.day, Number(r.count)]));
  const points: SparkPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return points;
}

export function createAdminRouter(db: Db, adminPassword: string): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  router.get("/login", (_req, res) => {
    res.send(renderLoginPage());
  });

  router.post("/login", loginLimiter, (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkAdminPassword(password, adminPassword)) {
      res.status(401).send(renderLoginPage("Incorrect password."));
      return;
    }
    createSession(res);
    res.redirect("/admin");
  });

  router.get("/logout", (req, res) => {
    destroySession(req, res);
    res.redirect("/admin/login");
  });

  router.get("/", requireAdminSession, async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const [stats, users, sparkline, release] = await Promise.all([
      loadStats(db),
      loadUsers(db, search),
      loadSparkline(db),
      loadLatestRelease(db),
    ]);
    res.send(renderDashboard(stats, users, sparkline, search, release));
  });

  router.post("/release", requireAdminSession, async (req, res) => {
    const commitSha = typeof req.body?.commitSha === "string" ? req.body.commitSha.trim() : "";
    const downloadUrl = typeof req.body?.downloadUrl === "string" ? req.body.downloadUrl.trim() : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!commitSha || !downloadUrl) {
      res.status(400).send("commitSha and downloadUrl are required");
      return;
    }
    const release: LatestRelease = { commitSha, downloadUrl, ...(notes ? { notes } : {}) };
    await db.query(
      `INSERT INTO app_config (key, value, updated_at) VALUES ('latest_release', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(release)]
    );
    res.redirect("/admin");
  });

  router.get("/users.csv", requireAdminSession, async (_req, res) => {
    const users = await loadUsers(db, "");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=wrexlyn-investments-users.csv");
    res.send(toCsv(users));
  });

  router.post("/users/:id/revoke", requireAdminSession, async (req, res) => {
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null;
    await db.query("UPDATE users SET status = 'revoked', revoke_reason = $2, revoked_at = now() WHERE id = $1", [
      req.params.id,
      reason,
    ]);
    res.redirect("/admin");
  });

  router.post("/users/:id/restore", requireAdminSession, async (req, res) => {
    await db.query("UPDATE users SET status = 'active', revoke_reason = NULL, revoked_at = NULL WHERE id = $1", [
      req.params.id,
    ]);
    res.redirect("/admin");
  });

  return router;
}
