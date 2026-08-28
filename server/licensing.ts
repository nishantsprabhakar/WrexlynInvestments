/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Terms-acceptance + license-activation gate, ported from coding-agent's
 * src/licensing.ts (the same author's other commercial product) and adapted:
 *
 * - Two-part gate, not one: (1) terms acceptance ("I AGREE") always runs,
 *   one-time per device, independent of whether licensing is configured —
 *   cheap, protective, and worth doing regardless. (2) device registration +
 *   periodic revocable checkin against a license-server ONLY runs if
 *   WREXLYN_INVESTMENTS_LICENSE_SERVER_URL is actually set. Unlike
 *   coding-agent (which points at an already-deployed server by default),
 *   wrexlyn-investments has no license-server deployed yet — hardcoding an
 *   always-on gate would hard-block every launch, including the developer's
 *   own, the moment this shipped. It turns on only once a real instance
 *   (see ../license-server/) is deployed and this env var points at it.
 * - Own env var namespace (WREXLYN_INVESTMENTS_*) and own local cache
 *   directory (~/.wrexlyn-investments/), so this coexists with coding-agent
 *   on the same machine with zero collision.
 * - Simplified storage: the bearer token lives in the SAME plaintext
 *   device.json as the non-secret device cache, not a ported copy of
 *   coding-agent's OS-keychain secretStore.ts. Deliberate: this token only
 *   authenticates check-ins to this app's own license-server (not deal data,
 *   not an LLM-billed API key), so the blast radius of it leaking is low,
 *   and porting ~300 lines of platform-specific shell-out code for that
 *   would be disproportionate. `getSecretStore` also isn't part of the
 *   `wrexlyn` package's public SDK surface — only `loadApiKey`/`saveApiKey`
 *   are — so using it here would mean modifying Wrexlyn Core, which every
 *   phase of this project has deliberately avoided.
 *
 * Hard-block semantics (same as coding-agent, battle-tested there): an
 * explicit `allowed:false` from the server always blocks immediately, with
 * zero grace, and is written back to the cache as sticky. A device that has
 * never successfully registered+checked in gets zero grace if the server is
 * unreachable. An already-registered device that merely can't *reach* the
 * server gets a bounded grace window keyed off its last successful checkin.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as readline from "readline";

const LICENSE_SERVER_URL = process.env.WREXLYN_INVESTMENTS_LICENSE_SERVER_URL || "";
const CHECKIN_TIMEOUT_MS = 5_000;
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TERMS_VERSION = "2026-08-27";

const CODES = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m" };
const color = {
  dim: (s: string) => `${CODES.dim}${s}${CODES.reset}`,
  bold: (s: string) => `${CODES.bold}${s}${CODES.reset}`,
  red: (s: string) => `${CODES.red}${s}${CODES.reset}`,
  green: (s: string) => `${CODES.green}${s}${CODES.reset}`,
  yellow: (s: string) => `${CODES.yellow}${s}${CODES.reset}`,
};
function printError(text: string): void {
  console.error(color.red(`error: ${text}`));
}

interface DeviceCache {
  deviceId: string;
  registered: boolean;
  name?: string;
  email?: string;
  /** Bearer token for this app's license-server. See file header re: why this isn't OS-keychain-backed. */
  token?: string;
  /** Timestamp (Date.now()) of the last SUCCESSFUL checkin — not the last attempt. */
  lastCheckedAt?: number;
  /** Sticky: an explicit false is never silently reread as true just because a later check is offline. */
  lastKnownAllowed?: boolean;
  /** Evidence of affirmative assent to the exact legal version shown before access. */
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
}

/** Overridable only by tests — production code must never call this. */
let cachePathOverride: string | null = null;
export function _setCachePathForTesting(p: string | null): void {
  cachePathOverride = p;
}

function registrationEnabled(): boolean {
  return LICENSE_SERVER_URL.length > 0 && process.env.WREXLYN_INVESTMENTS_SKIP_LICENSE_CHECK !== "1";
}

function cachePath(): string {
  return cachePathOverride ?? path.join(os.homedir(), ".wrexlyn-investments", "device.json");
}

