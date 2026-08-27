/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Phase 3 migration integration tests — the ten scenarios the migration plan calls for, each
 * exercised through Investments' own glue code (lib/aiFlow, lib/settings, lib/ingest, lib/workspace,
 * lib/tools/paths) wherever that glue exists, so this proves the *migrated wiring* works, not just
 * that the "wrexlyn" package works in isolation (already covered by wrexlyn's own contract test).
 *
 * Hermetic by construction: never touches the real data/settings.json (settings.ts's
 * _setSettingsPathForTesting), the real OS keychain (wrexlyn/testing's secret-store/api-key
 * overrides), or any real deal's workspace folder (a uniquely-named test deal id, removed after).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { createDocxTool, createXlsxTool, createPptxTool, redlineDocxTool, buildArtifactPreview, chatCompletion, saveApiKey, loadApiKey, clearApiKey } from "wrexlyn";
import {
  setSecretStoreDirForTesting,
  _resetSecretStoreForTesting,
  setApiKeysDirForTesting,
  _resetApiKeysMigrationForTesting,
} from "wrexlyn/testing";

import { ingestUploadedFile } from "../lib/ingest";
import { dealWorkspaceRoot } from "../lib/workspace";
import { resolveInRoot } from "../lib/tools/paths";
import { _setSettingsPathForTesting, getConfiguredLlmConfig, saveSettings } from "../lib/settings";
import { runStructuredJson } from "../lib/aiFlow";

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sseBody(content: string): string {
  return [
    `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}`,
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}`,
    "data: [DONE]",
    "",
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// 1. Hosted-model call — through Investments' own settings.ts + aiFlow.ts.
// ---------------------------------------------------------------------------

test("hosted-model call: getConfiguredLlmConfig + runStructuredJson reaches Groq with the investment maxTokens override", async () => {
  const settingsDir = tempDir("wrx-inv-settings-");
  const secretDir = tempDir("wrx-inv-secret-");
  _setSettingsPathForTesting(settingsDir);
  setSecretStoreDirForTesting(secretDir);
  setApiKeysDirForTesting(secretDir);
  _resetSecretStoreForTesting();
  _resetApiKeysMigrationForTesting();

  const realFetch = global.fetch;
  let capturedMaxTokens: number | undefined;
  global.fetch = (async (_url: any, init: any) => {
    capturedMaxTokens = JSON.parse(init.body).max_tokens;
    return new Response(sseBody('{"result": "ok"}'), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;

  try {
    await saveApiKey("groq", "test-groq-key");
    saveSettings({ provider: "groq", model: "llama-3.3-70b-versatile" });

    const config = await getConfiguredLlmConfig();
    assert.equal(config.provider, "groq");
    assert.equal(config.maxTokens, 16000, "Investments must ask for the larger token budget its structured-JSON flows need");

    const parsed = await runStructuredJson("system prompt", "user content");
    assert.deepEqual(parsed, { result: "ok" });
    assert.equal(capturedMaxTokens, 16000, "the override must actually reach the outgoing request, not just LlmConfig");
  } finally {
    global.fetch = realFetch;
    _setSettingsPathForTesting(null);
    setSecretStoreDirForTesting(null);
    setApiKeysDirForTesting(null);
    _resetSecretStoreForTesting();
    _resetApiKeysMigrationForTesting();
  }
});

// ---------------------------------------------------------------------------
// 2. Custom / local-model call.
// ---------------------------------------------------------------------------

test("custom/local-model call: a user-configured OpenAI-compatible endpoint (e.g. Ollama) works end to end", async () => {
  const settingsDir = tempDir("wrx-inv-settings-");
  _setSettingsPathForTesting(settingsDir);

  const realFetch = global.fetch;
  let capturedUrl: string | undefined;
  global.fetch = (async (url: any) => {
    capturedUrl = String(url);
    return new Response(sseBody("hello from a local model"), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;

  try {
    saveSettings({ provider: "custom", model: "llama3", baseUrl: "http://localhost:11434/v1/chat/completions" });
    const config = await getConfiguredLlmConfig();
    assert.equal(config.provider, "custom");

    const result = await chatCompletion([{ role: "user", content: "hi" }], [], config);
    assert.equal(result.content, "hello from a local model");
    assert.equal(capturedUrl, "http://localhost:11434/v1/chat/completions");
  } finally {
    global.fetch = realFetch;
    _setSettingsPathForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// 3. Secure-key retrieval.
// ---------------------------------------------------------------------------

test("secure-key retrieval: save/load/clear round-trips through the shared OS-native secret store", async () => {
  const dir = tempDir("wrx-inv-secret-");
  setSecretStoreDirForTesting(dir);
  setApiKeysDirForTesting(dir);
  _resetSecretStoreForTesting();
  _resetApiKeysMigrationForTesting();
  try {
    await saveApiKey("openrouter", "sk-or-test-key");
    assert.equal(await loadApiKey("openrouter"), "sk-or-test-key");
    await clearApiKey("openrouter");
    assert.equal(await loadApiKey("openrouter"), null);
  } finally {
    setSecretStoreDirForTesting(null);
    setApiKeysDirForTesting(null);
    _resetSecretStoreForTesting();
    _resetApiKeysMigrationForTesting();
  }
});

// ---------------------------------------------------------------------------
// 4. PDF/DOCX/XLSX/PPTX ingestion — through Investments' own ingest.ts, round-tripping
//    real files generated by wrexlyn's own document tools (plus a minimal hand-built PDF).
// ---------------------------------------------------------------------------

const MINIMAL_PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    "4 0 obj<</Length 44>>stream",
    "BT /F1 24 Tf 20 100 Td (Hello Diligence PDF) Tj ET",
    "endstream",
    "endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Size 6/Root 1 0 R>>",
    "%%EOF",
    "",
  ].join("\n"),
  "utf-8"
);

test("ingestion: PDF, DOCX, XLSX, and PPTX uploads all extract readable text via ingest.ts", async () => {
  const root = tempDir("wrx-inv-ingest-");

  const docxBuf = await (async () => {
    const r = await createDocxTool.run({ path: "src.docx", blocks: [{ type: "paragraph", text: "Ingestion round-trip paragraph." }] }, { root });
    assert.equal(r.ok, true, r.output);
    return fs.readFileSync(path.join(root, "src.docx"));
  })();

  const xlsxBuf = await (async () => {
    const r = await createXlsxTool.run(
      { path: "src.xlsx", sheets: [{ name: "Model", headers: ["Metric", "Value"], rows: [["Revenue", 100]] }] },
      { root }
    );
    assert.equal(r.ok, true, r.output);
    return fs.readFileSync(path.join(root, "src.xlsx"));
  })();

  const pptxBuf = await (async () => {
    const r = await createPptxTool.run({ path: "src.pptx", slides: [{ title: "Deal Overview", bullets: ["Strong recurring revenue base."] }] }, { root });
    assert.equal(r.ok, true, r.output);
    return fs.readFileSync(path.join(root, "src.pptx"));
  })();

  const ingestRoot = tempDir("wrx-inv-ingest-target-");

  const pdfResult = await ingestUploadedFile(ingestRoot, { name: "memo.pdf", base64: MINIMAL_PDF.toString("base64") });
  assert.equal(pdfResult.ok, true, pdfResult.text);
  // readPdfTool truncates its preview output — assert the recognizable prefix, not the full string.
  assert.match(pdfResult.text, /Hello Diligence/);

  const docxResult = await ingestUploadedFile(ingestRoot, { name: "src.docx", base64: docxBuf.toString("base64") });
  assert.equal(docxResult.ok, true, docxResult.text);
  assert.match(docxResult.text, /Ingestion round-trip paragraph/);

  const xlsxResult = await ingestUploadedFile(ingestRoot, { name: "src.xlsx", base64: xlsxBuf.toString("base64") });
  assert.equal(xlsxResult.ok, true, xlsxResult.text);
  assert.match(xlsxResult.text, /Revenue/);

  const pptxResult = await ingestUploadedFile(ingestRoot, { name: "src.pptx", base64: pptxBuf.toString("base64") });
  assert.equal(pptxResult.ok, true, pptxResult.text);
  assert.match(pptxResult.text, /Strong recurring revenue base/);
});

// ---------------------------------------------------------------------------
// 5/6. DOCX and XLSX generation (also exercised above, asserted directly here).
// ---------------------------------------------------------------------------

test("DOCX generation: createDocxTool produces a real, non-trivial .docx file", async () => {
  const root = tempDir("wrx-inv-docxgen-");
  const result = await createDocxTool.run(
    { path: "report.docx", title: "IC Note", blocks: [{ type: "heading", level: 1, text: "Thesis" }, { type: "paragraph", text: "This deal has a durable moat and expanding margins." }] },
    { root }
  );
  assert.equal(result.ok, true, result.output);
  const stat = fs.statSync(path.join(root, "report.docx"));
  assert.ok(stat.size > 1000, `expected a real docx, got ${stat.size} bytes`);
});

test("XLSX generation: createXlsxTool produces a real workbook with a live formula", async () => {
  const root = tempDir("wrx-inv-xlsxgen-");
  const result = await createXlsxTool.run(
    {
      path: "model.xlsx",
      sheets: [{ name: "LBO", headers: ["Metric", "Value"], rows: [["Revenue", 100], ["EBITDA", 25], ["Margin", "=B3/B2"]] }],
    },
    { root }
  );
  assert.equal(result.ok, true, result.output);
  const stat = fs.statSync(path.join(root, "model.xlsx"));
  assert.ok(stat.size > 1000, `expected a real workbook, got ${stat.size} bytes`);
});

// ---------------------------------------------------------------------------
// 7. Redline generation.
// ---------------------------------------------------------------------------

test("redline generation: redlineDocxTool marks a real tracked change on a generated docx", async () => {
  const root = tempDir("wrx-inv-redline-");
  const gen = await createDocxTool.run(
    { path: "term-sheet.docx", blocks: [{ type: "paragraph", text: "The purchase price shall be forty million dollars." }] },
    { root }
  );
  assert.equal(gen.ok, true, gen.output);

  const redline = await redlineDocxTool.run(
    { path: "term-sheet.docx", old_string: "forty million dollars", new_string: "forty-five million dollars" },
    { root }
  );
  assert.equal(redline.ok, true, redline.output);
  assert.match(redline.output, /Redlined 1 occurrence/);
});

// ---------------------------------------------------------------------------
// 8. Artifact preview.
// ---------------------------------------------------------------------------

test("artifact preview: buildArtifactPreview renders a freshly generated docx", async () => {
  const root = tempDir("wrx-inv-preview-");
  const gen = await createDocxTool.run({ path: "preview-me.docx", blocks: [{ type: "paragraph", text: "Preview content." }] }, { root });
  assert.equal(gen.ok, true, gen.output);

  const buffer = fs.readFileSync(path.join(root, "preview-me.docx"));
  const preview = await buildArtifactPreview(buffer, "docx");
  assert.ok(preview, "expected a non-null preview for a valid docx");
});

// ---------------------------------------------------------------------------
// 9. Workspace containment — through Investments' own workspace.ts + the paths.ts shim.
// ---------------------------------------------------------------------------

test("workspace containment: per-deal root confines file access and rejects escapes", () => {
  const dealId = `__contract_test_${process.pid}_${Math.floor(Math.random() * 1e9)}`;
  const root = dealWorkspaceRoot(dealId);
  try {
    assert.ok(fs.existsSync(root));
    const resolved = resolveInRoot(root, "diligence/notes.txt");
    assert.equal(resolved, path.join(root, "diligence", "notes.txt"));
    assert.throws(() => resolveInRoot(root, "../../../etc/passwd"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 10. Failed-provider recovery.
// ---------------------------------------------------------------------------

test("failed-provider recovery: a transient 500 is retried and the call still succeeds", async () => {
  const realFetch = global.fetch;
  let callCount = 0;
  global.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) return new Response("", { status: 500 });
    return new Response(sseBody("recovered after retry"), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;

  try {
    const result = await chatCompletion([{ role: "user", content: "hi" }], [], {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      apiKey: "test-key",
    });
    assert.equal(callCount, 2);
    assert.equal(result.content, "recovered after retry");
  } finally {
    global.fetch = realFetch;
  }
});
