/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 10 tests: Source-record building (kind derived per file extension)
 * and ResearchFinding building (one per keyFact, classification + sourceId
 * carried through) — both pure, no I/O.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSourceInput, sourceKindFromFileName } from "../domain/sourceActions";
import { buildResearchFindingInputs } from "../flows/screening.persist";

test("sourceKindFromFileName: derives the right kind per extension", () => {
  assert.equal(sourceKindFromFileName("deck.pdf"), "pdf");
  assert.equal(sourceKindFromFileName("Report.DOCX"), "docx");
  assert.equal(sourceKindFromFileName("old.doc"), "docx");
  assert.equal(sourceKindFromFileName("slides.pptx"), "pptx");
  assert.equal(sourceKindFromFileName("model.xlsx"), "xlsx");
  assert.equal(sourceKindFromFileName("notes.txt"), "other");
});

test("buildSourceInput: maps an ingested file onto the Source shape", () => {
  const input = buildSourceInput("legacy:deal-1", "com_1", {
    originalName: "Company_Deck.pdf",
    storedRelPath: "upload_abc123.pdf",
    text: "some text",
    ok: true,
  });
  assert.equal(input.dealId, "legacy:deal-1");
  assert.equal(input.companyId, "com_1");
  assert.equal(input.kind, "pdf");
  assert.equal(input.title, "Company_Deck.pdf");
  assert.equal(input.storedPath, "upload_abc123.pdf");
  assert.ok(typeof input.retrievedAt === "number");
});

test("buildResearchFindingInputs: one ResearchFinding per keyFact, classification + sourceId carried through", () => {
  const report = {
    keyFacts: [
      { text: "Founded 2015", classification: "sourced_fact" },
      { text: "Raised $10M Series A", classification: "management_claim" },
    ],
  };
  const findings = buildResearchFindingInputs(report, "legacy:deal-1", "com_1", "src_1");
  assert.equal(findings.length, 2);
  assert.equal(findings[0].dealId, "legacy:deal-1");
  assert.equal(findings[0].companyId, "com_1");
  assert.equal(findings[0].summary, "Founded 2015");
  assert.equal(findings[0].provenance.classification, "sourced_fact");
  assert.equal(findings[0].provenance.sourceId, "src_1");
  assert.equal(findings[0].sourceId, "src_1");
  assert.equal(findings[1].provenance.classification, "management_claim");
});

test("buildResearchFindingInputs: sourceId is left undefined when no deck was ingested — never fabricated", () => {
  const report = { keyFacts: [{ text: "Public filing figure", classification: "sourced_fact" }] };
  const findings = buildResearchFindingInputs(report, "legacy:deal-1", "com_1");
  assert.equal(findings[0].sourceId, undefined);
  assert.equal(findings[0].provenance.sourceId, undefined);
});
