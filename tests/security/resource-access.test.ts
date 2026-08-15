import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPatientScope,
  canAccessPatientObject,
  requirePermission,
  resolvePatientCreatePractice,
} from "@/lib/auth/resource-access";

test("integration administrators cannot read patient, case, batch, or decision data", () => {
  const actor = { id: "integration-1", role: "INTEGRATION_ADMIN" };
  for (const permission of [
    "patients:view",
    "cases:view",
    "batch:view",
    "decisions:view",
  ] as const) {
    assert.deepEqual(requirePermission(actor, permission), {
      status: 403,
      error: "Forbidden",
    });
  }
  assert.equal(requirePermission(actor, "audit:view"), null);
  assert.equal(requirePermission(actor, "integration:manage"), null);
});

test("GP patient reads are constrained to the authenticated practice", () => {
  const actor = { id: "gp-1", role: "GP", gpPracticeId: "practice-a" };
  assert.deepEqual(buildPatientScope(actor), { gpPracticeId: "practice-a" });
  assert.equal(
    canAccessPatientObject({ actor, patientGpPracticeId: "practice-a", permission: "patients:view" }),
    true
  );
  assert.equal(
    canAccessPatientObject({ actor, patientGpPracticeId: "practice-b", permission: "patients:view" }),
    false
  );
});

test("GP create cannot select a different practice", () => {
  const actor = { id: "gp-1", role: "GP", gpPracticeId: "practice-a" };
  assert.equal(
    resolvePatientCreatePractice({ actor, requestedGpPracticeId: "practice-a" }),
    "practice-a"
  );
  assert.equal(
    resolvePatientCreatePractice({ actor, requestedGpPracticeId: "practice-b" }),
    null
  );
});

test("missing user id is 401 while authenticated disallowed role is 403", () => {
  assert.deepEqual(requirePermission({ role: "ADMIN" }, "audit:view"), {
    status: 401,
    error: "Unauthorised",
  });
  assert.deepEqual(requirePermission({ id: "gp-1", role: "GP" }, "audit:view"), {
    status: 403,
    error: "Forbidden",
  });
});
