import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompletedDecisionForUserWhere,
  buildCompletedDecisionWhere,
  buildUrgencyWhere,
  getCompletedDecisionAccess,
} from "@/lib/decisions/completed-decisions";

test("completed decisions access grants all-scope roles", () => {
  assert.equal(getCompletedDecisionAccess({ id: "admin-1", role: "ADMIN" }), "all");
  assert.equal(getCompletedDecisionAccess({ id: "coord-1", role: "COORDINATOR" }), "all");
  assert.equal(getCompletedDecisionAccess({ id: "int-1", role: "INTEGRATION_ADMIN" }), "all");
});

test("completed decisions access scopes clinical reviewers to their own decisions", () => {
  assert.equal(getCompletedDecisionAccess({ id: "smo-1", role: "SMO_REVIEWER" }), "own");
  assert.equal(getCompletedDecisionAccess({ id: "colpo-1", role: "COLPOSCOPIST" }), "own");
  assert.equal(getCompletedDecisionAccess({ id: "cns-1", role: "COLPO_CNS" }), "own");
  assert.equal(getCompletedDecisionAccess({ id: "gynae-1", role: "GYNAE_GRADER" }), "own");
});

test("completed decisions access excludes GP and missing user context", () => {
  assert.equal(getCompletedDecisionAccess({ id: "gp-1", role: "GP" }), "none");
  assert.equal(getCompletedDecisionAccess({ role: "SMO_REVIEWER" }), "none");
  assert.equal(getCompletedDecisionAccess({}), "none");
});

test("completed decision where clause filters to completed records", () => {
  const where = buildCompletedDecisionWhere({ id: "admin-1", role: "ADMIN" });
  assert.deepEqual(where, {
    disposition: { in: ["ACCEPTED", "REJECTED", "NEEDS_INFO"] },
  });
});

test("completed decision where clause applies reviewer own-scope", () => {
  const where = buildCompletedDecisionWhere({ id: "smo-1", role: "SMO_REVIEWER" });
  assert.deepEqual(where, {
    AND: [
      { disposition: { in: ["ACCEPTED", "REJECTED", "NEEDS_INFO"] } },
      { reviewedByUserId: "smo-1" },
    ],
  });
});

test("completed decision where clause uses no-access sentinel", () => {
  assert.deepEqual(buildCompletedDecisionWhere({ id: "gp-1", role: "GP" }), {
    id: "__no_completed_decision_access__",
  });
});

test("completed decision where clause ignores reviewer filter for own-scope users", () => {
  const where = buildCompletedDecisionWhere(
    { id: "smo-1", role: "SMO_REVIEWER" },
    { reviewerId: "other-reviewer" }
  );
  const text = JSON.stringify(where);

  assert.ok(text.includes("smo-1"));
  assert.equal(text.includes("other-reviewer"), false);
});

test("completed decision detail lookup preserves own-scope IDOR guard", () => {
  const where = buildCompletedDecisionForUserWhere("item-other-reviewer", {
    id: "smo-1",
    role: "SMO_REVIEWER",
  });

  assert.deepEqual(where, {
    AND: [
      {
        AND: [
          { disposition: { in: ["ACCEPTED", "REJECTED", "NEEDS_INFO"] } },
          { reviewedByUserId: "smo-1" },
        ],
      },
      { id: "item-other-reviewer" },
    ],
  });
});

test("completed decision where clause supports safe filters", () => {
  const where = buildCompletedDecisionWhere(
    { id: "admin-1", role: "ADMIN" },
    {
      disposition: "REJECTED",
      source: "HL7",
      reviewerId: "reviewer-1",
      urgency: "urgent",
      q: "ABC1234",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-19",
    }
  );
  const text = JSON.stringify(where);

  assert.ok(text.includes("REJECTED"));
  assert.ok(text.includes("HL7"));
  assert.ok(text.includes("reviewer-1"));
  assert.ok(text.includes("ABC1234"));
  assert.ok(text.includes("P1_HSC"));
});

test("urgency filters distinguish mandatory, urgent, and routine", () => {
  assert.deepEqual(buildUrgencyWhere("mandatory"), { reviewRequired: true });
  assert.deepEqual(buildUrgencyWhere("urgent"), {
    OR: [
      { riskLevel: "URGENT" },
      { referralPriority: { in: ["P1", "P1_HSC"] } },
    ],
  });
  assert.deepEqual(buildUrgencyWhere("routine"), {
    reviewRequired: false,
    NOT: [
      { riskLevel: "URGENT" },
      { referralPriority: { in: ["P1", "P1_HSC"] } },
    ],
  });
});
