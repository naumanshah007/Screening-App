/** Phase 3A: organisation-scoped connector configuration and readiness. */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { applySchema, createIsolatedDatabase } from "../db/support/isolated-db";
import type { IntegrationConnectionInput } from "../../lib/integrations/connection-schema";

const database = createIsolatedDatabase("integration-connections");
const RUN = `INTEGRATION-${Date.now()}`;

type PrismaClient = typeof import("../../lib/prisma")["prisma"];
let prisma: PrismaClient;
let createIntegrationConnection: typeof import("../../lib/integrations/connections")["createIntegrationConnection"];
let updateIntegrationConnection: typeof import("../../lib/integrations/connections")["updateIntegrationConnection"];
let validateStoredIntegrationConnection: typeof import("../../lib/integrations/connections")["validateStoredIntegrationConnection"];
let changeIntegrationConnectionState: typeof import("../../lib/integrations/connections")["changeIntegrationConnectionState"];
let getIntegrationDashboard: typeof import("../../lib/integrations/connections")["getIntegrationDashboard"];
let validateIntegrationConfiguration: typeof import("../../lib/integrations/connection-validation")["validateIntegrationConfiguration"];
let INTEGRATION_CONNECTION_STATES: typeof import("../../lib/integrations/connections")["INTEGRATION_CONNECTION_STATES"];
let definitions: typeof import("../../lib/integrations/connection-catalogue")["INTEGRATION_CONNECTOR_DEFINITIONS"];

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({
    createIntegrationConnection,
    updateIntegrationConnection,
    validateStoredIntegrationConnection,
    changeIntegrationConnectionState,
    getIntegrationDashboard,
    INTEGRATION_CONNECTION_STATES,
  } = await import("../../lib/integrations/connections"));
  ({ validateIntegrationConfiguration } = await import(
    "../../lib/integrations/connection-validation"
  ));
  ({ INTEGRATION_CONNECTOR_DEFINITIONS: definitions } = await import(
    "../../lib/integrations/connection-catalogue"
  ));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

async function context(suffix: string) {
  const organisation = await prisma.organisation.create({
    data: { key: `${RUN}-${suffix}`.toLowerCase(), name: `Integration ${suffix}` },
  });
  const actor = await prisma.user.create({
    data: {
      email: `${RUN}-${suffix}@example.test`.toLowerCase(),
      name: `Integration actor ${suffix}`,
      role: "INTEGRATION_ADMIN",
    },
  });
  return { organisation, actor };
}

function mappings(type: string, complete = true) {
  const definition = definitions.find((item) => item.type === type)!;
  return Object.fromEntries(
    definition.mappingRequirements
      .slice(0, complete ? undefined : Math.max(0, definition.mappingRequirements.length - 1))
      .map((requirement) => [requirement.id, `source.${requirement.id}`])
  );
}

function baseInput(
  type: "HL7_V2_LAB" | "FHIR_R4" | "PMS_REST" | "SCREENING_REGISTER"
): IntegrationConnectionInput {
  const common = {
    connectorType: type,
    name: `${RUN} ${type}`,
    description: "Synthetic configuration example",
    sourceSystem: `${type} source`,
    sourceFacility: "Synthetic facility",
    environment: "DEMO" as const,
    mappingVersion: "demo-map-1",
    mapping: mappings(type),
    timezone: "Pacific/Auckland",
  };
  if (type === "HL7_V2_LAB") {
    return {
      ...common,
      endpoint: {
        host: "gateway.demo.internal",
        port: 2575,
        tlsMode: "MUTUAL_TLS",
        sendingApplication: "DEMO-LAB",
        sendingFacility: "DEMO-FACILITY",
        receivingApplication: "CERVIGRADE-GATEWAY",
        receivingFacility: "DEMO-RECEIVER",
        acceptedMessageTypes: ["ORU^R01"],
        duplicateIdentityStrategy: "accession + specimen + collection date",
      },
      authMethod: "MUTUAL_TLS" as const,
      certificateRef: "vault:certificates/demo-hl7",
      schedule: { cadence: "GATEWAY_MANAGED" as const },
    };
  }
  if (type === "FHIR_R4") {
    return {
      ...common,
      endpoint: {
        baseUrl: "https://fhir.example.test/r4",
        capabilityPath: "metadata",
        resourceTypes: ["DiagnosticReport", "Observation", "Patient"],
        identifierSystem: "https://standards.example.test/nhi",
        pagingStrategy: "Bundle next link",
        incrementalParameters: "_lastUpdated=gt{watermark}",
        oauthTokenUrl: "https://auth.example.test/oauth/token",
        oauthClientId: "demo-fhir-client",
      },
      authMethod: "OAUTH2_CLIENT_CREDENTIALS" as const,
      credentialRef: "vault:integrations/demo-fhir",
      schedule: { cadence: "HOURLY" as const, incrementalField: "_lastUpdated" },
    };
  }
  if (type === "PMS_REST") {
    return {
      ...common,
      endpoint: {
        baseUrl: "https://pms.example.test/api",
        organisationSite: "DEMO-SITE",
        pagingStrategy: "cursor",
        incrementalParameters: "updatedAt",
      },
      authMethod: "API_KEY" as const,
      credentialRef: "vault:integrations/demo-pms",
      schedule: { cadence: "DAILY" as const, timeOfDay: "02:30", incrementalField: "updatedAt" },
    };
  }
  return {
    ...common,
    endpoint: {
      baseUrl: "https://register.example.test/contract-endpoint",
      facilityOrganisationId: "DEMO-ORG",
      permittedOperations: ["CONTRACT_OPERATION_PLACEHOLDER"],
      screeningHistoryDepth: "Contract-defined",
      programmeIdentifier: "DEMO-PROGRAMME",
      agreementReference: "DEMO-MOU-REFERENCE",
      connectivityPath: "contract/capability",
      oauthTokenUrl: "https://auth.example.test/oauth/token",
      oauthClientId: "demo-register-client",
      nhiLookupEnabled: true,
      lookupStrategy: "On-demand lookup",
    },
    authMethod: "OAUTH2_CLIENT_CREDENTIALS" as const,
    credentialRef: "vault:integrations/demo-register",
    schedule: { cadence: "ON_DEMAND" as const, lookupStrategy: "On-demand lookup" },
  };
}

