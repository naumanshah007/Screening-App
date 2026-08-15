import type { IntegrationConnection } from "@prisma/client";

import { getConnectorDefinition, type ConnectorType } from "@/lib/integrations/connection-catalogue";
import {
  endpointMetadataSchema,
  mappingMetadataSchema,
  parseStoredJson,
} from "@/lib/integrations/connection-schema";
import {
  safeOutboundRequest,
  SafeOutboundRequestError,
  type SafeOutboundRequestOptions,
  type SafeOutboundResponse,
} from "@/lib/integrations/outbound-http";
import { OutboundPolicyError } from "@/lib/integrations/outbound-policy";
import {
  SecretResolutionError,
  serverSecretProvider,
  type SecretProvider,
} from "@/lib/integrations/secret-provider";

export type ConnectivityStepStatus =
  | "PASS"
  | "FAIL"
  | "NOT_REQUIRED"
  | "NOT_SUPPORTED"
  | "NOT_VERIFIED"
  | "NOT_TESTED"
  | "INCOMPATIBLE";

export type ConnectivityDiagnostic = {
  key: "configuration" | "endpointPolicy" | "network" | "tls" | "authentication" | "protocol" | "resources" | "mapping" | "pilot" | "activation";
  label: string;
  status: ConnectivityStepStatus;
  value: string;
  detail: string;
};

export type ConnectivityTestResult = {
  status: "PASSED" | "FAILED" | "NOT_TESTED";
  networkStatus: "PASS" | "FAIL" | "NOT_TESTED";
  tlsStatus: "PASS" | "FAIL" | "NOT_REQUIRED" | "NOT_TESTED";
  authenticationStatus: "PASS" | "FAIL" | "NOT_REQUIRED" | "NOT_SUPPORTED" | "NOT_TESTED";
  protocolStatus: "PASS" | "FAIL" | "NOT_VERIFIED" | "NOT_TESTED" | "INCOMPATIBLE";
  httpStatus?: number;
  latencyMs?: number;
  endpointHostname?: string;
  safeSummary: string;
  readyForPilotTest: boolean;
  diagnostics: ConnectivityDiagnostic[];
  safeDetails: Record<string, string | number | boolean | string[]>;
  auditCategory?: "POLICY_BLOCKED" | "CREDENTIAL_RESOLUTION_FAILED";
};

type ConnectivitySource = Pick<
  IntegrationConnection,
  | "connectorType"
  | "environment"
  | "state"
  | "endpointJson"
  | "authMethod"
  | "credentialRef"
  | "certificateRef"
  | "mappingJson"
  | "lastValidationStatus"
>;

export type OutboundRequester = (
  url: string | URL,
  options?: SafeOutboundRequestOptions
) => Promise<SafeOutboundResponse>;

export type ConnectivityTestDependencies = {
  secretProvider?: SecretProvider;
  request?: OutboundRequester;
};

type AuthenticationResult = {
  status: ConnectivityTestResult["authenticationStatus"];
  headers: Record<string, string>;
  sensitiveHeaders: string[];
  diagnostics: ConnectivityDiagnostic;
};

class RemoteAuthenticationError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    readonly response: SafeOutboundResponse
  ) {
    super(safeMessage);
    this.name = "RemoteAuthenticationError";
  }
}

function diagnostic(
  key: ConnectivityDiagnostic["key"],
  label: string,
  status: ConnectivityStepStatus,
  value: string,
  detail: string
): ConnectivityDiagnostic {
  return { key, label, status, value, detail };
}

function mappingCoverage(source: ConnectivitySource) {
  const definition = getConnectorDefinition(source.connectorType as ConnectorType);
  const mapping = parseStoredJson(source.mappingJson, mappingMetadataSchema, {} as Record<string, string>);
  const complete = definition.mappingRequirements.filter((requirement) => Boolean(mapping[requirement.id]?.trim())).length;
  return { complete, required: definition.mappingRequirements.length };
}

function endpointFor(baseUrl: string, path?: string) {
  if (!path) return new URL(baseUrl);
  const base = new URL(baseUrl);
  const normalized = base.href.endsWith("/") ? base : new URL(`${base.href}/`);
  const target = new URL(path, normalized);
  if (target.origin !== base.origin) {
    throw new SafeOutboundRequestError(
      "INVALID_ENDPOINT_PATH",
      "Configured capability path must remain on the connector endpoint host.",
      "NOT_TESTED"
    );
  }
  return target;
}

