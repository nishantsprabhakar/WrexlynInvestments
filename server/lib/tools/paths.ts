/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 *
 * COMPATIBILITY SHIM (Phase 3 migration): re-exports workspace path containment from "wrexlyn"
 * instead of vendoring a copy. Kept at this same path since docxRead.ts/pptxRead.ts/xlsxRead.ts and
 * server/index.ts all import `resolveInRoot` from here.
 */
export { resolveInRoot } from "wrexlyn";
