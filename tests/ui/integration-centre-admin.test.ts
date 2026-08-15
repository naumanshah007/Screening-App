import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const PAGE = read("app/(app)/admin/integrations/page.tsx");
const CLIENT = read("components/integrations/IntegrationCentreClient.tsx");
const CONNECTIONS = read("lib/integrations/connections.ts");
const VALIDATION = read("lib/integrations/connection-validation.ts");
const SCHEMA = read("lib/integrations/connection-schema.ts");
const SECRET_PROVIDER = read("lib/integrations/secret-provider.ts");
const CONNECTIVITY = read("lib/integrations/connectivity-test.ts");
const CONNECTIVITY_CHECKS = read("lib/integrations/connectivity-checks.ts");
const OUTBOUND_POLICY = read("lib/integrations/outbound-policy.ts");
const OUTBOUND_HTTP = read("lib/integrations/outbound-http.ts");
const LIVE_TEST_ROUTE = read("app/api/admin/integrations/[id]/live-test/route.ts");
const PERMISSIONS = read("lib/auth/permissions.ts");
const API_ROUTES = [
  "app/api/admin/integrations/route.ts",
  "app/api/admin/integrations/[id]/route.ts",
  "app/api/admin/integrations/[id]/validate/route.ts",
  "app/api/admin/integrations/[id]/live-test/route.ts",
  "app/api/admin/integrations/[id]/state/route.ts",
].map(read).join("\n");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const BATCH_PANEL = read("components/batch/IntegrationReadinessPanel.tsx");
const MIGRATION = read("prisma/migrations/20260815131500_integration_connections/migration.sql");
const CONNECTIVITY_MIGRATION = read("prisma/migrations/20260815144000_integration_connectivity_checks/migration.sql");

test("Integration Centre uses the existing ADMIN and INTEGRATION_ADMIN permission boundary", () => {
  const integrationGuard = PERMISSIONS.indexOf('prefix: "/admin/integrations"');
  const broadAdminGuard = PERMISSIONS.indexOf('prefix: "/admin",');
  assert.ok(integrationGuard > -1 && integrationGuard < broadAdminGuard);
  assert.match(
    PERMISSIONS.slice(integrationGuard, broadAdminGuard),
    /requiredRoles: \["ADMIN", "INTEGRATION_ADMIN"\]/
  );
  assert.match(PAGE, /isAuthorizedForRoute\("\/admin\/integrations", user\?\.role\)/);
  assert.match(SIDEBAR, /authed\("\/admin\/integrations", "Integration Centre"\)/);
  assert.match(API_ROUTES, /getApiPermissionError\(user, "admin:settings"\)/);
  assert.doesNotMatch(PERMISSIONS, /integration:configure/, "Phase 3A must reuse existing privileges");

  const roles = PERMISSIONS.slice(PERMISSIONS.indexOf("const ROLE_PERMISSIONS"));
  for (const role of ["SMO_REVIEWER", "COLPOSCOPIST", "COLPO_CNS", "GYNAE_GRADER", "COORDINATOR", "GP"]) {
    const start = roles.indexOf(`${role}: [`);
    const end = roles.indexOf("],", start);
    assert.doesNotMatch(roles.slice(start, end), /admin:settings/, `${role} must not configure connectors`);
  }
});

test("the wizard contains all six guided stages and connector-specific coverage", () => {
  for (const label of [
    "Connection",
    "Authentication",
    "Mapping",
    "Validate Configuration",
    "Schedule",
    "Readiness",
  ]) {
    assert.ok(CLIENT.includes(`"${label}"`), `missing wizard step ${label}`);
  }
  for (const type of ["HL7_V2_LAB", "FHIR_R4", "PMS_REST", "SCREENING_REGISTER"]) {
    assert.ok(CLIENT.includes(type), `missing connector-specific UI for ${type}`);
    assert.ok(VALIDATION.includes(type), `missing connector-specific validation for ${type}`);
  }
  assert.match(CLIENT, /setReport\(null\);[\s\S]*Configuration metadata saved/);
  assert.match(CLIENT, /<Button onClick=\{\(\) => setWizardOpen\(false\)\} disabled=\{busy\}>Finish<\/Button>/);
  assert.match(CLIENT, /aria-label=\{`\$\{requirement\.label\} source mapping`\}/);
});

