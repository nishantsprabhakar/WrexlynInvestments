/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 13: builds a ValuationCase input, calling Phase 5's valuation
 * engine (dcfValue/terminalValueGordonGrowth/impliedValuationFromMultiple)
 * for the two methods it can actually compute deterministically. The
 * other methods (comps/precedent_transactions/lbo_implied/other) have no
 * comparable-transaction data source in this product — their impliedValueM
 * is a human-entered figure, recorded as-is, never fabricated as computed.
 */
import { dcfValue, terminalValueGordonGrowth, impliedValuationFromMultiple } from "./finance/calculations";

export interface ValuationCaseBody {
  method: "dcf" | "comps" | "precedent_transactions" | "arr_multiple" | "lbo_implied" | "other";
  cashFlows?: number[];
  /** A fraction (0.1 = 10%), matching dcfValue/terminalValueGordonGrowth's own convention — not a 0-100 percent. */
  discountRate?: number;
  /** A fraction (0.03 = 3%), same convention as discountRate. */
  perpetualGrowthRate?: number;
  metricValue?: number;
  multiple?: number;
  impliedValueM?: number;
  notes?: string;
}

export function buildValuationCaseInput(dealId: string, body: ValuationCaseBody) {
  const assumptions: Record<string, unknown> = {};
  let impliedValueM: number | undefined = body.impliedValueM;

  if (body.method === "dcf" && Array.isArray(body.cashFlows) && body.cashFlows.length && body.discountRate != null) {
    assumptions.cashFlows = body.cashFlows;
    assumptions.discountRate = body.discountRate;
    let terminalValue: number | undefined;
    if (body.perpetualGrowthRate != null) {
      const finalCashFlow = body.cashFlows[body.cashFlows.length - 1];
      terminalValue = terminalValueGordonGrowth(finalCashFlow, body.discountRate, body.perpetualGrowthRate) ?? undefined;
      assumptions.perpetualGrowthRate = body.perpetualGrowthRate;
    }
    impliedValueM = dcfValue({ cashFlows: body.cashFlows, discountRate: body.discountRate, terminalValue });
  } else if (body.method === "arr_multiple" && body.metricValue != null && body.multiple != null) {
    assumptions.metricValue = body.metricValue;
    assumptions.multiple = body.multiple;
    impliedValueM = impliedValuationFromMultiple(body.metricValue, body.multiple);
  }

  return {
    dealId,
    method: body.method,
    assumptions,
    impliedValueM,
    notes: body.notes || undefined,
  };
}
