/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * New tool, same shape as pdf.ts's readPdfTool: raw-text extraction from an
 * uploaded .xlsx financial model via ExcelJS (each sheet rendered as CSV-ish
 * text, capped per sheet) — needed for Evaluation-flow model ingestion,
 * which Wrexlyn itself has no read-side tool for (only create_xlsx).
 */
import * as fs from "fs";
import ExcelJS from "exceljs";
import type { ToolSpec } from "../types";
import { resolveInRoot } from "./paths";

const MAX_CHARS_PER_SHEET = 6000;
const MAX_ROWS_PER_SHEET = 200;
const MAX_OUTPUT_CHARS = 100_000;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "result" in (value as any)) return String((value as any).result ?? "");
  if (typeof value === "object" && "text" in (value as any)) return String((value as any).text ?? "");
  return String(value);
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    const lines: string[] = [];
    let rowCount = 0;
    sheet.eachRow((row) => {
      if (rowCount >= MAX_ROWS_PER_SHEET) return;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellText(cell.value)));
      lines.push(cells.join(","));
      rowCount++;
    });
    const csv = lines.join("\n").slice(0, MAX_CHARS_PER_SHEET);
    parts.push(`=== Sheet: ${sheet.name} ===\n${csv}`);
  });
  return parts.join("\n\n");
}

export const readXlsxTool: ToolSpec = {
  mutating: false,
  definition: {
    type: "function",
    function: {
      name: "read_xlsx",
      description: "Extract data from an Excel (.xlsx) financial model in the working directory, sheet by sheet, as CSV-like text.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the .xlsx, relative to the working directory." },
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
      const text = (await extractXlsxText(buffer)).trim();
      if (!text) return { ok: true, output: "(no readable sheets/data)" };
      const truncated = text.length > MAX_OUTPUT_CHARS;
      return { ok: true, output: truncated ? text.slice(0, MAX_OUTPUT_CHARS) + "\n\n... (truncated)" : text };
    } catch (err: any) {
      return { ok: false, output: `Failed to read ${args.path}: ${err.message ?? err}` };
    }
  },
};
