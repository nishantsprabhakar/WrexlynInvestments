/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * New tool, same shape as pdf.ts's readPdfTool: raw-text extraction from an
 * uploaded .docx via mammoth.extractRawText. Wrexlyn itself only uses mammoth
 * for HTML preview (artifactPreview.ts), not for feeding text back into an
 * LLM call — this fills that one gap using the codebase's own conventions.
 */
import * as fs from "fs";
import mammoth from "mammoth";
import type { ToolSpec } from "../types";
import { resolveInRoot } from "./paths";

const MAX_OUTPUT_CHARS = 100_000;

export const readDocxTool: ToolSpec = {
  mutating: false,
  definition: {
    type: "function",
    function: {
      name: "read_docx",
      description: "Extract plain text from a Word (.docx) file in the working directory (decks, contracts, memos, financial write-ups).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the .docx, relative to the working directory." },
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
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      if (!text) {
        return { ok: true, output: "(no extractable text — this document may be empty or image-only)" };
      }
      const truncated = text.length > MAX_OUTPUT_CHARS;
      const output = truncated ? text.slice(0, MAX_OUTPUT_CHARS) + "\n\n... (truncated)" : text;
      return { ok: true, output };
    } catch (err: any) {
      return { ok: false, output: `Failed to read ${args.path}: ${err.message ?? err}` };
    }
  },
};
