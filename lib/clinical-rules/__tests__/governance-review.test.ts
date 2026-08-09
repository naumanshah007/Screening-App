import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSeparateGovernanceActors,
  ClinicalGovernanceReviewActionSchema,
  CLINICAL_GOVERNANCE_CASES,
} from "../governance-review";

test("governance workspace exposes the complete three-case evidence scope", () => {
  assert.equal(CLINICAL_GOVERNANCE_CASES.length, 3);
  assert.deepEqual(
    CLINICAL_GOVERNANCE_CASES.map((item) => item.caseId),
    [
      "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
      "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
      "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
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
