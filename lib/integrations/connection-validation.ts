import type { IntegrationConnection } from "@prisma/client";

import {
  getConnectorDefinition,
  type ConnectorType,
} from "@/lib/integrations/connection-catalogue";
import {
  endpointMetadataSchema,
  mappingMetadataSchema,
  parseStoredJson,
  scheduleMetadataSchema,
  type EndpointMetadata,
  type MappingMetadata,
  type ScheduleMetadata,
} from "@/lib/integrations/connection-schema";
import { metadataOnlySecretProvider } from "@/lib/integrations/secret-provider";

export type ConfigurationCheckStatus = "PASS" | "WARNING" | "FAIL" | "NOT_TESTED";

export type ConfigurationCheck = {
  key: "connection" | "authentication" | "mapping" | "schedule" | "connectivity" | "readiness";
  label: string;
  status: ConfigurationCheckStatus;
  value: string;
  detail: string;
};

export type IntegrationConfigurationReport = {
  status: "PASSED" | "WARNING" | "FAILED";
  readyForLiveTest: boolean;
  mappingComplete: number;
  mappingRequired: number;
  checkedAt: string;
  checks: ConfigurationCheck[];
  summary: string;
};

type ValidationSource = Pick<
  IntegrationConnection,
  | "connectorType"
  | "name"
  | "sourceSystem"
  | "sourceFacility"
  | "environment"
  | "endpointJson"
  | "authMethod"
  | "credentialRef"
  | "certificateRef"
  | "mappingVersion"
  | "mappingJson"
  | "scheduleJson"
  | "timezone"
  | "organisationId"
>;

function configured(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

function validHttpUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-NZ", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function authenticationMetadataProblems(source: ValidationSource, endpoint: EndpointMetadata) {
  const problems: string[] = [];
  if (source.authMethod === "API_KEY" && endpoint.apiKeyHeader) {
    const header = endpoint.apiKeyHeader.trim();
    if (!/^[A-Za-z][A-Za-z0-9-]{0,79}$/.test(header) || ["host", "cookie", "set-cookie", "content-length", "proxy-authorization"].includes(header.toLowerCase())) {
      problems.push("valid API key header name");
    }
  }
  if (source.authMethod === "BASIC" && !configured(endpoint.basicUsername)) {
    problems.push("Basic username");
  }
  if (source.authMethod === "OAUTH2_CLIENT_CREDENTIALS") {
    if (!validHttpUrl(endpoint.oauthTokenUrl)) problems.push("valid OAuth token endpoint");
    if (!configured(endpoint.oauthClientId)) problems.push("OAuth client ID");
  }
  return problems;
}