function validationSource(
  organisationId: string,
  input: ReturnType<typeof baseInput>
) {
  return {
    connectorType: input.connectorType,
    name: input.name,
    sourceSystem: input.sourceSystem,
    sourceFacility: input.sourceFacility ?? null,
    environment: input.environment,
    endpointJson: JSON.stringify(input.endpoint),
    authMethod: input.authMethod,
    credentialRef: "credentialRef" in input ? input.credentialRef ?? null : null,
    certificateRef: "certificateRef" in input ? input.certificateRef ?? null : null,
    mappingVersion: input.mappingVersion ?? null,
    mappingJson: JSON.stringify(input.mapping),
    scheduleJson: JSON.stringify(input.schedule),
    timezone: input.timezone,
    organisationId,
  };
}

test("catalogue types stay code-owned while instances are organisation-scoped rows", async () => {
  assert.deepEqual(
    definitions.map((item) => item.type),
    ["HL7_V2_LAB", "FHIR_R4", "PMS_REST", "SCREENING_REGISTER"]
  );
  assert.deepEqual(
    definitions.map((item) => item.catalogueId),
    ["hl7_v2", "fhir_r4", "pms", "health_nz"]
  );

  const a = await context("scope-a");
  const b = await context("scope-b");
  const created = await createIntegrationConnection({
    organisationId: a.organisation.id,
    actorUserId: a.actor.id,
    input: baseInput("FHIR_R4"),
  });
  assert.equal(created.connectorType, "FHIR_R4");
  assert.equal((await getIntegrationDashboard(a.organisation.id)).connections.length, 1);
  assert.equal((await getIntegrationDashboard(b.organisation.id)).connections.length, 0);

  await assert.rejects(
    updateIntegrationConnection({
      organisationId: b.organisation.id,
      connectionId: created.id,
      actorUserId: b.actor.id,
      input: { description: "Cross-tenant attempt" },
    }),
    /not found for this organisation/
  );
});

for (const type of ["HL7_V2_LAB", "FHIR_R4", "PMS_REST", "SCREENING_REGISTER"] as const) {
  test(`${type} connector-specific configuration validates without a remote request`, async () => {
    const ctx = await context(`validate-${type.toLowerCase()}`);
    const report = await validateIntegrationConfiguration(
      validationSource(ctx.organisation.id, baseInput(type))
    );
    assert.equal(report.status, "PASSED");
    assert.equal(report.readyForLiveTest, true);
    assert.equal(report.mappingComplete, report.mappingRequired);
    const connectivity = report.checks.find((check) => check.key === "connectivity")!;
    assert.equal(connectivity.status, "NOT_TESTED");
    assert.match(connectivity.detail, /no remote request/i);
    if (type === "HL7_V2_LAB") {
      assert.equal(connectivity.value, "Gateway required / Not receiving");
    } else {
      assert.equal(connectivity.value, "Not tested");
    }
  });
}

test("mapping completeness is derived from each connector's own requirements", async () => {
  const ctx = await context("mapping");
  const input = baseInput("PMS_REST");
  input.mapping = mappings("PMS_REST", false);
  const report = await validateIntegrationConfiguration(
    validationSource(ctx.organisation.id, input)
  );
  assert.equal(report.mappingRequired, 4);
  assert.equal(report.mappingComplete, 3);
  assert.equal(report.status, "WARNING");
  assert.equal(report.readyForLiveTest, false);
  assert.equal(report.checks.find((check) => check.key === "mapping")?.value, "3/4");
});

test("invalid schedules and missing credential references fail readiness truthfully", async () => {
  const ctx = await context("schedule-auth");
  const input = baseInput("FHIR_R4");
  input.credentialRef = undefined;
  input.schedule = { cadence: "DAILY", incrementalField: "_lastUpdated" };
  const report = await validateIntegrationConfiguration(
    validationSource(ctx.organisation.id, input)
  );
  assert.equal(report.status, "FAILED");
  assert.equal(report.readyForLiveTest, false);
  assert.equal(report.checks.find((check) => check.key === "authentication")?.status, "FAIL");
  assert.equal(report.checks.find((check) => check.key === "schedule")?.status, "FAIL");
});

