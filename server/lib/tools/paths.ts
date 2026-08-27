/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * COMPATIBILITY SHIM (Phase 3 migration): re-exports workspace path containment from "wrexlyn"
 * instead of vendoring a copy. Kept at this same path since docxRead.ts/pptxRead.ts/xlsxRead.ts and
 * server/index.ts all import `resolveInRoot` from here.
 */
export { resolveInRoot } from "wrexlyn";
