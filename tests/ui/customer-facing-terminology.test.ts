import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const INTEGRATION_PAGE = read("app/(app)/admin/integrations/page.tsx");
const INTEGRATION_CLIENT = read("components/integrations/IntegrationCentreClient.tsx");
const CONNECTION_SCHEMA = read("lib/integrations/connection-schema.ts");
const CONNECTIONS = read("lib/integrations/connections.ts");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const RULESET_STATUS = read("components/dashboard/RulesetStatusPanel.tsx");
const GUIDELINE_PATHWAY = read("app/(app)/guidelines/[pathway]/page.tsx");

test("Integration Centre uses the customer connectivity vocabulary", () => {
  for (const label of [
    "Configured connections",
    "Ready to test",
    "Recently verified",
    "Needs attention",
    "Integration health",
    "Last connection test",
    "Connection test",
    "Data ingestion",
    "Not enabled",
  ]) {
    assert.match(INTEGRATION_CLIENT, new RegExp(label));
  }

  for (const retired of [
    "Ready for live test",
    "Test Live Connection",
    "Last live test",
    "Live test result",
    "Live connectivity not tested",
    "Live connectivity failures",
    "Readiness health",
  ]) {
    assert.doesNotMatch(INTEGRATION_CLIENT, new RegExp(retired, "i"));
  }
  assert.doesNotMatch(INTEGRATION_PAGE, /label="Phase"/);
});

test("environment presentation is Demo, Test or Pilot without changing stored metadata", () => {
  assert.match(INTEGRATION_CLIENT, /<option value="DEMO">Demo<\/option>/);
  assert.match(INTEGRATION_CLIENT, /<option value="TEST">Test<\/option>/);
  assert.match(INTEGRATION_CLIENT, /<option value="PRODUCTION_LIKE">Pilot<\/option>/);
  assert.doesNotMatch(INTEGRATION_CLIENT, />Production-like</i);

  // The internal stored value is intentionally retained: this cleanup must not
  // alter the data model or rewrite immutable audit evidence.
  assert.match(CONNECTION_SCHEMA, /"PRODUCTION_LIKE"/);
});

test("validation connections are demoted without losing their evidence access", () => {
  assert.match(INTEGRATION_CLIENT, /<details[\s\S]*Test &amp; validation connections/);
  assert.match(INTEGRATION_CLIENT, /Outbound Security Validation/);
  assert.match(INTEGRATION_CLIENT, /FHIR R4 Test Connection/);
  assert.match(INTEGRATION_CLIENT, /Awanui Labs — Demo HL7/);
  assert.match(INTEGRATION_CLIENT, /Connection history/);
  assert.match(INTEGRATION_CLIENT, /Audit evidence/);
});

test("normal application chrome avoids unnecessary legacy architecture labels", () => {
  assert.doesNotMatch(SIDEBAR, /Legacy Referral Queue/);
  assert.doesNotMatch(RULESET_STATUS, /"Legacy Engine"/);
  assert.doesNotMatch(RULESET_STATUS, /Pathway routing: Legacy router/);
  assert.doesNotMatch(RULESET_STATUS, /"Canonical shadow"/);
  assert.match(GUIDELINE_PATHWAY, /presentation="clinical"/);
});

test("terminology cleanup leaves the connector state machine unchanged", () => {
  assert.match(CONNECTIONS, /"READY_FOR_LIVE_TEST"/);
  assert.doesNotMatch(
    CONNECTIONS.slice(
      CONNECTIONS.indexOf("INTEGRATION_CONNECTION_STATES"),
      CONNECTIONS.indexOf("export type IntegrationConnectionState")
    ),
    /"ACTIVE"/
  );
});