test("credential references are stored server-side but never returned or audited as values", async () => {
  const ctx = await context("secret-metadata");
  const secretRef = "vault:integrations/reference-that-must-not-leak";
  const input = { ...baseInput("PMS_REST"), credentialRef: secretRef };
  const created = await createIntegrationConnection({
    organisationId: ctx.organisation.id,
    actorUserId: ctx.actor.id,
    input,
  });
  assert.equal(created.credentialConfigured, true);
  assert.equal("credentialRef" in created, false);
  assert.doesNotMatch(JSON.stringify(created), /reference-that-must-not-leak/);

  const stored = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(stored.credentialRef, secretRef);
  const audits = await prisma.auditLog.findMany({ where: { entityId: created.id } });
  assert.ok(audits.length > 0);
  assert.ok(audits.every((entry) => !entry.newValue?.includes(secretRef)));
  assert.ok(audits.every((entry) => !/password|token|apiKey|secretValue/i.test(entry.newValue ?? "")));
});

test("saving unchanged wizard metadata preserves validation and does not create audit noise", async () => {
  const ctx = await context("no-op-update");
  const input = baseInput("HL7_V2_LAB");
  const created = await createIntegrationConnection({
    organisationId: ctx.organisation.id,
    actorUserId: ctx.actor.id,
    input,
  });
  const validated = await validateStoredIntegrationConnection({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
  });
  const auditCount = await prisma.auditLog.count({ where: { entityId: created.id } });

  const unchanged = await updateIntegrationConnection({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    input,
  });

  assert.equal(validated.connection.state, "READY_FOR_LIVE_TEST");
  assert.equal(unchanged.state, "READY_FOR_LIVE_TEST");
  assert.equal(unchanged.lastValidationStatus, "PASSED");
  assert.equal(await prisma.auditLog.count({ where: { entityId: created.id } }), auditCount);
});

test("validation, pause, resume and archive use the explicit non-active state machine", async () => {
  assert.ok(!INTEGRATION_CONNECTION_STATES.includes("ACTIVE" as never));
  const ctx = await context("state-machine");
  const created = await createIntegrationConnection({
    organisationId: ctx.organisation.id,
    actorUserId: ctx.actor.id,
    input: baseInput("HL7_V2_LAB"),
  });
  const validated = await validateStoredIntegrationConnection({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    now: new Date("2026-08-15T00:00:00.000Z"),
  });
  assert.equal(validated.connection.state, "READY_FOR_LIVE_TEST");
  assert.equal(validated.report.checks.find((check) => check.key === "connectivity")?.status, "NOT_TESTED");

  const paused = await changeIntegrationConnectionState({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    action: "PAUSE",
  });
  assert.equal(paused.state, "PAUSED");
  const resumed = await changeIntegrationConnectionState({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    action: "RESUME",
  });
  assert.equal(resumed.state, "CONFIGURED", "resume requires a fresh configuration validation");
  const archived = await changeIntegrationConnectionState({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    action: "ARCHIVE",
  });
  assert.equal(archived.state, "ARCHIVED");
  assert.equal((await getIntegrationDashboard(ctx.organisation.id)).connections.length, 0);
});

test("audit payloads are allow-listed across update, mapping, credential and validation actions", async () => {
  const ctx = await context("audit");
  const created = await createIntegrationConnection({
    organisationId: ctx.organisation.id,
    actorUserId: ctx.actor.id,
    input: baseInput("FHIR_R4"),
  });
  await updateIntegrationConnection({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
    input: {
      mapping: mappings("FHIR_R4", false),
      credentialRef: "vault:integrations/replacement-reference",
      schedule: { cadence: "DAILY", timeOfDay: "03:15", incrementalField: "_lastUpdated" },
    },
  });
  await validateStoredIntegrationConnection({
    organisationId: ctx.organisation.id,
    connectionId: created.id,
    actorUserId: ctx.actor.id,
  });
  const actions = (await prisma.auditLog.findMany({ where: { entityId: created.id } })).map(
    (entry) => entry.action
  );
  for (const action of [
    "INTEGRATION_CONNECTION_CREATED",
    "INTEGRATION_CONNECTION_UPDATED",
    "INTEGRATION_MAPPING_UPDATED",
    "INTEGRATION_SCHEDULE_UPDATED",
    "INTEGRATION_CREDENTIAL_REFERENCE_REPLACED",
    "INTEGRATION_CONFIGURATION_VALIDATED",
  ]) {
    assert.ok(actions.includes(action), `missing audit action ${action}`);
  }
  const serialized = JSON.stringify(
    await prisma.auditLog.findMany({ where: { entityId: created.id }, select: { newValue: true } })
  );
  assert.doesNotMatch(serialized, /replacement-reference/);
  assert.doesNotMatch(serialized, /fhir\.example\.test/);
});