function notTestedResult(
  source: ConnectivitySource,
  summary: string,
  authStatus: ConnectivityTestResult["authenticationStatus"] = "NOT_TESTED"
): ConnectivityTestResult {
  const coverage = mappingCoverage(source);
  return {
    status: "NOT_TESTED",
    networkStatus: "NOT_TESTED",
    tlsStatus: "NOT_TESTED",
    authenticationStatus: authStatus,
    protocolStatus: "NOT_TESTED",
    safeSummary: summary,
    readyForPilotTest: false,
    diagnostics: [
      diagnostic("configuration", "Configuration", source.lastValidationStatus === "PASSED" ? "PASS" : "FAIL", source.lastValidationStatus === "PASSED" ? "Valid" : "Validation required", "Validate configuration separately before connection testing."),
      diagnostic("network", "Connection test", "NOT_TESTED", "Not tested", summary),
      diagnostic("mapping", "Clinical mapping", coverage.complete === coverage.required ? "PASS" : "FAIL", `${coverage.complete}/${coverage.required}`, "Existing mapping result; no clinical data was requested."),
      diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
    ],
    safeDetails: { mappingComplete: coverage.complete, mappingRequired: coverage.required },
  };
}

function validateApiKeyHeader(value: string | undefined) {
  const header = value?.trim() || "X-API-Key";
  const lowered = header.toLowerCase();
  if (!/^[A-Za-z][A-Za-z0-9-]{0,79}$/.test(header)) return null;
  if (["host", "cookie", "set-cookie", "content-length", "proxy-authorization"].includes(lowered)) return null;
  return header;
}

async function authenticate(
  source: ConnectivitySource,
  request: OutboundRequester,
  secretProvider: SecretProvider
): Promise<AuthenticationResult> {
  const endpoint = parseStoredJson(source.endpointJson, endpointMetadataSchema, {});
  if (source.authMethod === "NONE") {
    return {
      status: "NOT_REQUIRED",
      headers: {},
      sensitiveHeaders: [],
      diagnostics: diagnostic("authentication", "Authentication", "NOT_REQUIRED", "Not required", "No authentication is configured for this endpoint."),
    };
  }
  if (source.authMethod === "MUTUAL_TLS") {
    return {
      status: "NOT_SUPPORTED",
      headers: {},
      sensitiveHeaders: [],
      diagnostics: diagnostic("authentication", "Authentication", "NOT_SUPPORTED", "mTLS not supported", "Configured; mTLS connection testing is not supported in this deployment."),
    };
  }
  if (!source.credentialRef) throw new SecretResolutionError();
  const resolved = await secretProvider.resolve(source.credentialRef);

  if (source.authMethod === "API_KEY") {
    const header = validateApiKeyHeader(endpoint.apiKeyHeader);
    if (!header) throw new SafeOutboundRequestError("INVALID_AUTH_METADATA", "Authentication metadata is invalid.", "NOT_TESTED");
    return {
      status: "PASS",
      headers: { [header]: resolved.value },
      sensitiveHeaders: [header],
      diagnostics: diagnostic("authentication", "Authentication", "PASS", "Configured", "The credential reference resolved server-side; the value is never returned or logged."),
    };
  }

  if (source.authMethod === "BASIC") {
    if (!endpoint.basicUsername) throw new SafeOutboundRequestError("INVALID_AUTH_METADATA", "Authentication metadata is incomplete.", "NOT_TESTED");
    return {
      status: "PASS",
      headers: { Authorization: `Basic ${Buffer.from(`${endpoint.basicUsername}:${resolved.value}`).toString("base64")}` },
      sensitiveHeaders: ["Authorization"],
      diagnostics: diagnostic("authentication", "Authentication", "PASS", "Configured", "Basic credentials were assembled server-side and are never returned or logged."),
    };
  }

  if (!endpoint.oauthTokenUrl || !endpoint.oauthClientId) {
    throw new SafeOutboundRequestError("INVALID_AUTH_METADATA", "OAuth authentication metadata is incomplete.", "NOT_TESTED");
  }
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (endpoint.oauthScopes) body.set("scope", endpoint.oauthScopes);
  if (endpoint.oauthAudience) body.set("audience", endpoint.oauthAudience);
  const tokenResponse = await request(endpoint.oauthTokenUrl, {
    method: "POST",
    allowRedirects: false,
    maxResponseBytes: 64 * 1024,
    headers: {
      Authorization: `Basic ${Buffer.from(`${endpoint.oauthClientId}:${resolved.value}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    sensitiveHeaders: ["Authorization"],
    body: body.toString(),
  });
  if (tokenResponse.statusCode < 200 || tokenResponse.statusCode >= 300) {
    throw new RemoteAuthenticationError("OAUTH_REJECTED", `Authentication failed — remote system returned HTTP ${tokenResponse.statusCode}.`, tokenResponse);
  }
  let token: unknown;
  try {
    token = JSON.parse(tokenResponse.body.toString("utf8"));
  } catch {
    throw new RemoteAuthenticationError("OAUTH_RESPONSE_INVALID", "Authentication failed — token response was invalid.", tokenResponse);
  }
  const accessToken = token && typeof token === "object" && "access_token" in token
    ? (token as { access_token?: unknown }).access_token
    : undefined;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new RemoteAuthenticationError("OAUTH_TOKEN_MISSING", "Authentication failed — token response was invalid.", tokenResponse);
  }
  return {
    status: "PASS",
    headers: { Authorization: `Bearer ${accessToken}` },
    sensitiveHeaders: ["Authorization"],
    diagnostics: diagnostic("authentication", "Authentication", "PASS", "Passed", "OAuth client credentials succeeded; the token was used only for this test and was not persisted."),
  };
}

