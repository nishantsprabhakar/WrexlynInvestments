/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 10: builds a Source record for a file a flow just ingested. Every
 * flow ingests a file today (screening's optional deck, evaluation's deck
 * + model, documentation's per-file loop) but never recorded a Source for
 * it — only migrateLegacy.ts's one-time backfill did. sourceKindFromFileName
 * is extracted from migrateLegacy.ts's own copy so both share one
 * implementation instead of two independently-maintained ones.
 */
import * as path from "path";
import type { IngestedFile } from "../lib/ingest";

export function sourceKindFromFileName(fileName: string): "pdf" | "docx" | "pptx" | "xlsx" | "other" {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  return "other";
}

export function buildSourceInput(dealId: string, companyId: string, ingested: IngestedFile) {
  return {
    dealId,
    companyId,
    kind: sourceKindFromFileName(ingested.originalName),
    title: ingested.originalName,
    retrievedAt: Date.now(),
    storedPath: ingested.storedRelPath,
  };
}
