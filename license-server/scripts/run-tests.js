#!/usr/bin/env node
/**
 * Wrexlyn for Investments license-server — explicit-file test runner, same
 * convention as the main app's scripts/run-tests.js: walk dist/__tests__ and
 * pass each *.test.js as an explicit argv entry rather than relying on
 * --test glob support or shell globbing.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testDir = path.join(__dirname, "..", "dist", "__tests__");

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

const result = spawnSync(process.execPath, ["--test", "--test-force-exit", ...testFiles], { stdio: "inherit" });
process.exit(result.status ?? 1);
