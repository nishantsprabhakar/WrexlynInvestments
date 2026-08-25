/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Writes a client-uploaded {name, base64} file into a deal's sandboxed
 * workspace and extracts its text via the matching vendored read tool.
 */
import * as fs from "fs";
import * as path from "path";
import type { ToolContext } from "./types";
import { readPdfTool } from "wrexlyn";
import { readDocxTool } from "./tools/docxRead";
import { readPptxTool } from "./tools/pptxRead";
import { readXlsxTool } from "./tools/xlsxRead";

export interface UploadedFile {
  name: string;
  base64: string;
}

export interface IngestedFile {
  originalName: string;
  storedRelPath: string;
  text: string;
  ok: boolean;
}

function safeFileName(originalName: string): string {
  const ext = path.extname(originalName) || "";
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `upload_${stamp}${ext}`;
}

export async function ingestUploadedFile(root: string, file: UploadedFile): Promise<IngestedFile> {
  const relPath = safeFileName(file.name);
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, Buffer.from(file.base64, "base64"));

  const ext = path.extname(file.name).toLowerCase().replace(".", "");
  const ctx: ToolContext = { root };

  if (ext === "pdf") {
    const r = await readPdfTool.run({ path: relPath }, ctx);
    return { originalName: file.name, storedRelPath: relPath, text: r.output, ok: r.ok };
  }
  if (ext === "docx" || ext === "doc") {
    const r = await readDocxTool.run({ path: relPath }, ctx);
    return { originalName: file.name, storedRelPath: relPath, text: r.output, ok: r.ok };
  }
  if (ext === "pptx" || ext === "ppt") {
    const r = await readPptxTool.run({ path: relPath }, ctx);
    return { originalName: file.name, storedRelPath: relPath, text: r.output, ok: r.ok };
  }
  if (ext === "xlsx" || ext === "xls") {
    const r = await readXlsxTool.run({ path: relPath }, ctx);
    return { originalName: file.name, storedRelPath: relPath, text: r.output, ok: r.ok };
  }
  if (ext === "txt" || ext === "csv" || ext === "md") {
    const text = fs.readFileSync(absPath, "utf-8");
    return { originalName: file.name, storedRelPath: relPath, text, ok: true };
  }
  return { originalName: file.name, storedRelPath: relPath, text: `(unsupported file type: .${ext})`, ok: false };
}
