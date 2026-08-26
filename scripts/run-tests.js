#!/usr/bin/env node
/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Explicit-file test runner, mirroring wrexlyn/codingagent's scripts/run-tests.js: walks
 * dist/server/__tests__ and passes each *.test.js as an explicit argv entry to `node --test`,
 * rather than relying on shell globbing (cmd.exe doesn't do it) or a Node version new enough for
 * --test's own glob support.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testDir = path.join(__dirname, "..", "dist", "server", "__tests__");

if (!fs.existsSync(testDir)) {
  console.error(`No compiled tests found at ${testDir} — run "npm run build" first.`);
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => path.join(testDir, f));

if (!testFiles.length) {
  console.error(`No *.test.js files found under ${testDir}.`);
  process.exit(1);
}

// --test-concurrency=1: several test files exercise the real domain JSON stores
// (server/domain/*.json) directly — running files concurrently races on those shared
// files and produces flaky miscounts. Serializing files is the fix, not per-file isolation,
// since the whole point of several of these tests is proving the real stores behave correctly.
const result = spawnSync(process.execPath, ["--test", "--test-force-exit", "--test-concurrency=1", ...testFiles], { stdio: "inherit" });
process.exit(result.status ?? 1);
