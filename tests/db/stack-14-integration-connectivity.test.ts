/** Phase 3B: durable live-connectivity evidence without ingestion or activation. */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { applySchema, createIsolatedDatabase } from "./support/isolated-db";
import { OutboundPolicyError } from "../../lib/integrations/outbound-policy";
import { SecretResolutionError } from "../../lib/integrations/secret-provider";

const database = createIsolatedDatabase("integration-connectivity");

type PrismaClient = typeof import("../../lib/prisma")["prisma"];
let prisma: PrismaClient;
let runStoredConnectivityCheck: typeof import("../../lib/integrations/connectivity-checks")["runStoredConnectivityCheck"];

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ runStoredConnectivityCheck } = await import("../../lib/integrations/connectivity-checks"));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

function capabilityResponse(statusCode = 200) {
  const url = new URL("https://fhir.example.test/r4/metadata");
  return {
    statusCode,
    body: Buffer.from(JSON.stringify({
      resourceType: "CapabilityStatement",
      fhirVersion: "4.0.1",
      rest: [{ resource: [{ type: "DiagnosticReport" }, { type: "Observation" }, { type: "Patient" }] }],
    })),
    contentType: "application/fhir+json",
    latencyMs: 18,
    tls: "PASS" as const,
    redirects: 0,
    target: {
      url,
      hostname: url.hostname,
      addresses: [{ address: "1.1.1.1", family: 4 as const }],
      pinnedAddress: { address: "1.1.1.1", family: 4 as const },
    },
  };
}

async function clinicalAndUsageCounts() {
  const [batchRun, batchReviewItem, screeningEpisode, episodeObservation, ruleEvaluation, usageEvent] = await Promise.all([
    prisma.batchRun.count(),
    prisma.batchReviewItem.count(),
    prisma.screeningEpisode.count(),
    prisma.episodeObservation.count(),
    prisma.ruleEvaluation.count(),
    prisma.usageEvent.count(),
  ]);
  return { batchRun, batchReviewItem, screeningEpisode, episodeObservation, ruleEvaluation, usageEvent };
}