function missingConnectionFields(
  type: ConnectorType,
  source: ValidationSource,
  endpoint: EndpointMetadata
) {
  const missing: string[] = [];
  if (!configured(source.name)) missing.push("connection name");
  if (!configured(source.sourceSystem)) missing.push("source system");
  if (!configured(source.organisationId)) missing.push("organisation association");
  if (!validTimezone(source.timezone)) missing.push("valid timezone");

  if (type === "HL7_V2_LAB") {
    if (!configured(source.sourceFacility)) missing.push("source facility");
    if (!configured(endpoint.host)) missing.push("MLLP host metadata");
    if (!configured(endpoint.port)) missing.push("MLLP port");
    if (!configured(endpoint.tlsMode)) missing.push("TLS mode");
    if (!configured(endpoint.sendingApplication)) missing.push("sending application");
    if (!configured(endpoint.sendingFacility)) missing.push("sending facility");
    if (!configured(endpoint.receivingApplication)) missing.push("receiving application");
    if (!configured(endpoint.receivingFacility)) missing.push("receiving facility");
    if (!configured(endpoint.acceptedMessageTypes)) missing.push("accepted message types");
    if (!configured(endpoint.duplicateIdentityStrategy)) missing.push("duplicate identity strategy");
  }

  if (type === "FHIR_R4") {
    if (!validHttpUrl(endpoint.baseUrl)) missing.push("valid FHIR base URL");
    if (!configured(source.sourceFacility)) missing.push("source organisation / facility");
    const resources = endpoint.resourceTypes ?? [];
    if (!resources.includes("DiagnosticReport") || !resources.includes("Observation")) {
      missing.push("DiagnosticReport and Observation resources");
    }
    if (!configured(endpoint.identifierSystem)) missing.push("identifier system");
    if (!configured(endpoint.pagingStrategy)) missing.push("paging strategy");
    if (!configured(endpoint.incrementalParameters)) missing.push("incremental search parameters");
    if (!configured(source.mappingVersion)) missing.push("mapping version");
  }

  if (type === "PMS_REST") {
    if (!validHttpUrl(endpoint.baseUrl)) missing.push("valid base URL");
    if (!configured(source.sourceFacility || endpoint.organisationSite)) missing.push("organisation / site");
    if (!configured(endpoint.pagingStrategy)) missing.push("pagination strategy");
    if (!configured(endpoint.incrementalParameters)) missing.push("incremental-sync field");
  }

  if (type === "SCREENING_REGISTER") {
    if (!validHttpUrl(endpoint.baseUrl)) missing.push("contract endpoint");
    if (!configured(endpoint.facilityOrganisationId)) missing.push("facility / organisation ID");
    if (!configured(endpoint.permittedOperations)) missing.push("permitted operation selection");
    if (!configured(endpoint.screeningHistoryDepth)) missing.push("screening history depth");
    if (!configured(endpoint.programmeIdentifier)) missing.push("programme identifier");
    if (!configured(endpoint.agreementReference)) missing.push("MoU / agreement reference");
    if (!configured(endpoint.lookupStrategy)) missing.push("lookup strategy");
  }

  return missing;
}

function validateSchedule(
  type: ConnectorType,
  schedule: ScheduleMetadata,
  timezone: string
) {
  const problems: string[] = [];
  if (!validTimezone(timezone)) problems.push("timezone is invalid");

  if (type === "HL7_V2_LAB") {
    if (schedule.cadence !== "GATEWAY_MANAGED") {
      problems.push("cadence must be gateway-managed for inbound MLLP");
    }
    return problems;
  }

  if (!schedule.cadence) problems.push("cadence is missing");
  if (["DAILY", "WEEKLY"].includes(schedule.cadence ?? "")) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.timeOfDay ?? "")) {
      problems.push("local run time is invalid");
    }
  }
  if (schedule.cadence === "WEEKLY" && schedule.weekday === undefined) {
    problems.push("weekday is missing");
  }
  if (["FHIR_R4", "PMS_REST"].includes(type) && !configured(schedule.incrementalField)) {
    problems.push("incremental-sync field is missing");
  }
  if (type === "SCREENING_REGISTER" && !configured(schedule.lookupStrategy)) {
    problems.push("lookup strategy is missing");
  }
  return problems;
}

