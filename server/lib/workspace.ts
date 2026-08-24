/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Per-deal sandboxed root directory — the same `ctx.root` concept the
 * vendored tools (create_docx/create_xlsx/redline_docx/read_pdf/...)
 * expect, confined via tools/paths.ts's resolveInRoot.
 */
import * as fs from "fs";
import * as path from "path";

const WORKSPACE_ROOT = path.join(__dirname, "..", "..", "..", "workspace");

export function dealWorkspaceRoot(dealId: string): string {
  const root = path.join(WORKSPACE_ROOT, dealId);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function workspaceRootDir(): string {
  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  return WORKSPACE_ROOT;
}
