import assert from "node:assert/strict";
import test from "node:test";

import { getConnectorDefinition, type ConnectorType } from "../../lib/integrations/connection-catalogue";
import {
  testIntegrationConnectivity,
  type OutboundRequester,
} from "../../lib/integrations/connectivity-test";
import {
  SafeOutboundRequestError,
  type SafeOutboundResponse,
} from "../../lib/integrations/outbound-http";
import { SecretResolutionError, type SecretProvider } from "../../lib/integrations/secret-provider";

type Source = Parameters<typeof testIntegrationConnectivity>[0];

function mapping(type: ConnectorType) {
  return Object.fromEntries(
    getConnectorDefinition(type).mappingRequirements.map((item) => [item.id, `source.${item.id}`])
  );
}

function source(type: ConnectorType, overrides: Partial<Source> = {}): Source {
  const endpoints = {
    HL7_V2_LAB: { host: "gateway.example.test", port: 2575 },
    FHIR_R4: { baseUrl: "https://fhir.example.test/r4", capabilityPath: "metadata" },
    PMS_REST: { baseUrl: "https://pms.example.test/api" },
    SCREENING_REGISTER: {
      baseUrl: "https://register.example.test/api",
      connectivityPath: "capability",
      agreementReference: "AUTHORISED-CONTRACT",
      oauthTokenUrl: "https://auth.example.test/token",
      oauthClientId: "register-client",
    },
  } as const;
  return {
    connectorType: type,
    environment: "DEMO",
    state: "READY_FOR_LIVE_TEST",
    endpointJson: JSON.stringify(endpoints[type]),
    authMethod: type === "SCREENING_REGISTER" ? "OAUTH2_CLIENT_CREDENTIALS" : type === "PMS_REST" ? "API_KEY" : "NONE",
    credentialRef: ["PMS_REST", "SCREENING_REGISTER"].includes(type) ? "env:INTEGRATION_TEST_SECRET" : null,
    certificateRef: null,
    mappingJson: JSON.stringify(mapping(type)),
    lastValidationStatus: "PASSED",
    ...overrides,
  };
}

function response(body: unknown, statusCode = 200, url = "https://fhir.example.test/r4/metadata"): SafeOutboundResponse {
  const targetUrl = new URL(url);
  return {
    statusCode,
    body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
    contentType: "application/fhir+json",
    latencyMs: 14,
    tls: "PASS",
    redirects: 0,
    target: {
      url: targetUrl,
      hostname: targetUrl.hostname,
      addresses: [{ address: "1.1.1.1", family: 4 }],
      pinnedAddress: { address: "1.1.1.1", family: 4 },
    },
  };
}

const validCapability = {
  resourceType: "CapabilityStatement",
  fhirVersion: "4.0.1",
  rest: [{ resource: [{ type: "DiagnosticReport" }, { type: "Observation" }, { type: "Patient" }] }],
};

const secretProvider = (value = "server-secret-never-returned"): SecretProvider => ({
  describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
  resolve: async () => ({ value, provider: "environment" }),
});

test("FHIR capability testing verifies only R4 metadata and required resource declarations", async () => {
  const result = await testIntegrationConnectivity(source("FHIR_R4"), {
    request: async () => response(validCapability),
  });
  assert.equal(result.status, "PASSED");
  assert.equal(result.protocolStatus, "PASS");
  assert.equal(result.readyForPilotTest, true);
  assert.deepEqual(result.safeDetails.advertisedResources, ["DiagnosticReport", "Observation", "Patient"]);
  assert.match(JSON.stringify(result), /no patient records were requested/i);
  assert.equal(result.diagnostics.find((item) => item.key === "activation")?.value, "NO");
});

test("FHIR wrong versions, malformed JSON, non-FHIR bodies and missing resources fail honestly", async () => {
  const cases: Array<[unknown, string, string]> = [
    [{ ...validCapability, fhirVersion: "5.0.0" }, "INCOMPATIBLE", "incompatible"],
    ["{not-json", "FAIL", "valid JSON"],
    [{ resourceType: "OperationOutcome" }, "FAIL", "CapabilityStatement"],
    [{ ...validCapability, rest: [{ resource: [{ type: "Patient" }] }] }, "FAIL", "missing required resources"],
  ];
  for (const [body, protocolStatus, summary] of cases) {
    const result = await testIntegrationConnectivity(source("FHIR_R4"), {
      request: async () => response(body),
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.protocolStatus, protocolStatus);
    assert.match(result.safeSummary, new RegExp(summary, "i"));
  }
});

test("FHIR reports 401, 403, 500 and timeout categories without returning bodies", async () => {
  for (const status of [401, 403, 500]) {
    const result = await testIntegrationConnectivity(source("FHIR_R4"), {
      request: async () => response("remote-body-must-not-be-returned", status),
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.httpStatus, status);
    assert.doesNotMatch(JSON.stringify(result), /remote-body-must-not-be-returned/);
    if (status < 500) assert.equal(result.authenticationStatus, "FAIL");
  }
  const timedOut = await testIntegrationConnectivity(source("FHIR_R4"), {
    request: async () => {
      throw new SafeOutboundRequestError("TOTAL_TIMEOUT", "Live connection test timed out.");
    },
  });
  assert.equal(timedOut.status, "FAILED");
  assert.equal(timedOut.networkStatus, "FAIL");
  assert.match(timedOut.safeSummary, /timed out/i);
});

test("PMS generic connectivity authenticates but never claims vendor compatibility", async () => {
  let observedApiKey = "";
  const request: OutboundRequester = async (_url, options) => {
    observedApiKey = options?.headers?.["X-API-Key"] ?? "";
    return response({ ok: true }, 200, "https://pms.example.test/api");
  };
  const secret = "pms-api-key-secret";
  const result = await testIntegrationConnectivity(source("PMS_REST"), {
    request,
    secretProvider: secretProvider(secret),
  });
  assert.equal(observedApiKey, secret);
  assert.equal(result.status, "PASSED");
  assert.equal(result.authenticationStatus, "PASS");
  assert.equal(result.protocolStatus, "NOT_VERIFIED");
  assert.match(result.safeSummary, /API-specific capability was not verified/i);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));

  const rejected = await testIntegrationConnectivity(source("PMS_REST"), {
    request: async () => response({}, 401, "https://pms.example.test/api"),
    secretProvider: secretProvider(secret),
  });
  assert.equal(rejected.authenticationStatus, "FAIL");
  const indeterminate = await testIntegrationConnectivity(source("PMS_REST"), {
    request: async () => response({}, 500, "https://pms.example.test/api"),
    secretProvider: secretProvider(secret),
  });
  assert.equal(indeterminate.authenticationStatus, "NOT_TESTED");
});

