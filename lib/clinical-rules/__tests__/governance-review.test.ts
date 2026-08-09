import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertSeparateGovernanceActors,
  ClinicalGovernanceReviewActionSchema,
  CLINICAL_GOVERNANCE_CASES,
} from "../governance-review";

test("governance workspace exposes the complete activation-closure evidence scope", () => {
  assert.equal(CLINICAL_GOVERNANCE_CASES.length, 16);
  assert.deepEqual(
    CLINICAL_GOVERNANCE_CASES.map((item) => item.caseId),
    [
      "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
      "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
      "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
      "ROUTER-002",
      "ROUTER-003",
      "ROUTER-001",
      "F9-14-ONCOLOGY-MDT",
      "LEGACY-005",
      "LEGACY-014",
      "LEGACY-017",
      "LEGACY-026",
      "INPUT-GAP-STAGE-1A1",
      "INPUT-GAP-NON-CERVICAL-HYSTERECTOMY",
      "TIMING-POLICY",
      "REGRADE-POLICY",
      "GOV-04",
    ]
  );
});

test("one actor cannot propose and finally approve the same interpretation", () => {
  assert.throws(
    () => assertSeparateGovernanceActors("reviewer-1", "reviewer-1"),
    /cannot finally approve/
  );
  assert.doesNotThrow(() =>
    assertSeparateGovernanceActors("reviewer-1", "reviewer-2")
  );
});

test("the governed lifecycle enforces two approvers and a distinct activating operator", () => {
  const source = readFileSync("lib/clinical-rules/lifecycle.ts", "utf8");
  assert.match(source, /clinicalApprovers\.size < 2/);
  assert.match(source, /activating operator must be distinct/);
  assert.match(source, /has already approved the version/);
});

test("governance review write contract rejects unsupported dispositions and short comments", () => {
  const valid = {
    action: "PROPOSE",
    caseId: CLINICAL_GOVERNANCE_CASES[0].caseId,
    disposition: "ORACLE_CORRECTION_REQUIRED",
    comments: "Primary recommendation prose supports the correction.",
    expectedRevision: 1,
  };
  assert.equal(ClinicalGovernanceReviewActionSchema.safeParse(valid).success, true);
  assert.equal(
    ClinicalGovernanceReviewActionSchema.safeParse({ ...valid, action: "REJECT" }).success,
    true
  );
  assert.equal(
    ClinicalGovernanceReviewActionSchema.safeParse({
      ...valid,
      disposition: "AUTO_APPROVE",
    }).success,
    false
  );
  assert.equal(
    ClinicalGovernanceReviewActionSchema.safeParse({ ...valid, comments: "short" }).success,
    false
  );
});
