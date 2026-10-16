/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Asserts the full role x capability matrix directly — not spot-checked —
 * since this is the actual security boundary every mutating API route
 * relies on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { can, requiredCapability, type Capability } from "../permissions";
import { ROLES, type Role } from "../users";

const EXPECTED: Record<Role, Capability[]> = {
  partner: ["manage_users", "run_ai_flows", "edit_deal", "decide", "manage_fund_admin", "manage_portfolio"],
  principal: ["run_ai_flows", "edit_deal", "decide", "manage_fund_admin", "manage_portfolio"],
  associate: ["run_ai_flows", "edit_deal", "manage_portfolio"],
  analyst: ["run_ai_flows", "edit_deal"],
  compliance: [],
  ops: ["manage_fund_admin", "manage_portfolio"],
};

const ALL_CAPABILITIES: Capability[] = ["manage_users", "run_ai_flows", "edit_deal", "decide", "manage_fund_admin", "manage_portfolio"];

test("permission matrix: every role has exactly its expected capabilities, no more, no less", () => {
  for (const role of ROLES) {
    for (const capability of ALL_CAPABILITIES) {
      const expected = EXPECTED[role].includes(capability);
      assert.equal(can(role, capability), expected, `${role} x ${capability} should be ${expected}`);
    }
  }
});

test("compliance role has zero write capabilities (read-only)", () => {
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(can("compliance", capability), false);
  }
});

test("only partner can manage_users", () => {
  for (const role of ROLES) {
    assert.equal(can(role, "manage_users"), role === "partner");
  }
});

test("only partner and principal can decide", () => {
  for (const role of ROLES) {
    assert.equal(can(role, "decide"), role === "partner" || role === "principal");
  }
});

test("requiredCapability: GET is always unrestricted (null)", () => {
  assert.equal(requiredCapability("GET", "/api/ic-decisions"), null);
  assert.equal(requiredCapability("GET", "/api/portfolio/investments"), null);
  assert.equal(requiredCapability("GET", "/api/settings"), null);
});

test("requiredCapability: maps known mutating routes to the right capability", () => {
  assert.equal(requiredCapability("POST", "/api/screening"), "run_ai_flows");
  assert.equal(requiredCapability("POST", "/api/evaluation"), "run_ai_flows");
  assert.equal(requiredCapability("POST", "/api/documentation"), "run_ai_flows");
  assert.equal(requiredCapability("POST", "/api/pipeline/deals"), "edit_deal");
  assert.equal(requiredCapability("PATCH", "/api/pipeline/deals"), "edit_deal");
  assert.equal(requiredCapability("DELETE", "/api/pipeline/deals"), "edit_deal");
  assert.equal(requiredCapability("POST", "/api/ic-decisions"), "decide");
  assert.equal(requiredCapability("PATCH", "/api/approval-conditions"), "decide");
  assert.equal(requiredCapability("POST", "/api/portfolio/follow-on-decisions"), "decide");
  assert.equal(requiredCapability("POST", "/api/portfolio/realised-proceeds"), "decide");
  assert.equal(requiredCapability("POST", "/api/contacts"), "manage_fund_admin");
  assert.equal(requiredCapability("POST", "/api/deal-teams"), "manage_fund_admin");
  assert.equal(requiredCapability("POST", "/api/investment-vehicles"), "manage_fund_admin");
  assert.equal(requiredCapability("POST", "/api/investment-mandates"), "manage_fund_admin");
  assert.equal(requiredCapability("POST", "/api/portfolio/investments"), "manage_portfolio");
  assert.equal(requiredCapability("POST", "/api/portfolio/kpis"), "manage_portfolio");
  assert.equal(requiredCapability("POST", "/api/valuation-cases"), "edit_deal");
  assert.equal(requiredCapability("POST", "/api/cap-tables"), "edit_deal");
  assert.equal(requiredCapability("POST", "/api/diligence/requests"), "edit_deal");
});

test("requiredCapability: an unmapped mutation (e.g. /api/settings) returns null so the caller fails closed to partner-only", () => {
  assert.equal(requiredCapability("POST", "/api/settings"), null);
  assert.equal(requiredCapability("POST", "/api/api-keys"), null);
  assert.equal(requiredCapability("DELETE", "/api/api-keys"), null);
});