test("configured capability paths cannot forward connector credentials to another host", async () => {
  let calls = 0;
  const result = await testIntegrationConnectivity(source("PMS_REST", {
    endpointJson: JSON.stringify({
      baseUrl: "https://pms.example.test/api",
      healthPath: "https://different.example.test/health",
    }),
  }), {
    secretProvider: secretProvider(),
    request: async () => {
      calls += 1;
      return response({ ok: true });
    },
  });
  assert.equal(result.status, "FAILED");
  assert.equal(calls, 0);
  assert.match(result.safeSummary, /must remain on the connector endpoint host/i);
});

test("Screening Register requires an authorised contract operation and uses only that configured mock", async () => {
  let calls = 0;
  const unavailable = await testIntegrationConnectivity(source("SCREENING_REGISTER", {
    endpointJson: JSON.stringify({ baseUrl: "https://register.example.test/api" }),
    credentialRef: null,
  }), {
    request: async () => {
      calls += 1;
      return response({});
    },
  });
  assert.equal(unavailable.status, "NOT_TESTED");
  assert.equal(calls, 0);
  assert.equal(unavailable.safeSummary, "Awaiting authorised endpoint / integration contract.");

  const requested: string[] = [];
  const configured = await testIntegrationConnectivity(source("SCREENING_REGISTER"), {
    secretProvider: secretProvider(),
    request: async (url) => {
      requested.push(String(url));
      if (requested.length === 1) return response({ access_token: "short-lived-token" }, 200, "https://auth.example.test/token");
      return response({ ok: true }, 200, "https://register.example.test/api/capability");
    },
  });
  assert.equal(configured.status, "PASSED");
  assert.equal(configured.protocolStatus, "NOT_VERIFIED");
  assert.equal(requested.length, 2);
  assert.match(requested[1]!, /\/api\/capability$/);
  assert.match(configured.safeSummary, /compatibility was not inferred/i);
});

test("HL7 and mTLS boundaries make no outbound request and never fake a pass", async () => {
  let calls = 0;
  const request: OutboundRequester = async () => {
    calls += 1;
    return response({});
  };
  const hl7 = await testIntegrationConnectivity(source("HL7_V2_LAB"), { request });
  assert.equal(hl7.status, "NOT_TESTED");
  assert.match(hl7.safeSummary, /CerviGrade HL7 Gateway/);
  const mtls = await testIntegrationConnectivity(source("FHIR_R4", { authMethod: "MUTUAL_TLS" }), { request });
  assert.equal(mtls.status, "NOT_TESTED");
  assert.equal(mtls.authenticationStatus, "NOT_SUPPORTED");
  assert.equal(calls, 0);
});

test("OAuth tokens and unresolved secret references never appear in returned diagnostics", async () => {
  const secret = "oauth-client-secret-private";
  const token = "oauth-access-token-private";
  let calls = 0;
  const oauthSource = source("FHIR_R4", {
    authMethod: "OAUTH2_CLIENT_CREDENTIALS",
    credentialRef: "env:INTEGRATION_OAUTH_SECRET",
    endpointJson: JSON.stringify({
      baseUrl: "https://fhir.example.test/r4",
      capabilityPath: "metadata",
      oauthTokenUrl: "https://auth.example.test/token",
      oauthClientId: "fhir-client",
    }),
  });
  const passed = await testIntegrationConnectivity(oauthSource, {
    secretProvider: secretProvider(secret),
    request: async (_url, options) => {
      calls += 1;
      if (calls === 1) {
        assert.match(options?.headers?.Authorization ?? "", /Basic /);
        return response({ access_token: token }, 200, "https://auth.example.test/token");
      }
      assert.equal(options?.headers?.Authorization, `Bearer ${token}`);
      return response(validCapability);
    },
  });
  assert.equal(passed.status, "PASSED");
  assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(passed), new RegExp(`${secret}|${token}`));

  const unresolved = await testIntegrationConnectivity(oauthSource, {
    secretProvider: {
      describe: async () => ({ configured: true, provider: "Environment variable", label: "Configured" }),
      resolve: async () => { throw new SecretResolutionError(); },
    },
    request: async () => { throw new Error("must not be called"); },
  });
  assert.equal(unresolved.auditCategory, "CREDENTIAL_RESOLUTION_FAILED");
  assert.doesNotMatch(JSON.stringify(unresolved), /INTEGRATION_OAUTH_SECRET/);
});
