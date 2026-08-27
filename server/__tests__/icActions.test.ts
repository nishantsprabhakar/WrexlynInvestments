/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Phase 11 tests: mapDecisionToMemorandumStatus for all 4 decision values.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mapDecisionToMemorandumStatus } from "../domain/icActions";

test("mapDecisionToMemorandumStatus: approve -> approved", () => {
  assert.equal(mapDecisionToMemorandumStatus("approve"), "approved");
});

test("mapDecisionToMemorandumStatus: approve_with_conditions -> approved", () => {
  assert.equal(mapDecisionToMemorandumStatus("approve_with_conditions"), "approved");
});

test("mapDecisionToMemorandumStatus: reject -> rejected", () => {
  assert.equal(mapDecisionToMemorandumStatus("reject"), "rejected");
});

test("mapDecisionToMemorandumStatus: defer -> submitted (not terminal)", () => {
  assert.equal(mapDecisionToMemorandumStatus("defer"), "submitted");
});
