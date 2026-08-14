/**
 * The Manage user drawer.
 *
 * WHAT THIS REPLACED
 * ------------------
 * Each row carried three competing buttons — Reset password, Reset to demo,
 * Disable — which gave the riskiest action the same weight as the routine one
 * and left no room for role change, unlock, authenticator reset or account
 * history. Live QA confirmed there was no drawer at all: §2 asked to verify one
 * that did not exist.
 *
 * The four sections answer four different questions, so they are asserted
 * separately: who is this (User), what may they do (Access), what state are
 * their credentials in (Security), and what has been done to the account
 * (Audit).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const CLIENT = read("app/(app)/admin/users/AdminUsersClient.tsx");
const AUDIT_ROUTE = read("app/api/admin/users/[id]/audit/route.ts");
const MANAGEMENT = read("lib/admin/user-management.ts");

test("each row has one entry point, not competing actions", () => {
  assert.match(CLIENT, /onClick=\{\(\) => openManage\(user\)\}/);
  assert.match(CLIENT, /Manage\s*\n?\s*<\/Button>/);
  // The destructive control must no longer sit inline in the table.
  assert.doesNotMatch(
    CLIENT,
    /onClick=\{\(\) => toggleEnabled\(user\)\}/,
    "disable must not be a bare row button"
  );
});

test("the drawer has the four required sections", () => {
  for (const title of ["User", "Access", "Security", "Audit"]) {
    assert.match(
      CLIENT,
      new RegExp(`<DrawerSection title="${title}">`),
      `missing drawer section: ${title}`
    );
  }
});

test("Access exposes role change and enable/disable", () => {
  assert.match(CLIENT, /submitRoleChange/, "role change must be wired");
  assert.match(
    CLIENT,
    /disabled=\{busy \|\| pendingRole === manageUser\.role\}/,
    "Save role must be inert until the role actually differs"
  );
  assert.match(
    CLIENT,
    /manageUser\.id === currentUserId/,
    "an administrator must not be able to disable their own account"
  );
  assert.match(
    CLIENT,
    /You cannot disable your own account/,
    "the disabled control must explain why it is disabled"
  );
});

test("Security exposes the credential controls with honest state", () => {
  assert.match(CLIENT, /Reset password/);
  assert.match(CLIENT, /Reset to demo password/);
  assert.match(CLIENT, /Reset authenticator/);
  assert.match(
    CLIENT,
    /disabled=\{busy \|\| !manageUser\.lockedUntil\}/,
    "Unlock must be inert when the account is not locked"
  );
  assert.match(
    CLIENT,
    /This account is not locked/,
    "the inert Unlock control must say why"
  );
  // Demo 2FA is genuinely not enforced; the drawer must not imply otherwise.
  assert.match(
    CLIENT,
    /Two-factor enforcement is disabled for demonstration/,
    "resetting an authenticator in demo mode must state it has no effect"
  );
});

test("the drawer reads live rows rather than a snapshot", () => {
  // A copy taken at open time would show pre-change state behind a table that
  // had already refreshed.
  assert.match(
    CLIENT,
    /const manageUser = users\.find\(\(row\) => row\.id === manageId\) \?\? null/
  );
});

test("account history is read-only and comes from the immutable log", () => {
  assert.match(AUDIT_ROUTE, /export async function GET/);
  assert.doesNotMatch(
    AUDIT_ROUTE,
    /export async function (POST|PATCH|PUT|DELETE)/,
    "the history endpoint must not mutate anything"
  );
  assert.match(
    AUDIT_ROUTE,
    /getApiPermissionError\(user, "admin:users"\)/,
    "history must require the same permission as the actions"
  );
  assert.match(
    MANAGEMENT,
    /where: \{ entity: "User", entityId: targetUserId \}/,
    "history must read the same rows buildUserAuditEntry writes"
  );
});

test("no credential material is selected into the history payload", () => {
  const start = MANAGEMENT.indexOf("export async function listUserAccountAudit");
  const body = MANAGEMENT.slice(start, MANAGEMENT.indexOf("export async function createUserAccount"));
  for (const forbidden of ["password", "passwordHash", "twoFactorSecret", "token"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`, "i").test(body),
      `history must not select ${forbidden}`
    );
  }
});
