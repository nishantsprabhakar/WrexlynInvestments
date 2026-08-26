/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Locates the project root (the directory containing package.json) by
 * walking up from a starting directory, instead of a fixed `../../..`
 * count. A fixed count is only correct for one specific execution mode —
 * compiled (dist/server/<x>/file.js, 3 levels to root) — and silently
 * resolves to the wrong directory (or outside the project entirely) when
 * the same file runs directly from source via `tsx` (server/<x>/file.ts,
 * one level shallower). Every module that derives an on-disk data path
 * from `__dirname` should resolve through this instead of hand-counting.
 */
import * as fs from "fs";
import * as path from "path";

export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}