function loadDeviceCache(): DeviceCache | null {
  try {
    const filePath = cachePath();
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function saveDeviceCache(cache: DeviceCache): void {
  try {
    const filePath = cachePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // best-effort
  }
}

function getOrCreateDeviceId(): string {
  const existing = loadDeviceCache();
  if (existing?.deviceId) return existing.deviceId;
  const deviceId = crypto.randomUUID();
  saveDeviceCache({ deviceId, registered: false });
  return deviceId;
}

async function ensureTermsAccepted(cache: DeviceCache): Promise<DeviceCache> {
  if (cache.acceptedTermsVersion === TERMS_VERSION && cache.acceptedTermsAt) return cache;

  const envAcceptance = process.env.WREXLYN_INVESTMENTS_ACCEPT_TERMS_VERSION;
  if (!process.stdin.isTTY) {
    if (envAcceptance !== TERMS_VERSION) {
      throw new Error(
        `Wrexlyn for Investments requires affirmative acceptance of Terms version ${TERMS_VERSION}. ` +
          `Review TERMS_OF_SERVICE.md, LICENSE, ACCEPTABLE_USE_POLICY.md, and PRIVACY_POLICY.md, ` +
          `then set WREXLYN_INVESTMENTS_ACCEPT_TERMS_VERSION=${TERMS_VERSION} if you agree.`
      );
    }
  } else {
    console.log(color.bold(`\nLegal terms — version ${TERMS_VERSION}`));
    console.log(
      color.dim(
        "Review TERMS_OF_SERVICE.md, LICENSE, ACCEPTABLE_USE_POLICY.md, and PRIVACY_POLICY.md. " +
          "They include risk allocation, release, indemnity, usage restrictions, and data disclosures."
      )
    );
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await new Promise<string>((resolve) =>
        rl.question('Type "I AGREE" to accept these documents and continue: ', resolve)
      );
      if (answer.trim() !== "I AGREE") throw new Error("Terms were not accepted; Wrexlyn for Investments cannot continue.");
    } finally {
      rl.close();
    }
  }

  const accepted = { ...cache, acceptedTermsVersion: TERMS_VERSION, acceptedTermsAt: new Date().toISOString() };
  saveDeviceCache(accepted);
  return accepted;
}

/** Non-interactive contexts (no attached TTY — a service install, this session's own headless
 *  verification) read these instead of hanging on rl.question. */
function envRegistration(): { name: string; email: string } | null {
  const name = process.env.WREXLYN_INVESTMENTS_NAME;
  const email = process.env.WREXLYN_INVESTMENTS_EMAIL;
  if (name && email) return { name, email };
  return null;
}

async function promptForRegistration(): Promise<{ name: string; email: string }> {
  const fromEnv = envRegistration();
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new Error(
      "Wrexlyn for Investments needs to register this install (name + email) and no terminal is attached to prompt for it. " +
        "Set WREXLYN_INVESTMENTS_NAME and WREXLYN_INVESTMENTS_EMAIL environment variables and try again."
    );
  }

  console.log(color.bold("\nWelcome to Wrexlyn for Investments — one-time registration"));
  console.log(color.dim("This installs your access. See TERMS_OF_SERVICE.md for what's collected and why.\n"));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question: string): Promise<string> => new Promise((resolve) => rl.question(question, resolve));
  try {
    let name = "";
    while (!name.trim()) name = await ask("Your name: ");
    let email = "";
    while (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = await ask("Your email: ");
    return { name: name.trim(), email: email.trim() };
  } finally {
    rl.close();
  }
}

async function registerDevice(deviceId: string, name: string, email: string): Promise<string> {
  const res = await fetch(`${LICENSE_SERVER_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, name, email }),
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(body.error || `Registration failed (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  return data.token;
}

/** Never throws for a network/timeout failure — returns null so the caller can apply grace-period logic. */
async function checkin(token: string): Promise<{ allowed: boolean } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECKIN_TIMEOUT_MS);
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/checkin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null; // unknown/invalid token — treat like unreachable, not an explicit revoke
    return (await res.json()) as { allowed: boolean };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function blockAndExit(message: string): never {
  printError(message);
  process.exit(1);
}

/**
 * Runs the full terms + license-check gate. May print an error and
 * process.exit(1) — callers don't need to handle a returned failure, this
 * function only returns at all when the app is cleared to start.
 */
export async function ensureRegisteredAndActive(): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  let cache = loadDeviceCache() ?? { deviceId, registered: false };
  try {
    cache = await ensureTermsAccepted(cache);
  } catch (err: any) {
    blockAndExit(err.message ?? String(err));
  }
  if (!registrationEnabled()) return; // no license-server configured — legal acceptance is still enforced above

  let token = cache.token;

  if (!token || !cache.registered) {
    let name: string, email: string;
    try {
      ({ name, email } = await promptForRegistration());
    } catch (err: any) {
      blockAndExit(err.message ?? String(err));
    }
    try {
      token = await registerDevice(deviceId, name, email);
    } catch (err: any) {
      blockAndExit(`Could not register with the license server: ${err.message ?? err}`);
    }
    saveDeviceCache({
      ...cache,
      deviceId,
      registered: true,
      name,
      email,
      token,
    });
    console.log(color.green("Registered — welcome to Wrexlyn for Investments.\n"));
  }

  const result = await checkin(token!);

  if (result !== null) {
    if (!result.allowed) {
      saveDeviceCache({ ...loadDeviceCache()!, lastKnownAllowed: false });
      blockAndExit("This install's access has been revoked. Contact the developer if you believe this is a mistake.");
    }
    saveDeviceCache({ ...loadDeviceCache()!, lastCheckedAt: Date.now(), lastKnownAllowed: true });
    return;
  }

  // Unreachable — apply the grace-period policy rather than treating downtime as a revoke.
  const current = loadDeviceCache();
  if (current?.lastKnownAllowed === false) {
    blockAndExit("This install's access has been revoked. Contact the developer if you believe this is a mistake.");
  }
  if (!current?.lastCheckedAt) {
    blockAndExit(
      "Couldn't verify this install's license (no prior successful check, and the license server is unreachable). Check your internet connection and try again."
    );
  }
  const age = Date.now() - current.lastCheckedAt;
  if (age > GRACE_PERIOD_MS) {
    blockAndExit("Couldn't verify this install's license and the offline grace period has expired. Check your internet connection and try again.");
  }
  console.log(
    color.yellow(`Warning: couldn't reach the license server — continuing on a cached check from ${Math.round(age / 3_600_000)}h ago.`)
  );
}

/** Applies to the whole life of the running server process. */
export function startPeriodicRecheck(intervalMs: number = RECHECK_INTERVAL_MS): void {
  if (!registrationEnabled()) return; // no point scheduling a check that's a no-op every time
  const timer = setInterval(() => {
    ensureRegisteredAndActive().catch(() => {
      // ensureRegisteredAndActive already exits the process on a hard block; a thrown error here
      // would only come from something unexpected, and this is a background timer with no one to
      // report it to — swallow rather than crash an otherwise-healthy running session.
    });
  }, intervalMs);
  timer.unref();
}
