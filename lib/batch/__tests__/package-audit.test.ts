import test from "node:test";
import assert from "node:assert/strict";

import { buildDecisionPackageAuditPayload } from "@/lib/decisions/package-audit";

test("decision package audit payload includes evidence fields and safety labels", () => {
  const payload = buildDecisionPackageAuditPayload({
    action: "SIMULATED_PACKAGE_EXPORT",
    actorUserId: "user-1",
    batchReviewItemId: "item-1",
    batchRunId: "run-1",
    disposition: "ACCEPTED",
    format: "fhir",
    timestamp: "2026-06-19T03:00:00.000Z",
  });

  assert.deepEqual(payload, {
    eventLabel: "Simulated export package download",
    packageLabel: "Integration-ready preview",
    simulated: true,
    safetyNotice: "Simulated handoff. Not for direct clinical action.",
    actorUserId: "user-1",
    batchReviewItemId: "item-1",
    batchRunId: "run-1",
    format: "fhir",
    disposition: "ACCEPTED",
    timestamp: "2026-06-19T03:00:00.000Z",
  });
});