function parseFhirCapability(response: SafeOutboundResponse) {
  let payload: unknown;
  try {
    payload = JSON.parse(response.body.toString("utf8"));
  } catch {
    return { ok: false as const, reason: "FHIR capability response was not valid JSON." };
  }
  if (!payload || typeof payload !== "object" || (payload as { resourceType?: unknown }).resourceType !== "CapabilityStatement") {
    return { ok: false as const, reason: "Endpoint did not return a FHIR CapabilityStatement." };
  }
  const capability = payload as {
    fhirVersion?: unknown;
    rest?: Array<{ resource?: Array<{ type?: unknown }> }>;
  };
  const fhirVersion = typeof capability.fhirVersion === "string" ? capability.fhirVersion : "unknown";
  const resources = Array.from(new Set((capability.rest ?? []).flatMap((rest) => rest.resource ?? []).map((entry) => entry.type).filter((type): type is string => typeof type === "string"))).sort();
  return { ok: true as const, fhirVersion, resources, compatible: /^4\.0(?:\.|$)/.test(fhirVersion) };
}

function failureFromError(source: ConnectivitySource, error: unknown): ConnectivityTestResult {
  const coverage = mappingCoverage(source);
  if (error instanceof OutboundPolicyError) {
    return {
      status: "FAILED",
      networkStatus: "NOT_TESTED",
      tlsStatus: "NOT_TESTED",
      authenticationStatus: "NOT_TESTED",
      protocolStatus: "NOT_TESTED",
      safeSummary: error.safeMessage,
      readyForPilotTest: false,
      diagnostics: [
        diagnostic("endpointPolicy", "Endpoint policy", "FAIL", "Blocked", error.safeMessage),
        diagnostic("network", "DNS / network", "NOT_TESTED", "Not attempted", "No outbound connection was opened."),
        diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
      ],
      safeDetails: { policyStatus: "BLOCKED", mappingComplete: coverage.complete, mappingRequired: coverage.required },
      auditCategory: "POLICY_BLOCKED",
    };
  }
  if (error instanceof SecretResolutionError) {
    return {
      status: "FAILED",
      networkStatus: "NOT_TESTED",
      tlsStatus: "NOT_TESTED",
      authenticationStatus: "FAIL",
      protocolStatus: "NOT_TESTED",
      safeSummary: "Configured credential reference could not be resolved.",
      readyForPilotTest: false,
      diagnostics: [
        diagnostic("endpointPolicy", "Endpoint policy", "NOT_TESTED", "Not attempted", "Credential resolution failed before the request."),
        diagnostic("authentication", "Credential reference", "FAIL", "Unresolved", "Configured reference could not be resolved."),
        diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
      ],
      safeDetails: { credentialConfigured: Boolean(source.credentialRef) },
      auditCategory: "CREDENTIAL_RESOLUTION_FAILED",
    };
  }
  if (error instanceof RemoteAuthenticationError) {
    return {
      status: "FAILED",
      networkStatus: "PASS",
      tlsStatus: error.response.tls,
      authenticationStatus: "FAIL",
      protocolStatus: "NOT_TESTED",
      httpStatus: error.response.statusCode,
      latencyMs: error.response.latencyMs,
      endpointHostname: error.response.target.hostname,
      safeSummary: error.safeMessage,
      readyForPilotTest: false,
      diagnostics: [
        diagnostic("endpointPolicy", "Endpoint policy", "PASS", "Passed", "The configured token endpoint passed URL and resolved-address policy."),
        diagnostic("network", "DNS / network", "PASS", "Passed", "The configured token endpoint returned an HTTP response."),
        diagnostic("tls", "TLS", error.response.tls, error.response.tls === "PASS" ? "Passed" : "Not required", error.response.tls === "PASS" ? "A TLS session completed." : "The token endpoint uses HTTP; no TLS claim is made."),
        diagnostic("authentication", "Authentication", "FAIL", "Failed", error.safeMessage),
        diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
      ],
      safeDetails: { failureCategory: error.code, mappingComplete: coverage.complete, mappingRequired: coverage.required },
    };
  }
  const safe = error instanceof SafeOutboundRequestError
    ? error
    : new SafeOutboundRequestError("UNEXPECTED_FAILURE", "Connection test failed safely.");
  const policyNotTested = ["INVALID_AUTH_METADATA", "INVALID_ENDPOINT_PATH", "UNEXPECTED_FAILURE"].includes(safe.code);
  return {
    status: "FAILED",
    networkStatus: safe.networkStatus,
    tlsStatus: safe.tlsStatus,
    authenticationStatus: safe.code.startsWith("OAUTH") ? "FAIL" : "NOT_TESTED",
    protocolStatus: "NOT_TESTED",
    safeSummary: safe.safeMessage,
    readyForPilotTest: false,
    diagnostics: [
      diagnostic(
        "endpointPolicy",
        "Endpoint policy",
        policyNotTested ? "NOT_TESTED" : "PASS",
        policyNotTested ? "Not attempted" : "Passed",
        policyNotTested ? "No outbound connection was opened." : "The configured destination passed URL and resolved-address policy."
      ),
      diagnostic("network", "DNS / network", safe.networkStatus, safe.networkStatus === "FAIL" ? "Failed" : "Not tested", safe.safeMessage),
      diagnostic("tls", "TLS", safe.tlsStatus, safe.tlsStatus === "FAIL" ? "Failed" : "Not tested", safe.safeMessage),
      diagnostic("authentication", "Authentication", safe.code.startsWith("OAUTH") ? "FAIL" : "NOT_TESTED", safe.code.startsWith("OAUTH") ? "Failed" : "Not tested", safe.safeMessage),
      diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
    ],
    safeDetails: { failureCategory: safe.code, mappingComplete: coverage.complete, mappingRequired: coverage.required },
  };
}

