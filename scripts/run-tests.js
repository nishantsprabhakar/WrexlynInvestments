#!/usr/bin/env node
/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Explicit-file test runner, mirroring wrexlyn/codingagent's scripts/run-tests.js: walks every
 * __tests__ directory anywhere under dist/server (not just the top-level one — server/auth's own
 * __tests__ dir, added in Phase 15, lives alongside server's) and passes each compiled test file
 * as an explicit argv entry to `node --test`, rather than relying on shell globbing (cmd.exe
 * doesn't do it) or a Node version new enough for --test's own glob support.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const serverDir = path.join(__dirname, "..", "dist", "server");

if (!fs.existsSync(serverDir)) {
  console.error(`No compiled output found at ${serverDir} — run "npm run build" first.`);
  process.exit(1);
}

function findTestFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findTestFiles(full));
    else if (entry.name.endsWith(".test.js")) found.push(full);
  }
  return found;
}

const testFiles = findTestFiles(serverDir);

if (!testFiles.length) {
  console.error(`No *.test.js files found under ${serverDir}.`);
  process.exit(1);
}

// --test-concurrency=1: several test files exercise the real domain JSON stores
// (server/domain/*.json) directly — running files concurrently races on those shared
// files and produces flaky miscounts. Serializing files is the fix, not per-file isolation,
// since the whole point of several of these tests is proving the real stores behave correctly.
const result = spawnSync(process.execPath, ["--test", "--test-force-exit", "--test-concurrency=1", ...testFiles], { stdio: "inherit" });
process.exit(result.status ?? 1);
