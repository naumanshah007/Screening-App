import test from "node:test";
import assert from "node:assert/strict";

import { buildPriorComparison, type DecisionSnapshot } from "@/lib/batch/reprocessing";

const base: DecisionSnapshot = {
  recommendation: "Routine colposcopy within 3 months",
  recommendationCode: "COL-007",
  riskLevel: "MEDIUM",
  referralPriority: "P3",
  triagePriority: "P3",
  disposition: "ACCEPTED",
  reviewedByName: "Dr A",
  reviewedAt: "2026-06-01T00:00:00.000Z",
  date: "2026-06-01T00:00:00.000Z",
};

test("comparison flags changed fields when the result escalates", () => {
  const now: DecisionSnapshot = {
    ...base,
    recommendation: "High-priority colposcopy within 30 days",
    recommendationCode: "COL-004",
    riskLevel: "HIGH",
    referralPriority: "P2",
    triagePriority: "P2",
    disposition: "PENDING",
    date: "2026-06-20T00:00:00.000Z",
  };
  const cmp = buildPriorComparison(base, now);
  assert.equal(cmp.anyChanged, true);
  const risk = cmp.fields.find((f) => f.label === "Risk level");
  assert.ok(risk?.changed);
  assert.equal(risk!.previous, "MEDIUM");
  assert.equal(risk!.current, "HIGH");
});

test("comparison reports no change when identical", () => {
  const cmp = buildPriorComparison(base, { ...base, date: "2026-06-20T00:00:00.000Z" });
  assert.equal(cmp.anyChanged, false);
});