export async function validateIntegrationConfiguration(
  source: ValidationSource,
  now = new Date()
): Promise<IntegrationConfigurationReport> {
  const connectorType = source.connectorType as ConnectorType;
  const definition = getConnectorDefinition(connectorType);
  const endpoint = parseStoredJson(source.endpointJson, endpointMetadataSchema, {});
  const mapping = parseStoredJson(source.mappingJson, mappingMetadataSchema, {} as MappingMetadata);
  const schedule = parseStoredJson(source.scheduleJson, scheduleMetadataSchema, {});
  const missingSettings = missingConnectionFields(connectorType, source, endpoint);

  const credential = await metadataOnlySecretProvider.describe(source.credentialRef);
  const certificate = await metadataOnlySecretProvider.describe(source.certificateRef);
  const authAllowed = definition.authMethods.includes(source.authMethod as never);
  const credentialRequired = source.authMethod !== "NONE";
  const authProblems = authenticationMetadataProblems(source, endpoint);
  const authConfigured =
    authAllowed &&
    authProblems.length === 0 &&
    (!credentialRequired ||
      credential.configured ||
      (source.authMethod === "MUTUAL_TLS" && certificate.configured));

  const mapped = definition.mappingRequirements.filter((requirement) =>
    configured(mapping[requirement.id])
  ).length;
  const required = definition.mappingRequirements.length;
  const scheduleProblems = validateSchedule(connectorType, schedule, source.timezone);

  const connectionCheck: ConfigurationCheck = {
    key: "connection",
    label: "Connection settings",
    status: missingSettings.length ? "FAIL" : "PASS",
    value: missingSettings.length ? `${missingSettings.length} missing` : "Complete",
    detail: missingSettings.length
      ? `Complete: ${missingSettings.join(", ")}.`
      : "Required connector metadata is syntactically complete.",
  };
  const authenticationCheck: ConfigurationCheck = {
    key: "authentication",
    label: "Authentication configuration",
    status: authConfigured ? "PASS" : "FAIL",
    value: authConfigured ? (credentialRequired ? "Reference configured" : "No credential required") : "Incomplete",
    detail: !authAllowed
      ? `${source.authMethod} is not allowed for this connector type.`
      : authConfigured
        ? "Authentication metadata is complete; no secret was resolved."
        : authProblems.length
          ? `Complete: ${authProblems.join(", ")}.`
          : "Add a credential or certificate provider reference. Do not paste a secret value.",
  };
  const mappingCheck: ConfigurationCheck = {
    key: "mapping",
    label: "Required mappings",
    status: mapped === required ? "PASS" : "WARNING",
    value: `${mapped}/${required}`,
    detail:
      mapped === required
        ? "Every required connector-specific mapping has a source path."
        : "Mapping is incomplete; configuration cannot be ready to test.",
  };
  const scheduleCheck: ConfigurationCheck = {
    key: "schedule",
    label: "Schedule",
    status: scheduleProblems.length ? "FAIL" : "PASS",
    value: scheduleProblems.length ? "Invalid" : "Valid",
    detail: scheduleProblems.length
      ? `Resolve: ${scheduleProblems.join(", ")}.`
      : definition.scheduleHint,
  };
  const connectivityCheck: ConfigurationCheck = {
    key: "connectivity",
    label: "Connection test",
    status: "NOT_TESTED",
    value: connectorType === "HL7_V2_LAB" ? "Gateway required / Not receiving" : "Not tested",
    detail: "Configuration validation performs no remote request.",
  };

  const failed = [connectionCheck, authenticationCheck, scheduleCheck].some(
    (check) => check.status === "FAIL"
  );
  const readyForLiveTest = !failed && mapped === required;
  const readinessCheck: ConfigurationCheck = {
    key: "readiness",
    label: "Ready to test",
    status: readyForLiveTest ? "PASS" : "WARNING",
    value: readyForLiveTest ? "YES" : "NO",
    detail: readyForLiveTest
      ? "Configuration is ready for a separate explicit connection test."
      : "Resolve configuration, credential, mapping, and schedule gaps first.",
  };
  const status = failed ? "FAILED" : readyForLiveTest ? "PASSED" : "WARNING";

  return {
    status,
    readyForLiveTest,
    mappingComplete: mapped,
    mappingRequired: required,
    checkedAt: now.toISOString(),
    checks: [
      connectionCheck,
      authenticationCheck,
      mappingCheck,
      scheduleCheck,
      connectivityCheck,
      readinessCheck,
    ],
    summary: readyForLiveTest
      ? "Configuration valid and ready for a separate connection test. The connection was not tested."
      : `${status === "FAILED" ? "Configuration has required gaps" : "Configuration needs mapping"}. The connection was not tested.`,
  };
}

export function deriveValidatedState(report: IntegrationConfigurationReport) {
  if (report.readyForLiveTest) return "READY_FOR_LIVE_TEST" as const;
  if (report.mappingComplete === report.mappingRequired) return "MAPPING_VERIFIED" as const;
  if (!report.checks.some((check) => check.key !== "mapping" && check.status === "FAIL")) {
    return "CONFIGURATION_VALID" as const;
  }
  return "CONFIGURED" as const;
}