test("checks append immutable safe history, retain failures, respect scope and never ingest", async () => {
  const organisation = await prisma.organisation.create({
    data: { key: `connectivity-${Date.now()}`, name: "Connectivity test organisation" },
  });
  const otherOrganisation = await prisma.organisation.create({
    data: { key: `connectivity-other-${Date.now()}`, name: "Other organisation" },
  });
  const actor = await prisma.user.create({
    data: { email: `connectivity-${Date.now()}@example.test`, name: "Integration Admin", role: "INTEGRATION_ADMIN" },
  });
  const connection = await prisma.integrationConnection.create({
    data: {
      organisationId: organisation.id,
      connectorType: "FHIR_R4",
      name: "Controlled FHIR connectivity",
      sourceSystem: "Synthetic capability endpoint",
      environment: "DEMO",
      state: "READY_FOR_LIVE_TEST",
      endpointJson: JSON.stringify({
        baseUrl: "https://fhir.example.test/r4",
        capabilityPath: "metadata",
        apiKeyHeader: "X-API-Key",
      }),
      authMethod: "API_KEY",
      credentialRef: "env:HISTORY_TEST_SECRET",
      mappingVersion: "test-1",
      mappingJson: JSON.stringify({
        nhi: "Patient.identifier",
        accessionSpecimen: "DiagnosticReport.identifier",
        hpvResult: "Observation.value",
        cytology: "DiagnosticReport.result",
        histology: "DiagnosticReport.conclusion",
        collectionDate: "DiagnosticReport.effectiveDateTime",
      }),
      scheduleJson: JSON.stringify({ cadence: "ON_DEMAND", incrementalField: "_lastUpdated" }),
      lastValidationStatus: "PASSED",
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
    },
  });
  const beforeCounts = await clinicalAndUsageCounts();
  const secret = "history-secret-value-never-persist";
  let observedHeader = "";

  const passed = await runStoredConnectivityCheck({
    organisationId: organisation.id,
    connectionId: connection.id,
    actorUserId: actor.id,
    dependencies: {
      secretProvider: {
        describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
        resolve: async () => ({ value: secret, provider: "environment" }),
      },
      request: async (_url, options) => {
        observedHeader = options?.headers?.["X-API-Key"] ?? "";
        return capabilityResponse();
      },
    },
  });
  assert.equal(observedHeader, secret);
  assert.equal(passed.check.status, "PASSED");
  assert.equal(passed.check.endpointHostname, "fhir.example.test");

  const failed = await runStoredConnectivityCheck({
    organisationId: organisation.id,
    connectionId: connection.id,
    actorUserId: actor.id,
    dependencies: {
      secretProvider: {
        describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
        resolve: async () => ({ value: secret, provider: "environment" }),
      },
      request: async () => capabilityResponse(500),
    },
  });
  assert.equal(failed.check.status, "FAILED");

  const credentialFailure = await runStoredConnectivityCheck({
    organisationId: organisation.id,
    connectionId: connection.id,
    actorUserId: actor.id,
    dependencies: {
      secretProvider: {
        describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
        resolve: async () => { throw new SecretResolutionError(); },
      },
      request: async () => { throw new Error("must not be called"); },
    },
  });
  assert.equal(credentialFailure.result.auditCategory, "CREDENTIAL_RESOLUTION_FAILED");

  const policyFailure = await runStoredConnectivityCheck({
    organisationId: organisation.id,
    connectionId: connection.id,
    actorUserId: actor.id,
    dependencies: {
      secretProvider: {
        describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
        resolve: async () => ({ value: secret, provider: "environment" }),
      },
      request: async () => { throw new OutboundPolicyError("NON_PUBLIC_ADDRESS"); },
    },
  });
  assert.equal(policyFailure.result.auditCategory, "POLICY_BLOCKED");
  assert.equal(policyFailure.check.endpointHostname, null);

  const checks = await prisma.integrationConnectivityCheck.findMany({
    where: { integrationConnectionId: connection.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(checks.map((item) => item.status), ["PASSED", "FAILED", "FAILED", "FAILED"]);
  assert.equal((await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })).state, "READY_FOR_LIVE_TEST");
  assert.deepEqual(await clinicalAndUsageCounts(), beforeCounts);

  await assert.rejects(
    prisma.integrationConnectivityCheck.update({
      where: { id: checks[0]!.id },
      data: { safeSummary: "attempted mutation" },
    })
  );
  await assert.rejects(
    prisma.integrationConnectivityCheck.delete({ where: { id: checks[0]!.id } })
  );
  assert.equal(
    (await prisma.integrationConnectivityCheck.findUniqueOrThrow({ where: { id: checks[0]!.id } })).safeSummary,
    checks[0]!.safeSummary
  );

  await assert.rejects(
    runStoredConnectivityCheck({
      organisationId: otherOrganisation.id,
      connectionId: connection.id,
      actorUserId: actor.id,
      dependencies: { request: async () => capabilityResponse() },
    }),
    /not found for this organisation/i
  );

  const serializedChecks = JSON.stringify(checks);
  const serializedAudits = JSON.stringify(await prisma.auditLog.findMany({ where: { entityId: connection.id } }));
  assert.doesNotMatch(serializedChecks, new RegExp(secret));
  assert.doesNotMatch(serializedAudits, new RegExp(secret));
  assert.doesNotMatch(serializedAudits, /HISTORY_TEST_SECRET/);
  for (const action of [
    "INTEGRATION_LIVE_TEST_INITIATED",
    "INTEGRATION_LIVE_TEST_PASSED",
    "INTEGRATION_LIVE_TEST_FAILED",
    "INTEGRATION_CREDENTIAL_REFERENCE_RESOLUTION_FAILED",
    "INTEGRATION_OUTBOUND_POLICY_BLOCKED",
  ]) {
    assert.match(serializedAudits, new RegExp(action));
  }
});
