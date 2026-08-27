/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Per-deal sandboxed root directory — the same `ctx.root` concept the
 * vendored tools (create_docx/create_xlsx/redline_docx/read_pdf/...)
 * expect, confined via tools/paths.ts's resolveInRoot.
 */
import * as fs from "fs";
import * as path from "path";
import { findProjectRoot } from "./projectRoot";

const WORKSPACE_ROOT = path.join(findProjectRoot(__dirname), "workspace");

export function dealWorkspaceRoot(dealId: string): string {
  const root = path.join(WORKSPACE_ROOT, dealId);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function workspaceRootDir(): string {
  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  return WORKSPACE_ROOT;
}