test("configuration validation never claims or attempts live connectivity", () => {
  const phase3Ui = `${PAGE}\n${CLIENT}\n${VALIDATION}`;
  assert.doesNotMatch(phase3Ui, /\bConnected\b|Connection successful|\bOnline\b/);
  assert.doesNotMatch(phase3Ui, /Test Connection/);
  assert.match(phase3Ui, /Validate Configuration/);
  assert.match(phase3Ui, /Live connectivity/);
  assert.match(phase3Ui, /Not tested/);
  assert.match(phase3Ui, /no remote request/i);
  assert.doesNotMatch(VALIDATION, /fetch\(|axios|createConnection|net\.|tls\.|WebSocket/);
});

test("HL7 configuration is truthful about the required external gateway", () => {
  assert.match(CLIENT, /Gateway required \/ Not receiving/);
  assert.match(CLIENT, /Vercel cannot host a persistent MLLP listener/);
  assert.match(VALIDATION, /GATEWAY_MANAGED/);
  assert.doesNotMatch(CLIENT, /new Server|createServer|listen\(/);
});

test("credential values cannot enter typed metadata or client responses", () => {
  assert.match(SCHEMA, /secretReferenceSchema/);
  assert.match(SCHEMA, /Use a provider reference, not a credential value/);
  assert.match(SECRET_PROVIDER, /describe\(ref/);
  assert.match(SECRET_PROVIDER, /resolve\(ref/);
  assert.match(SECRET_PROVIDER, /Environment variable/);
  assert.doesNotMatch(CLIENT, /Show credential|showCredential/);
  const dto = CONNECTIONS.slice(
    CONNECTIONS.indexOf("export type IntegrationConnectionDto"),
    CONNECTIONS.indexOf("export type IntegrationDashboard")
  );
  assert.doesNotMatch(dto, /credentialRef:/);
  assert.match(dto, /credentialConfigured: boolean/);
});

test("audit serialization is allow-listed and does not dump connection objects", () => {
  assert.match(CONNECTIONS, /safeIntegrationAuditDetails/);
  assert.doesNotMatch(CONNECTIONS, /newValue: JSON\.stringify\((row|connection|existing|args\.input)\)/);
  assert.match(CONNECTIONS, /INTEGRATION_MAPPING_UPDATED/);
  assert.match(CONNECTIONS, /INTEGRATION_SCHEDULE_UPDATED/);
  assert.match(CONNECTIONS, /INTEGRATION_CREDENTIAL_REFERENCE_REPLACED/);
  assert.match(CONNECTIONS, /INTEGRATION_CONFIGURATION_VALIDATED/);
  assert.doesNotMatch(CONNECTIONS, /credentialRef: details|certificateRef: details/);
});

test("the state machine has no ACTIVE transition and readiness is explicit", () => {
  const states = CONNECTIONS.slice(
    CONNECTIONS.indexOf("INTEGRATION_CONNECTION_STATES"),
    CONNECTIONS.indexOf("export type IntegrationConnectionState")
  );
  assert.doesNotMatch(states, /"ACTIVE"/);
  assert.match(states, /"READY_FOR_LIVE_TEST"/);
  assert.match(VALIDATION, /readyForLiveTest/);
  assert.match(CLIENT, /Activation[\s\S]*Not active/);
});

test("Pull Cases is an operational summary with one admin configuration surface", () => {
  assert.match(BATCH_PANEL, /operational intake context only/i);
  assert.match(BATCH_PANEL, /href="\/admin\/integrations"/);
  assert.match(BATCH_PANEL, /canConfigure/);
  assert.doesNotMatch(BATCH_PANEL, /input|select|credentialRef|mappingJson/);
});

test("the migration is additive and leaves clinical and usage evidence untouched", () => {
  assert.match(MIGRATION, /CREATE TABLE "IntegrationConnection"/);
  assert.doesNotMatch(
    MIGRATION,
    /(^|\n)\s*(DROP TABLE|ALTER TABLE|DELETE FROM|UPDATE )/m
  );
  assert.doesNotMatch(
    MIGRATION,
    /RuleEvaluation|CaseAuthorityPin|UsageEvent|UsageEventCorrection|ClinicalRule|ScreeningEpisode/
  );
  assert.doesNotMatch(
    `${CONNECTIONS}\n${VALIDATION}`,
    /evaluateClinicalCase|recordUsageEvent|UsageEventCorrection|CaseAuthorityPin/
  );
});

test("Phase 3B keeps configuration validation and live testing separate", () => {
  assert.match(CLIENT, />Validate Configuration<\/Button>/);
  assert.match(CLIENT, />Test Live Connection<\/Button>/);
  assert.match(CLIENT, /liveTestAvailable/);
  assert.match(CLIENT, /Live connectivity history/);
  assert.match(CLIENT, /Last live test/);
  assert.match(CLIENT, /Not active/);
  assert.match(CLIENT, /A live pass proves connectivity only/);
  assert.doesNotMatch(CLIENT, /Ready for activation[^\n]*YES/);
  assert.doesNotMatch(CONNECTIVITY_CHECKS, /state:\s*"ACTIVE"|lastSuccessfulImportAt:\s*/);
});

test("live test routing uses the existing admin boundary and ordinary clinicians remain excluded", () => {
  assert.match(LIVE_TEST_ROUTE, /runStoredConnectivityCheck/);
  assert.match(LIVE_TEST_ROUTE, /getApiPermissionError\(user, "admin:settings"\)/);
  assert.match(LIVE_TEST_ROUTE, /requireCurrentOrganisation/);
  assert.match(CONNECTIVITY_CHECKS, /integrationConnection\.findFirst/);
  assert.match(CONNECTIVITY_CHECKS, /organisationId: args\.organisationId/);
});

test("outbound connectivity is bounded, DNS-pinned and redirect-revalidated", () => {
  assert.match(OUTBOUND_POLICY, /dns\.lookup/);
  assert.match(OUTBOUND_POLICY, /isNonPublicAddress/);
  assert.match(OUTBOUND_POLICY, /EMBEDDED_CREDENTIALS/);
  assert.match(OUTBOUND_POLICY, /UNSUPPORTED_SCHEME/);
  assert.match(OUTBOUND_HTTP, /pinnedLookup/);
  assert.match(OUTBOUND_HTTP, /maxResponseBytes/);
  assert.match(OUTBOUND_HTTP, /connectTimeoutMs/);
  assert.match(OUTBOUND_HTTP, /totalTimeoutMs/);
  assert.match(OUTBOUND_HTTP, /withoutCrossOriginCredentials/);
  assert.match(OUTBOUND_HTTP, /approveOutboundUrl\(currentUrl/);
});

test("connector boundaries are truthful and no secret material enters the client DTO", () => {
  assert.match(CONNECTIVITY, /CapabilityStatement/);
  assert.match(CONNECTIVITY, /DiagnosticReport/);
  assert.match(CONNECTIVITY, /Observation/);
  assert.match(CONNECTIVITY, /API-specific capability[\s\S]*NOT_VERIFIED/);
  assert.match(CONNECTIVITY, /Awaiting authorised endpoint \/ integration contract/);
  assert.match(CONNECTIVITY, /Live MLLP receiver testing is unavailable/);
  assert.match(CONNECTIVITY, /live mTLS testing is not supported/);
  assert.doesNotMatch(CLIENT, /accessToken|secretValue|resolved\.value/);
  assert.doesNotMatch(CONNECTIVITY_CHECKS, /Authorization|access_token|client_secret|resolved\.value/);
});

test("connectivity evidence migration is additive and append-only", () => {
  assert.match(CONNECTIVITY_MIGRATION, /CREATE TABLE "IntegrationConnectivityCheck"/);
  assert.match(CONNECTIVITY_MIGRATION, /BEFORE UPDATE/);
  assert.match(CONNECTIVITY_MIGRATION, /BEFORE DELETE/);
  assert.doesNotMatch(CONNECTIVITY_MIGRATION, /(^|\n)\s*(DROP TABLE|ALTER TABLE|DELETE FROM|UPDATE )/m);
  assert.doesNotMatch(CONNECTIVITY_MIGRATION, /BatchRun|BatchReviewItem|ScreeningEpisode|EpisodeObservation|RuleEvaluation|UsageEvent/);
});
