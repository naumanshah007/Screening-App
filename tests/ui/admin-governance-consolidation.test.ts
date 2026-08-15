/**
 * Admin consolidation and governance wording.
 *
 * THREE DEFECTS THESE LOCK
 * ------------------------
 * 1. Two user-management surfaces. /admin duplicated /admin/users with
 *    different controls, so the same actions existed in two places.
 * 2. "Production authority: CANONICAL" rendered beside "Clinical cards 0/16",
 *    inviting the reading that hospital production governance was complete.
 * 3. A page of authoritative-looking COL/GYN rule releases with no context,
 *    which could read as a competing national clinical authority.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const ADMIN = read("app/(app)/admin/page.tsx");
const USERS_PAGE = read("app/(app)/admin/users/page.tsx");
const USERS_CLIENT = read("app/(app)/admin/users/AdminUsersClient.tsx");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const GOVERNANCE = read("app/(app)/governance/clinical/page.tsx");
const LOCAL_RULES = read("app/(app)/rules/page.tsx");

test("user management exists in exactly one place", () => {
  assert.doesNotMatch(
    ADMIN,
    /<UserAccessManager/,
    "/admin must not render a second user-management surface"
  );
  assert.doesNotMatch(
    ADMIN,
    /<CreateUserForm/,
    "/admin must not render a second user-creation surface"
  );
  assert.match(
    ADMIN,
    /href="\/admin\/users"/,
    "/admin must point at the single Users & Access surface"
  );
  assert.match(
    USERS_CLIENT,
    /Reset password/,
    "the single surface must retain account management controls"
  );
});

test("the sidebar points Users & Access at the consolidated page", () => {
  assert.match(SIDEBAR, /authed\("\/admin\/users", "Users & Access"\)/);
});

test("/admin keeps its distinct purpose and stays reachable", () => {
  // It still holds security incidents, integration validation and NCSR
  // certification. Removing it from navigation without a replacement entry
  // would have orphaned that content.
  assert.match(
    SIDEBAR,
    /authed\("\/admin", "System Operations"\)/,
    "/admin must remain reachable for its non-user-management content"
  );
  for (const panel of [
    "SecurityIncidentManager",
    "IntegrationValidationManager",
    "NcsrCertificationManager",
  ]) {
    assert.ok(ADMIN.includes(panel), `/admin must retain ${panel}`);
  }
});

test("2FA status is stated once, not as a badge on every demo row", () => {
  assert.match(
    USERS_PAGE,
    /Two-factor authentication enforcement is disabled/,
    "the demo environment must state its 2FA policy at page level"
  );
  assert.match(
    USERS_PAGE,
    /\{demoMode && \(/,
    "the notice must be conditional on demo mode, not always shown"
  );
  assert.doesNotMatch(
    USERS_CLIENT,
    /2FA gap/,
    "per-row 2FA gap badges must not appear on the consolidated surface"
  );
});

test("governance separates environment authority from production readiness", () => {
  assert.doesNotMatch(
    GOVERNANCE,
    /Production authority: \{authority\.authorityEngine\}/,
    "the conflated production-authority badge must be gone"
  );
  assert.match(
    GOVERNANCE,
    /Production governance/,
    "production readiness must be its own labelled block"
  );
  assert.match(
    GOVERNANCE,
    /const productionGovernanceStatus = productionGovernanceComplete/,
    "readiness must state whether independent governance is complete"
  );
  assert.match(
    GOVERNANCE,
    /const environmentLabel =/,
    "the authority block must name the environment it applies to"
  );
  assert.match(
    GOVERNANCE,
    /Current governed rules/,
    "the environment-specific current rules must remain distinct from production governance"
  );
});

test("local rules are presented as an operational overlay", () => {
  assert.match(LOCAL_RULES, /title="Local Referral & Booking Rules"/);
  assert.match(LOCAL_RULES, /Local operational rules/);
  assert.match(
    LOCAL_RULES,
    /do\s*\n?\s*not replace the current governed NCSP screening rules/,
    "the overlay must disclaim replacing the governed screening rules"
  );
  assert.match(
    LOCAL_RULES,
    /Current governed screening rules/,
    "the governed ruleset must be named alongside the local rules"
  );
});

test("draft authoring is demoted and permission-gated", () => {
  assert.match(
    LOCAL_RULES,
    /\{canAuthorDrafts && \(/,
    "draft creation must be gated"
  );
  assert.match(
    LOCAL_RULES,
    /DrawerDisclosure title="Advanced actions"/,
    "draft creation must not sit in the primary page header"
  );
  // Entitlement follows the existing page roles rather than a new permission.
  assert.match(
    LOCAL_RULES,
    /user\?\.role === "ADMIN" \|\| user\?\.role === "INTEGRATION_ADMIN"/,
    "draft authoring must reuse existing role entitlement"
  );
});
