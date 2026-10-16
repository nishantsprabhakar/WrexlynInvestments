/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Password hashing for local user accounts. Uses Node's built-in
 * `crypto.scrypt` (a deliberately slow, salted KDF) rather than the SHA-256
 * used by license-server/src/tokens.ts's hashToken — that function hashes
 * 256 bits of random entropy it generated itself, where a fast hash is fine;
 * a human-chosen password is a low-entropy secret that needs a slow,
 * salted KDF to resist brute-forcing. No new dependency (no bcrypt/argon2)
 * since scrypt ships with Node.
 */
import * as crypto from "crypto";

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Returns "saltHex:hashHex" — self-contained, no separate salt column needed. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