export async function testIntegrationConnectivity(
  source: ConnectivitySource,
  dependencies: ConnectivityTestDependencies = {}
): Promise<ConnectivityTestResult> {
  const connectorType = source.connectorType as ConnectorType;
  const endpoint = parseStoredJson(source.endpointJson, endpointMetadataSchema, {});
  const coverage = mappingCoverage(source);
  const request = dependencies.request ?? safeOutboundRequest;
  const secretProvider = dependencies.secretProvider ?? serverSecretProvider;

  if (connectorType === "HL7_V2_LAB") {
    return notTestedResult(source, "MLLP receiver connection testing is unavailable in this deployment. Required component: CerviGrade HL7 Gateway.");
  }
  if (["PAUSED", "ARCHIVED"].includes(source.state)) {
    return notTestedResult(source, "Connection testing is unavailable while the connection is paused or archived.");
  }
  if (source.lastValidationStatus !== "PASSED") {
    return notTestedResult(source, "Validate Configuration must pass before a connection test.");
  }
  if (source.authMethod === "MUTUAL_TLS") {
    return notTestedResult(source, "Configured; mTLS connection testing is not supported in this deployment.", "NOT_SUPPORTED");
  }
  if (!endpoint.baseUrl) {
    return notTestedResult(source, connectorType === "SCREENING_REGISTER" ? "Awaiting authorised endpoint / integration contract." : "A configured HTTP endpoint is required.");
  }
  if (
    connectorType === "SCREENING_REGISTER" &&
    (!endpoint.agreementReference || !endpoint.connectivityPath || !source.credentialRef)
  ) {
    return notTestedResult(source, "Awaiting authorised endpoint / integration contract.");
  }

  try {
    const authentication = await authenticate(source, request, secretProvider);
    if (authentication.status === "NOT_SUPPORTED") {
      return notTestedResult(source, authentication.diagnostics.detail, "NOT_SUPPORTED");
    }
    const path = connectorType === "FHIR_R4"
      ? endpoint.capabilityPath || "metadata"
      : connectorType === "PMS_REST"
        ? endpoint.healthPath
        : endpoint.connectivityPath;
    const targetUrl = endpointFor(endpoint.baseUrl, path);
    const response = await request(targetUrl, {
      headers: authentication.headers,
      sensitiveHeaders: authentication.sensitiveHeaders,
      allowRedirects: true,
      maxRedirects: 2,
      connectTimeoutMs: 3_000,
      totalTimeoutMs: 8_000,
      maxResponseBytes: 256 * 1024,
    });
    const responseSucceeded = response.statusCode >= 200 && response.statusCode < 300;
    const authenticationStatus =
      authentication.status === "PASS" &&
      source.authMethod !== "OAUTH2_CLIENT_CREDENTIALS" &&
      !responseSucceeded
        ? "NOT_TESTED"
        : authentication.status;
    const authenticationDiagnostic = authenticationStatus === authentication.status
      ? authentication.diagnostics
      : diagnostic("authentication", "Authentication", "NOT_TESTED", "Not verified", "The remote operation failed without a definitive authentication response.");
    const commonDiagnostics: ConnectivityDiagnostic[] = [
      diagnostic("configuration", "Configuration", "PASS", "Valid", "Configuration validation passed separately."),
      diagnostic("endpointPolicy", "Endpoint policy", "PASS", "Passed", "URL syntax and every resolved destination address passed the outbound policy."),
      diagnostic("network", "DNS / network", "PASS", "Passed", "The configured endpoint returned an HTTP response."),
      diagnostic("tls", "TLS", response.tls === "PASS" ? "PASS" : "NOT_REQUIRED", response.tls === "PASS" ? "Passed" : "Not required", response.tls === "PASS" ? "A TLS session completed." : "The configured endpoint uses HTTP; no TLS claim is made."),
      authenticationDiagnostic,
    ];

    if (response.statusCode === 401 || response.statusCode === 403) {
      return {
        status: "FAILED",
        networkStatus: "PASS",
        tlsStatus: response.tls,
        authenticationStatus: "FAIL",
        protocolStatus: "NOT_TESTED",
        httpStatus: response.statusCode,
        latencyMs: response.latencyMs,
        endpointHostname: response.target.hostname,
        safeSummary: `Authentication failed — remote system returned HTTP ${response.statusCode}.`,
        readyForPilotTest: false,
        diagnostics: [
          ...commonDiagnostics.slice(0, 4),
          diagnostic("authentication", "Authentication", "FAIL", "Failed", `Remote system returned HTTP ${response.statusCode}.`),
          diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion."),
        ],
        safeDetails: { redirects: response.redirects, mappingComplete: coverage.complete, mappingRequired: coverage.required },
      };
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {
        status: "FAILED",
        networkStatus: "PASS",
        tlsStatus: response.tls,
        authenticationStatus,
        protocolStatus: "FAIL",
        httpStatus: response.statusCode,
        latencyMs: response.latencyMs,
        endpointHostname: response.target.hostname,
        safeSummary: `Remote endpoint returned HTTP ${response.statusCode}.`,
        readyForPilotTest: false,
        diagnostics: [...commonDiagnostics, diagnostic("protocol", "Protocol response", "FAIL", `HTTP ${response.statusCode}`, "The endpoint responded, but the configured capability operation did not succeed."), diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion.")],
        safeDetails: { redirects: response.redirects, mappingComplete: coverage.complete, mappingRequired: coverage.required },
      };
    }

    if (connectorType === "FHIR_R4") {
      const capability = parseFhirCapability(response);
      if (!capability.ok) {
        return {
          status: "FAILED",
          networkStatus: "PASS",
          tlsStatus: response.tls,
          authenticationStatus: authentication.status,
          protocolStatus: "FAIL",
          httpStatus: response.statusCode,
          latencyMs: response.latencyMs,
          endpointHostname: response.target.hostname,
          safeSummary: capability.reason,
          readyForPilotTest: false,
          diagnostics: [...commonDiagnostics, diagnostic("protocol", "FHIR capability endpoint", "FAIL", "Failed", capability.reason), diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Connection testing never enables data ingestion.")],
          safeDetails: { redirects: response.redirects, mappingComplete: coverage.complete, mappingRequired: coverage.required },
        };
      }
      const required = ["DiagnosticReport", "Observation"];
      const available = required.filter((resource) => capability.resources.includes(resource));
      const resourcesPass = available.length === required.length;
      const protocolStatus = capability.compatible ? (resourcesPass ? "PASS" : "FAIL") : "INCOMPATIBLE";
      const passed = capability.compatible && resourcesPass;
      return {
        status: passed ? "PASSED" : "FAILED",
        networkStatus: "PASS",
        tlsStatus: response.tls,
        authenticationStatus: authentication.status,
        protocolStatus,
        httpStatus: response.statusCode,
        latencyMs: response.latencyMs,
        endpointHostname: response.target.hostname,
        safeSummary: passed ? "FHIR R4 capability connection verified." : capability.compatible ? "FHIR capability is missing required resources." : "FHIR version is incompatible with R4.",
        readyForPilotTest: passed && coverage.complete === coverage.required,
        diagnostics: [
          ...commonDiagnostics,
          diagnostic("protocol", "FHIR capability endpoint", capability.compatible ? "PASS" : "INCOMPATIBLE", capability.fhirVersion, capability.compatible ? "A plausible FHIR R4 CapabilityStatement responded." : "The reported FHIR version is not R4."),
          diagnostic("resources", "Required resources", resourcesPass ? "PASS" : "FAIL", `${available.length}/${required.length}`, `DiagnosticReport ${capability.resources.includes("DiagnosticReport") ? "available" : "missing"}; Observation ${capability.resources.includes("Observation") ? "available" : "missing"}; Patient ${capability.resources.includes("Patient") ? "available" : "optional/not advertised"}.`),
          diagnostic("mapping", "Clinical mapping", coverage.complete === coverage.required ? "PASS" : "FAIL", `${coverage.complete}/${coverage.required}`, "Existing mapping result; no patient records were requested."),
          diagnostic("pilot", "Ready for pilot testing", passed && coverage.complete === coverage.required ? "PASS" : "FAIL", passed && coverage.complete === coverage.required ? "YES" : "NO", "Pilot readiness is distinct from enabling Production data ingestion."),
          diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Production governance and an explicit enablement step are still required."),
        ],
        safeDetails: { fhirVersion: capability.fhirVersion, advertisedResources: capability.resources.filter((resource) => ["DiagnosticReport", "Observation", "Patient"].includes(resource)), redirects: response.redirects, mappingComplete: coverage.complete, mappingRequired: coverage.required },
      };
    }

    const namedCapability = connectorType === "PMS_REST" && Boolean(endpoint.healthPath);
    const register = connectorType === "SCREENING_REGISTER";
    return {
      status: "PASSED",
      networkStatus: "PASS",
      tlsStatus: response.tls,
      authenticationStatus: authentication.status,
      protocolStatus: "NOT_VERIFIED",
      httpStatus: response.statusCode,
      latencyMs: response.latencyMs,
      endpointHostname: response.target.hostname,
      safeSummary: register
        ? "Authorised connectivity operation responded; Health NZ compatibility was not inferred."
        : namedCapability
          ? "Configured health endpoint responded; vendor API compatibility was not inferred."
          : "HTTP connectivity verified; API-specific capability was not verified.",
      readyForPilotTest: coverage.complete === coverage.required,
      diagnostics: [
        ...commonDiagnostics,
        diagnostic("protocol", register ? "Contract capability" : "API-specific capability", "NOT_VERIFIED", "Not verified", register ? "Only the configured authorised operation was called; no Health NZ contract semantics were invented." : "HTTP success alone is not evidence of PMS vendor compatibility."),
        diagnostic("mapping", "Clinical mapping", coverage.complete === coverage.required ? "PASS" : "FAIL", `${coverage.complete}/${coverage.required}`, "Existing mapping result; no patient records were requested."),
        diagnostic("pilot", "Ready for pilot testing", coverage.complete === coverage.required ? "PASS" : "FAIL", coverage.complete === coverage.required ? "YES" : "NO", "Pilot readiness is not Production data-ingestion authorisation."),
        diagnostic("activation", "Data ingestion", "NOT_TESTED", "Not enabled", "Production governance and an explicit enablement step are still required."),
      ],
      safeDetails: { capabilityPathConfigured: Boolean(path), redirects: response.redirects, mappingComplete: coverage.complete, mappingRequired: coverage.required },
    };
  } catch (error) {
    return failureFromError(source, error);
  }
}
