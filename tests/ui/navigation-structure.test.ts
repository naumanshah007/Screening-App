/**
 * Sidebar structure and terminology.
 *
 * The sidebar exposed engineering areas to clinicians and used internal
 * vocabulary ("Operational Analytics", "Rule Governance", "Pilot Readiness",
 * "Clinical Governance & Activation"). Guidelines sat under Configuration, as
 * though clinical reference material were a setting.
 *
 * The safety-relevant property here is that hiding is never granting: every
 * item is still gated by isAuthorizedForRoute, which reads the same ROUTE_GUARDS
 * the server enforces. A test that only checked labels would miss that.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SIDEBAR = readFileSync(
  join(ROOT, "components", "layout", "Sidebar.tsx"),
  "utf8"
);
const PERMISSIONS = readFileSync(
  join(ROOT, "lib", "auth", "permissions.ts"),
  "utf8"
);

test("navigation uses the four product sections", () => {
  for (const label of ["Workspace", "Insights", "Administration", "Advanced"]) {
    assert.match(
      SIDEBAR,
      new RegExp(`label: "${label}"`),
      `missing navigation section: ${label}`
    );
  }
  // The old engineering-flavoured groupings are gone.
  assert.doesNotMatch(SIDEBAR, /label: "Oversight"/);
  assert.doesNotMatch(SIDEBAR, /label: "Configuration"/);
});

test("Guidelines sits in the clinical workspace", () => {
  const workspace = SIDEBAR.slice(
    SIDEBAR.indexOf("const workspace = ["),
    SIDEBAR.indexOf("const insights = [")
  );
  assert.match(
    workspace,
    /link\("\/guidelines", "Guidelines"\)/,
    "Guidelines is clinical reference material, not configuration"
  );
});

test("clinician-facing labels replace internal vocabulary", () => {
  for (const [label, retired] of [
    ['"Analytics"', "Operational Analytics"],
    ['"Users & Access"', null],
    ['"Governance"', "Clinical Governance & Activation"],
    ['"Local Referral & Booking Rules"', "Rule Governance"],
    ['"Deployment Readiness"', "Pilot Readiness"],
  ] as [string, string | null][]) {
    assert.ok(SIDEBAR.includes(label), `missing label ${label}`);
    if (retired) {
      assert.ok(
        !SIDEBAR.includes(`"${retired}"`),
        `retired label still present: ${retired}`
      );
    }
  }
});

test("Advanced is collapsible and technical items live there", () => {
  assert.match(
    SIDEBAR,
    /label: "Advanced", links: advanced, collapsible: true/,
    "Advanced must be collapsed by default"
  );
  const advancedStart = SIDEBAR.indexOf("const advanced = [");
  const advanced = SIDEBAR.slice(
    advancedStart,
    SIDEBAR.indexOf("return [", advancedStart)
  );
  for (const item of [
    "Local Referral & Booking Rules",
    "Rule Studio",
    "Deployment Readiness",
  ]) {
    assert.ok(advanced.includes(item), `${item} belongs under Advanced`);
  }
});

test("a section with no links is not rendered", () => {
  // Prevents an empty "Advanced" heading for roles with no technical pages.
  for (const name of ["insights", "administration", "advanced"]) {
    assert.match(
      SIDEBAR,
      new RegExp(`\\.\\.\\.\\(${name}\\.length`),
      `${name} must only render when it has links`
    );
  }
});

test("hiding an item never grants access", () => {
  // Every entitlement-bearing item resolves through isAuthorizedForRoute, which
  // reads ROUTE_GUARDS — the same source the server enforces.
  assert.match(
    SIDEBAR,
    /function authed\(href: string, label: string\): NavLink\[\] \{\s*return isAuthorizedForRoute\(href, userRole\)/,
    "sidebar entitlement must derive from the shared route guards"
  );
  assert.match(
    SIDEBAR,
    /isAuthorizedForRoute\("\/admin", userRole\)/,
    "Users & Access must be gated by the /admin guard"
  );
  // /admin/users is covered by the /admin prefix guard server-side.
  assert.match(
    PERMISSIONS,
    /prefix: "\/admin"/,
    "the /admin prefix guard must exist so /admin/users stays protected"
  );
});
