import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission, isAuthorizedForRoute } from "@/lib/auth/permissions";
import { canAccessWizardSession, canUseManualPathway } from "@/lib/wizard/access";

test("GP cannot browse the patient registry or manual pathway", () => {
  assert.equal(isAuthorizedForRoute("/patients", "GP"), false);
  assert.equal(isAuthorizedForRoute("/pathway", "GP"), false);
  assert.equal(hasPermission("GP", "patients:view"), false);
  assert.equal(canUseManualPathway({ id: "gp-1", role: "GP" }), false);
});

test("clinical pathway users can access only their own wizard session", () => {
  const user = { id: "clinician-1", role: "COLPOSCOPIST" };
  assert.equal(canUseManualPathway(user), true);
  assert.equal(canAccessWizardSession(user, "clinician-1"), true);
  assert.equal(canAccessWizardSession(user, "clinician-2"), false);
});

test("administrator may recover another user's wizard session", () => {
  assert.equal(
    canAccessWizardSession({ id: "admin-1", role: "ADMIN" }, "clinician-1"),
    true
  );
});
