import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACTIVATION_GATE_DEFINITIONS,
  ActivationGateDecisionSchema,
  ROLLBACK_THRESHOLD_CANDIDATES,
} from "../activation-governance";

test("the activation centre exposes every accountable operational gate", () => {
  assert.equal(ACTIVATION_GATE_DEFINITIONS.length, 11);
  assert.deepEqual(
    ACTIVATION_GATE_DEFINITIONS.map((item) => item.gateId),
    [
      "GOV-01", "GOV-02", "GOV-03", "GOV-04-OPERATING-POINT",
      "ROLLBACK-THRESHOLDS", "LICENSING", "RISK-ACCEPTANCE", "R6-CREDENTIAL",
      "ACTIVATION-OPERATOR", "DEPUTY-OPERATOR", "SHARED-REHEARSAL",
    ]
  );
  assert.equal(Object.keys(ROLLBACK_THRESHOLD_CANDIDATES).length, 8);
});

test("activation decisions require an explicit action and attributable comment", () => {
  const valid = {
    gateId: "RISK-ACCEPTANCE",
    action: "REQUEST_CHANGE",
    comments: "Risk owner requires additional evidence before acceptance.",
  };
  assert.equal(ActivationGateDecisionSchema.safeParse(valid).success, true);
  assert.equal(ActivationGateDecisionSchema.safeParse({ ...valid, comments: "short" }).success, false);
  assert.equal(ActivationGateDecisionSchema.safeParse({ ...valid, action: "AUTO_APPROVE" }).success, false);
});

test("Production activation enforces current-checksum clinical cards and operational gates", () => {
  const source = readFileSync("lib/clinical-rules/activation-governance.ts", "utf8");
  assert.match(source, /details\.checksum !== version\.checksum/);
  assert.match(source, /Production activation gates are incomplete/);
  assert.match(source, /Only the assigned Activation Operator/);
  assert.match(source, /Activation Operator or Deputy Operator/);
});
