/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 9: the Core Principle 5 classification rules, shared verbatim
 * across all 3 flow prompts instead of being copy-pasted into each one.
 * First written for screening.ts in Phase 6; extracted here so
 * evaluation.ts and documentation.ts can reuse the identical definitions
 * when their own risk claims gained classification.
 */
export const CLASSIFICATION_RULES = `Every claim that carries a "classification" must use the single best-fitting one, never defaulting to "sourced_fact" out of convenience:
- sourced_fact: verifiable from a specific document, filing, or named public source you were given or clearly recall.
- management_claim: stated by the company/management themselves (in the deck), not independently verified.
- derived_calculation: a number you computed from other given figures (e.g. a ratio).
- analyst_assumption: a judgment call you are making as the analyst, not a fact.
- ai_interpretation: your own inference/synthesis from the available material, not a discrete quoted fact.
- unverified_assertion: plausible-sounding but you cannot point to why you believe it.`;
