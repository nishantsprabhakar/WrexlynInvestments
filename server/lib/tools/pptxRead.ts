/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * New tool, same shape as pdf.ts's readPdfTool: raw-text extraction from an
 * uploaded .pptx deck (unzips the OOXML and pulls <a:t> text runs per slide,
 * in slide order) — needed for Screening/Evaluation deck ingestion, which
 * Wrexlyn itself has no read-side tool for (only create_pptx).
 */
import * as fs from "fs";
import JSZip from "jszip";
import { resolveInRoot, type ToolSpec } from "wrexlyn";

const MAX_OUTPUT_CHARS = 100_000;

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideKeys = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0], 10);
      const nb = parseInt(b.match(/\d+/)![0], 10);
      return na - nb;
    });

  const texts: string[] = [];
  for (const key of slideKeys) {
    const xml = await zip.files[key].async("string");
    const runs = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1]);
    const slideNum = parseInt(key.match(/\d+/)![0], 10);
    const text = runs.join(" ").trim();
    if (text) texts.push(`[Slide ${slideNum}] ${text}`);
  }
  return texts.join("\n");
}

export const readPptxTool: ToolSpec = {
  mutating: false,
  definition: {
    type: "function",
    function: {
      name: "read_pptx",
      description: "Extract text from a PowerPoint (.pptx) deck in the working directory, slide by slide.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the .pptx, relative to the working directory." },
        },
        required: ["path"],
      },
    },
  },
  describe: (args) => `read ${args.path}`,
  run: async (args, ctx) => {
    const filePath = resolveInRoot(ctx.root, args.path);
    if (!fs.existsSync(filePath)) {
      return { ok: false, output: `File not found: ${args.path}` };
    }
    try {
      const buffer = fs.readFileSync(filePath);
      const text = (await extractPptxText(buffer)).trim();
      if (!text) return { ok: true, output: "(no extractable text on any slide)" };
      const truncated = text.length > MAX_OUTPUT_CHARS;
      return { ok: true, output: truncated ? text.slice(0, MAX_OUTPUT_CHARS) + "\n\n... (truncated)" : text };
    } catch (err: any) {
      return { ok: false, output: `Failed to read ${args.path}: ${err.message ?? err}` };
    }
  },
};
