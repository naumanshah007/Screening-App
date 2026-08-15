import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const PAGE = read("app/(app)/admin/usage/page.tsx");
const EXPORT = read("app/api/admin/usage/export/route.ts");
const PERMISSIONS = read("lib/auth/permissions.ts");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const ACTIVITY = read("lib/usage/usage-activity.ts");

test("Usage & Activity is ADMIN-only through the shared route guard", () => {
  const usageGuard = PERMISSIONS.indexOf('prefix: "/admin/usage"');
  const adminGuard = PERMISSIONS.indexOf('prefix: "/admin",');
  assert.ok(usageGuard > -1 && usageGuard < adminGuard);
  assert.match(PERMISSIONS.slice(usageGuard, adminGuard), /requiredRoles: \["ADMIN"\]/);
  assert.match(PAGE, /isAuthorizedForRoute\("\/admin\/usage", user\?\.role\)/);
  assert.match(EXPORT, /isAuthorizedForRoute\("\/admin\/usage", user\?\.role\)/);
  assert.match(SIDEBAR, /authed\("\/admin\/usage", "Usage & Activity"\)/);
});

test("the normal table and metrics are explicitly correction-aware", () => {
  assert.match(ACTIVITY, /const effectiveCondition = Prisma\.sql/);
  assert.match(ACTIVITY, /correction\."correctionType" = 'INVALIDATE'/);
  assert.match(PAGE, /Usage basis[\s\S]*Effective events/);
  assert.match(PAGE, /Corrected events never appear in this table/);
});

test("raw correction evidence and all three integrity invariants remain visible", () => {
  assert.match(PAGE, /Invalidated events remain preserved in the immutable audit history/);
  assert.match(PAGE, /Historical correction evidence/);
  assert.match(PAGE, /Uncorrected invalid usage events/);
  assert.match(PAGE, /Orphan episode observations/);
  assert.match(PAGE, /Duplicate FIRST_TRIAGE groups/);
});

test("the UI uses the real ledger vocabulary with friendly labels", () => {
  for (const eventType of [
    "FIRST_TRIAGE",
    "UPDATE_REEVALUATION",
    "REGRADE",
    "DUPLICATE_SUPPRESSED",
  ]) {
    assert.ok(ACTIVITY.includes(eventType));
  }
  for (const label of [
    "First triage",
    "Updated result",
    "Manual re-evaluation",
    "Duplicate not reprocessed",
  ]) {
    assert.ok(ACTIVITY.includes(label));
  }
});

test("operational export excludes clinical payloads and commercial fields", () => {
  for (const forbidden of [
    "patientName",
    "nhi",
    "canonicalInputSnapshot",
    "decisionJson",
    "idempotencyKey",
    "Price per case",
    "Invoice amount",
    "Revenue",
  ]) {
    assert.ok(!EXPORT.includes(forbidden), `${forbidden} must not appear in the operational export`);
  }
  assert.match(EXPORT, /listUsageActivity/);
  assert.match(EXPORT, /text\/csv/);
});

test("the read model contains no clinical evaluator or decision mutation", () => {
  assert.doesNotMatch(
    ACTIVITY,
    /evaluateClinicalCase|evaluateGradedDecision|recordUsageEvent\(|recommendationCode|riskLevel/
  );
});
