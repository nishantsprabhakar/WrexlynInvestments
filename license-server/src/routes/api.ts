/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * The two endpoints every registered install actually calls: register (once,
 * on first run) and checkin (every startup + periodic recheck). checkin
 * doubles as the usage-metrics datapoint the admin dashboard reads — there is
 * deliberately no separate telemetry-only endpoint.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db";
import { generateToken, hashToken } from "../tokens";

const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 100;
}

interface LatestRelease {
  commitSha: string;
  downloadUrl: string;
  notes?: string;
}

/** Shared by /api/checkin and /api/version — both gate on "does this bearer token belong to a
 *  known, non-revoked user", so a lookup mismatch (missing header, unknown token) means the same
 *  401 either way rather than two slightly different auth implementations to keep in sync. */
async function authenticateDevice(
  db: Db,
  authHeader: string | undefined
): Promise<{ id: number; status: string } | null> {
  const match = typeof authHeader === "string" ? /^Bearer\s+(.+)$/i.exec(authHeader.trim()) : null;
  if (!match) return null;
  const result = await db.query<{ id: number; status: string }>("SELECT id, status FROM users WHERE token_hash = $1", [
    hashToken(match[1]),
  ]);
  return result.rows[0] ?? null;
}

export function createApiRouter(db: Db): Router {
  const router = Router();

  // No public browser page calls this API directly (unlike coding-agent's GitHub Pages demo) — the
  // only caller is the Node process running Wrexlyn for Investments, which has no Origin header and
  // no CORS enforcement to begin with. Still answer OPTIONS cleanly in case that ever changes.
  router.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post("/register", registerLimiter, async (req, res) => {
    const { deviceId, name, email } = req.body ?? {};
    if (!isValidDeviceId(deviceId)) {
      res.status(400).json({ error: "deviceId is required" });
      return;
    }
    if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LEN) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
      res.status(400).json({ error: "a valid email is required" });
      return;
    }

    // Always mints a fresh token and replaces the stored hash — there's nothing to
    // return idempotently once hashed, and this doubles as a "my local token file
    // is gone" recovery path for a re-registering device.
    const token = generateToken();
    const tokenHash = hashToken(token);

    await db.query(
      `INSERT INTO users (device_id, name, email, token_hash, status, last_seen_at)
       VALUES ($1, $2, $3, $4, 'active', now())
       ON CONFLICT (device_id) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, token_hash = EXCLUDED.token_hash,
             last_seen_at = now()`,
      [deviceId, name.trim(), email.trim(), tokenHash]
    );

    res.json({ token });
  });

  router.post("/checkin", async (req, res) => {
    const user = await authenticateDevice(db, req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "missing or unknown bearer token" });
      return;
    }

    if (user.status === "revoked") {
      res.json({ allowed: false });
      return;
    }

    await db.query("UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]);
    await db.query("INSERT INTO usage_events (user_id, event_type) VALUES ($1, 'checkin')", [user.id]);
    res.json({ allowed: true });
  });

  // Not called by wrexlyn-investments today (no auto-update client), kept for parity with the
  // ported design and available if an update-check client is added later.
  router.get("/version", async (req, res) => {
    const user = await authenticateDevice(db, req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "missing or unknown bearer token" });
      return;
    }
    if (user.status === "revoked") {
      res.status(403).json({ error: "revoked" });
      return;
    }

    const result = await db.query<{ value: LatestRelease }>("SELECT value FROM app_config WHERE key = 'latest_release'");
    const release = result.rows[0]?.value ?? null;
    res.json({ release });
  });

  return router;
}
