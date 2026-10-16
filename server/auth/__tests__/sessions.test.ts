/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Each test gets its own throwaway file so tests never share or race on state.
function freshSessionsModule() {
  delete require.cache[require.resolve("../sessions")];
  const mod = require("../sessions");
  const tmpFile = path.join(os.tmpdir(), `wrexlyn-investments-sessions-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  mod._setSessionsPathForTesting(tmpFile);
  return { mod, tmpFile };
}

test("createSession/validateSession: a fresh token resolves to its userId", () => {
  const { mod } = freshSessionsModule();
  const { token } = mod.createSession("usr_1");
  assert.equal(mod.validateSession(token), "usr_1");
});

test("validateSession: an unknown token is rejected", () => {
  const { mod } = freshSessionsModule();
  assert.equal(mod.validateSession("not-a-real-token"), null);
  assert.equal(mod.validateSession(undefined), null);
  assert.equal(mod.validateSession(null), null);
});

test("destroySession: a destroyed token no longer validates", () => {
  const { mod } = freshSessionsModule();
  const { token } = mod.createSession("usr_1");
  mod.destroySession(token);
  assert.equal(mod.validateSession(token), null);
});

test("validateSession: an expired session is rejected and pruned", () => {
  const { mod, tmpFile } = freshSessionsModule();
  const { token } = mod.createSession("usr_1");
  // Simulate time passing by rewriting the persisted file with an already-expired entry.
  const raw = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
  raw[token].expiresAt = Date.now() - 1000;
  fs.writeFileSync(tmpFile, JSON.stringify(raw), "utf-8");
  mod._resetSessionsForTesting(); // force a reload from disk
  assert.equal(mod.validateSession(token), null);
});

test("sessions persist across a module reload (simulating a process restart)", () => {
  const { mod, tmpFile } = freshSessionsModule();
  const { token } = mod.createSession("usr_42");

  delete require.cache[require.resolve("../sessions")];
  const reloaded = require("../sessions");
  reloaded._setSessionsPathForTesting(tmpFile);
  assert.equal(reloaded.validateSession(token), "usr_42");
});
