/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 6 audit-trail tests: append-only round-trip, dealId filtering,
 * corrupted-line tolerance, and the architectural guarantee that no
 * update/remove function is exported.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

import * as auditLog from "../domain/audit/auditLog";
import { recordAuditEntry, listAuditEntries } from "../domain/audit/auditLog";
import { findProjectRoot } from "../lib/projectRoot";

function auditFilePath(): string {
  return path.join(findProjectRoot(__dirname), "data", "audit.jsonl");
}

function withCleanSlate(fn: () => void) {
  const p = auditFilePath();
  const existed = fs.existsSync(p);
  const backup = existed ? fs.readFileSync(p, "utf-8") : null;
  fs.writeFileSync(p, "", "utf-8");
  try {
    fn();
  } finally {
    if (backup !== null) fs.writeFileSync(p, backup, "utf-8");
    else fs.rmSync(p, { force: true });
  }
}

test("auditLog: only exports recordAuditEntry and listAuditEntries — no update/remove", () => {
  const exported = Object.keys(auditLog).sort();
  assert.deepEqual(exported, ["listAuditEntries", "recordAuditEntry"]);
});

test("recordAuditEntry + listAuditEntries: round-trip and append in order", () => {
  withCleanSlate(() => {
    const e1 = recordAuditEntry({
      dealId: "deal-1",
      companyName: "Acme",
      flow: "screening",
      inputSummary: "no deck",
      outputSummary: { overallRating: 73 },
      validationOk: true,
    });
    const e2 = recordAuditEntry({
      dealId: "deal-1",
      companyName: "Acme",
      flow: "evaluation",
      inputSummary: "deck: x.pdf, model: y.xlsx",
      outputSummary: { ebitdaMarginPct: 20 },
      validationOk: true,
    });

    const all = listAuditEntries();
    assert.equal(all.length, 2);
    assert.equal(all[0].id, e1.id);
    assert.equal(all[1].id, e2.id);
    assert.equal(all[1].flow, "evaluation");
  });
});

test("listAuditEntries: filters by dealId", () => {
  withCleanSlate(() => {
    recordAuditEntry({
      dealId: "deal-A",
      companyName: "Alpha",
      flow: "screening",
      inputSummary: "",
      outputSummary: {},
      validationOk: true,
    });
    recordAuditEntry({
      dealId: "deal-B",
      companyName: "Beta",
      flow: "screening",
      inputSummary: "",
      outputSummary: {},
      validationOk: true,
    });

    const filtered = listAuditEntries({ dealId: "deal-B" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].companyName, "Beta");
  });
});

test("listAuditEntries: a corrupted line is skipped, not fatal", () => {
  withCleanSlate(() => {
    recordAuditEntry({
      dealId: "deal-1",
      companyName: "Acme",
      flow: "documentation",
      inputSummary: "",
      outputSummary: {},
      validationOk: true,
    });
    fs.appendFileSync(auditFilePath(), "{not valid json\n", "utf-8");
    recordAuditEntry({
      dealId: "deal-1",
      companyName: "Acme",
      flow: "documentation",
      inputSummary: "",
      outputSummary: {},
      validationOk: true,
    });

    const all = listAuditEntries();
    assert.equal(all.length, 2);
  });
});
