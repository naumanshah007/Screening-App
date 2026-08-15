import type { IntegrationConnection, Prisma } from "@prisma/client";

import {
  getConnectorDefinition,
  type ConnectorType,
} from "@/lib/integrations/connection-catalogue";
import {
  endpointMetadataSchema,
  mappingMetadataSchema,
  parseStoredJson,
  scheduleMetadataSchema,
  type IntegrationConnectionInput,
  type IntegrationConnectionUpdate,
} from "@/lib/integrations/connection-schema";
import {
  deriveValidatedState,
  validateIntegrationConfiguration,
  type IntegrationConfigurationReport,
} from "@/lib/integrations/connection-validation";
import {
  getLiveTestAvailability,
  listLatestConnectivityChecksForConnections,
  listConnectivityChecksForConnections,
  type IntegrationConnectivityCheckDto,
} from "@/lib/integrations/connectivity-checks";
import { prisma } from "@/lib/prisma";

export const INTEGRATION_CONNECTION_STATES = [
  "NOT_CONFIGURED",
  "CONFIGURED",
  "CONFIGURATION_VALID",
  "MAPPING_VERIFIED",
  "READY_FOR_LIVE_TEST",
  "PAUSED",
  "ERROR",
  "ARCHIVED",
] as const;

export type IntegrationConnectionState = (typeof INTEGRATION_CONNECTION_STATES)[number];
export type IntegrationConnectionAction = "PAUSE" | "RESUME" | "ARCHIVE";

export const INTEGRATION_AUDIT_ACTIONS = {
  CREATED: "INTEGRATION_CONNECTION_CREATED",
  UPDATED: "INTEGRATION_CONNECTION_UPDATED",
  MAPPING_UPDATED: "INTEGRATION_MAPPING_UPDATED",
  SCHEDULE_UPDATED: "INTEGRATION_SCHEDULE_UPDATED",
  CREDENTIAL_REPLACED: "INTEGRATION_CREDENTIAL_REFERENCE_REPLACED",
  VALIDATED: "INTEGRATION_CONFIGURATION_VALIDATED",
  STATE_CHANGED: "INTEGRATION_CONNECTION_STATE_CHANGED",
  ARCHIVED: "INTEGRATION_CONNECTION_ARCHIVED",
} as const;

type ConnectionWithActors = IntegrationConnection & {
  createdBy: { name: string | null; email: string };
  updatedBy: { name: string | null; email: string };
};

export type IntegrationAuditDto = {
  id: string;
  action: string;
  at: string;
  actor: string;
  details: Record<string, unknown> | null;
};

export type IntegrationConnectionDto = {
  id: string;
  connectorType: ConnectorType;
  catalogueId: string;
  connectorTitle: string;
  name: string;
  description: string | null;
  sourceSystem: string;
  sourceFacility: string | null;
  environment: string;
  state: IntegrationConnectionState;
  endpoint: ReturnType<typeof endpointMetadataSchema.parse>;
  authMethod: string;
  credentialConfigured: boolean;
  certificateConfigured: boolean;
  mappingVersion: string | null;
  mapping: Record<string, string>;
  mappingComplete: number;
  mappingRequired: number;
  schedule: ReturnType<typeof scheduleMetadataSchema.parse>;
  timezone: string;
  lastValidatedAt: string | null;
  lastValidationStatus: string | null;
  lastValidationSummary: string | null;
  lastSuccessfulImportAt: string | null;
  lastFailureAt: string | null;
  updatedAt: string;
  updatedBy: string;
  audits: IntegrationAuditDto[];
  connectivityChecks: IntegrationConnectivityCheckDto[];
  latestConnectivityCheck: IntegrationConnectivityCheckDto | null;
  liveTestAvailable: boolean;
  liveTestUnavailableReason: string;
};

export type IntegrationDashboard = {
  connections: IntegrationConnectionDto[];
  summary: {
    configured: number;
    readyForLiveTest: number;
    liveVerified: number;
    needsConfiguration: number;
    pausedOrErrors: number;
  };
  health: {
    configurationFailures: number;
    mappingIncomplete: number;
    missingCredentialReferences: number;
    invalidSchedules: number;
    liveConnectivityNotTested: number;
    liveConnectivityFailures: number;
    staleConnectivityEvidence: number;
  };
};

function parseAuditDetails(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function storedJsonEquals(value: string, next: unknown): boolean {
  try {
    return canonicalJson(JSON.parse(value)) === canonicalJson(next);
  } catch {
    return false;
  }
}

/** The only metadata keys permitted into AuditLog for connector actions. */
export function safeIntegrationAuditDetails(details: {
  connectorType?: string;
  name?: string;
  sourceSystem?: string;
  sourceFacility?: string | null;
  environment?: string;
  state?: string;
  previousState?: string;
  changedFields?: string[];
  mappingCoverage?: string;
  scheduleCadence?: string | null;
  endpointConfigured?: boolean;
  credentialConfigured?: boolean;
  certificateConfigured?: boolean;
  validationStatus?: string;
  validationIssueCount?: number;
}) {
  return {
    ...(details.connectorType ? { connectorType: details.connectorType } : {}),
    ...(details.name ? { name: details.name } : {}),
    ...(details.sourceSystem ? { sourceSystem: details.sourceSystem } : {}),
    ...(details.sourceFacility !== undefined ? { sourceFacility: details.sourceFacility } : {}),
    ...(details.environment ? { environment: details.environment } : {}),
    ...(details.state ? { state: details.state } : {}),
    ...(details.previousState ? { previousState: details.previousState } : {}),
    ...(details.changedFields ? { changedFields: details.changedFields } : {}),
    ...(details.mappingCoverage ? { mappingCoverage: details.mappingCoverage } : {}),
    ...(details.scheduleCadence !== undefined ? { scheduleCadence: details.scheduleCadence } : {}),
    ...(details.endpointConfigured !== undefined ? { endpointConfigured: details.endpointConfigured } : {}),
    ...(details.credentialConfigured !== undefined ? { credentialConfigured: details.credentialConfigured } : {}),
    ...(details.certificateConfigured !== undefined ? { certificateConfigured: details.certificateConfigured } : {}),
    ...(details.validationStatus ? { validationStatus: details.validationStatus } : {}),
    ...(details.validationIssueCount !== undefined ? { validationIssueCount: details.validationIssueCount } : {}),
  };
}

function auditData(args: {
  actorUserId: string;
  connectionId: string;
  action: string;
  details: ReturnType<typeof safeIntegrationAuditDetails>;
}): Prisma.AuditLogCreateInput {
  return {
    user: { connect: { id: args.actorUserId } },
    action: args.action,
    entity: "IntegrationConnection",
    entityId: args.connectionId,
    severity: "INFO",
    newValue: JSON.stringify(args.details),
  };
}

function mappingCoverage(row: IntegrationConnection) {
  const definition = getConnectorDefinition(row.connectorType as ConnectorType);
  const mapping = parseStoredJson(row.mappingJson, mappingMetadataSchema, {} as Record<string, string>);
  const complete = definition.mappingRequirements.filter(
    (requirement) => Boolean(mapping[requirement.id]?.trim())
  ).length;
  return { complete, required: definition.mappingRequirements.length };
}

function toDto(
  row: ConnectionWithActors,
  audits: IntegrationAuditDto[] = [],
  connectivityChecks: IntegrationConnectivityCheckDto[] = []
): IntegrationConnectionDto {
  const definition = getConnectorDefinition(row.connectorType as ConnectorType);
  const coverage = mappingCoverage(row);
  const availability = getLiveTestAvailability(row);
  return {
    id: row.id,
    connectorType: row.connectorType as ConnectorType,
    catalogueId: definition.catalogueId,
    connectorTitle: definition.title,
    name: row.name,
    description: row.description,
    sourceSystem: row.sourceSystem,
    sourceFacility: row.sourceFacility,
    environment: row.environment,
    state: row.state as IntegrationConnectionState,
    endpoint: parseStoredJson(row.endpointJson, endpointMetadataSchema, {}),
    authMethod: row.authMethod,
    credentialConfigured: Boolean(row.credentialRef),
    certificateConfigured: Boolean(row.certificateRef),
    mappingVersion: row.mappingVersion,
    mapping: parseStoredJson(row.mappingJson, mappingMetadataSchema, {} as Record<string, string>),
    mappingComplete: coverage.complete,
    mappingRequired: coverage.required,
    schedule: parseStoredJson(row.scheduleJson, scheduleMetadataSchema, {}),
    timezone: row.timezone,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    lastValidationStatus: row.lastValidationStatus,
    lastValidationSummary: row.lastValidationSummary,
    lastSuccessfulImportAt: row.lastSuccessfulImportAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy.name ?? row.updatedBy.email,
    audits,
    connectivityChecks,
    latestConnectivityCheck: connectivityChecks[0] ?? null,
    liveTestAvailable: availability.available,
    liveTestUnavailableReason: availability.reason,
  };
}

const actorInclude = {
  createdBy: { select: { name: true, email: true } },
  updatedBy: { select: { name: true, email: true } },
} satisfies Prisma.IntegrationConnectionInclude;

async function requireScopedConnection(organisationId: string, connectionId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organisationId },
    include: actorInclude,
  });
  if (!connection) throw new Error("Integration connection not found for this organisation");
  return connection;
}

export async function getIntegrationDashboard(
  organisationId: string
): Promise<IntegrationDashboard> {
  const rows = await prisma.integrationConnection.findMany({
    where: { organisationId, archivedAt: null },
    include: actorInclude,
    orderBy: [{ state: "asc" }, { updatedAt: "desc" }],
  });
  const ids = rows.map((row) => row.id);
  const latestCheckByConnection = await listLatestConnectivityChecksForConnections(
    organisationId,
    ids
  );
  const connections = rows.map((row) => toDto(
    row,
    [],
    latestCheckByConnection.has(row.id) ? [latestCheckByConnection.get(row.id)!] : []
  ));
  const missingCredentialReferences = connections.filter(
    (connection) => connection.authMethod !== "NONE" && !connection.credentialConfigured && !connection.certificateConfigured
  ).length;
  const invalidSchedules = connections.filter((connection) => {
    if (connection.connectorType === "HL7_V2_LAB") {
      return connection.schedule.cadence !== "GATEWAY_MANAGED";
    }
    return !connection.schedule.cadence;
  }).length;

  return {
    connections,
    summary: {
      configured: connections.length,
      readyForLiveTest: connections.filter((item) => item.state === "READY_FOR_LIVE_TEST").length,
      liveVerified: connections.filter(
        (item) =>
          item.lastValidationStatus === "PASSED" &&
          item.latestConnectivityCheck?.status === "PASSED" &&
          !item.latestConnectivityCheck.stale
      ).length,
      needsConfiguration: connections.filter((item) =>
        ["NOT_CONFIGURED", "CONFIGURED", "CONFIGURATION_VALID", "MAPPING_VERIFIED"].includes(item.state)
      ).length,
      pausedOrErrors: connections.filter((item) => ["PAUSED", "ERROR"].includes(item.state)).length,
    },
    health: {
      configurationFailures: connections.filter((item) => item.lastValidationStatus === "FAILED").length,
      mappingIncomplete: connections.filter((item) => item.mappingComplete < item.mappingRequired).length,
      missingCredentialReferences,
      invalidSchedules,
      liveConnectivityNotTested: connections.filter((item) => !item.latestConnectivityCheck || item.latestConnectivityCheck.status === "NOT_TESTED").length,
      liveConnectivityFailures: connections.filter((item) => item.latestConnectivityCheck?.status === "FAILED").length,
      staleConnectivityEvidence: connections.filter((item) => item.latestConnectivityCheck?.status === "PASSED" && item.latestConnectivityCheck.stale).length,
    },
  };
}

export async function getIntegrationConnectionEvidence(
  organisationId: string,
  connectionId: string
): Promise<Pick<IntegrationConnectionDto, "audits" | "connectivityChecks">> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organisationId },
    select: { id: true },
  });
  if (!connection) {
    throw new Error("Integration connection not found for this organisation");
  }

  const [auditRows, checkByConnection] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "IntegrationConnection", entityId: connectionId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    listConnectivityChecksForConnections(organisationId, [connectionId]),
  ]);

  return {
    audits: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      at: row.createdAt.toISOString(),
      actor: row.user?.name ?? row.user?.email ?? "System",
      details: parseAuditDetails(row.newValue),
    })),
    connectivityChecks: checkByConnection.get(connectionId) ?? [],
  };
}

export async function createIntegrationConnection(args: {
  organisationId: string;
  actorUserId: string;
  input: IntegrationConnectionInput;
}) {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.integrationConnection.create({
      data: {
        organisationId: args.organisationId,
        connectorType: args.input.connectorType,
        name: args.input.name,
        description: args.input.description || null,
        sourceSystem: args.input.sourceSystem,
        sourceFacility: args.input.sourceFacility || null,
        environment: args.input.environment,
        state: "CONFIGURED",
        endpointJson: JSON.stringify(args.input.endpoint),
        authMethod: args.input.authMethod,
        credentialRef: args.input.credentialRef || null,
        certificateRef: args.input.certificateRef || null,
        mappingVersion: args.input.mappingVersion || null,
        mappingJson: JSON.stringify(args.input.mapping),
        scheduleJson: JSON.stringify(args.input.schedule),
        timezone: args.input.timezone,
        createdByUserId: args.actorUserId,
        updatedByUserId: args.actorUserId,
      },
      include: actorInclude,
    });
    const coverage = mappingCoverage(created);
    await tx.auditLog.create({
      data: auditData({
        actorUserId: args.actorUserId,
        connectionId: created.id,
        action: INTEGRATION_AUDIT_ACTIONS.CREATED,
        details: safeIntegrationAuditDetails({
          connectorType: created.connectorType,
          name: created.name,
          sourceSystem: created.sourceSystem,
          sourceFacility: created.sourceFacility,
          environment: created.environment,
          state: created.state,
          mappingCoverage: `${coverage.complete}/${coverage.required}`,
          scheduleCadence: args.input.schedule.cadence ?? null,
          endpointConfigured: Object.keys(args.input.endpoint).length > 0,
          credentialConfigured: Boolean(created.credentialRef),
          certificateConfigured: Boolean(created.certificateRef),
        }),
      }),
    });
    return created;
  });
  return toDto(row);
}

export async function updateIntegrationConnection(args: {
  organisationId: string;
  connectionId: string;
  actorUserId: string;
  input: IntegrationConnectionUpdate;
}) {
  const existing = await requireScopedConnection(args.organisationId, args.connectionId);
  if (existing.state === "ARCHIVED") throw new Error("Archived connections cannot be changed");

  const data: Prisma.IntegrationConnectionUpdateInput = { updatedBy: { connect: { id: args.actorUserId } } };
  const changedFields: string[] = [];
  const assign = (
    key: keyof IntegrationConnectionUpdate,
    column: keyof Prisma.IntegrationConnectionUpdateInput,
    value: unknown,
    existingValue: unknown,
    equal: (left: unknown, right: unknown) => boolean = Object.is
  ) => {
    if (args.input[key] !== undefined && !equal(existingValue, value)) {
      (data as Record<string, unknown>)[column as string] = value;
      changedFields.push(String(key));
    }
  };
  assign("connectorType", "connectorType", args.input.connectorType, existing.connectorType);
  assign("name", "name", args.input.name, existing.name);
  assign("description", "description", args.input.description || null, existing.description);
  assign("sourceSystem", "sourceSystem", args.input.sourceSystem, existing.sourceSystem);
  assign("sourceFacility", "sourceFacility", args.input.sourceFacility || null, existing.sourceFacility);
  assign("environment", "environment", args.input.environment, existing.environment);
  assign(
    "endpoint",
    "endpointJson",
    args.input.endpoint ? JSON.stringify(args.input.endpoint) : undefined,
    existing.endpointJson,
    (current, next) => typeof current === "string" && typeof next === "string" && storedJsonEquals(current, JSON.parse(next))
  );
  assign("authMethod", "authMethod", args.input.authMethod, existing.authMethod);
  assign("credentialRef", "credentialRef", args.input.credentialRef || null, existing.credentialRef);
  assign("certificateRef", "certificateRef", args.input.certificateRef || null, existing.certificateRef);
  assign("mappingVersion", "mappingVersion", args.input.mappingVersion || null, existing.mappingVersion);
  assign(
    "mapping",
    "mappingJson",
    args.input.mapping ? JSON.stringify(args.input.mapping) : undefined,
    existing.mappingJson,
    (current, next) => typeof current === "string" && typeof next === "string" && storedJsonEquals(current, JSON.parse(next))
  );
  assign(
    "schedule",
    "scheduleJson",
    args.input.schedule ? JSON.stringify(args.input.schedule) : undefined,
    existing.scheduleJson,
    (current, next) => typeof current === "string" && typeof next === "string" && storedJsonEquals(current, JSON.parse(next))
  );
  assign("timezone", "timezone", args.input.timezone, existing.timezone);
  if (!changedFields.length) return toDto(existing);

  if (existing.state !== "PAUSED") data.state = "CONFIGURED";
  data.lastValidationStatus = "STALE";
  data.lastValidationSummary = "Configuration changed after the last validation.";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.integrationConnection.update({
      where: { id: existing.id },
      data,
      include: actorInclude,
    });
    const coverage = mappingCoverage(row);
    await tx.auditLog.create({
      data: auditData({
        actorUserId: args.actorUserId,
        connectionId: row.id,
        action: INTEGRATION_AUDIT_ACTIONS.UPDATED,
        details: safeIntegrationAuditDetails({
          changedFields: changedFields.filter((field) => !["credentialRef", "certificateRef"].includes(field)),
          state: row.state,
          mappingCoverage: `${coverage.complete}/${coverage.required}`,
          scheduleCadence: parseStoredJson(row.scheduleJson, scheduleMetadataSchema, {}).cadence ?? null,
          endpointConfigured: Object.keys(parseStoredJson(row.endpointJson, endpointMetadataSchema, {})).length > 0,
          credentialConfigured: Boolean(row.credentialRef),
          certificateConfigured: Boolean(row.certificateRef),
        }),
      }),
    });
    if (changedFields.includes("mapping")) {
      await tx.auditLog.create({
        data: auditData({
          actorUserId: args.actorUserId,
          connectionId: row.id,
          action: INTEGRATION_AUDIT_ACTIONS.MAPPING_UPDATED,
          details: safeIntegrationAuditDetails({ mappingCoverage: `${coverage.complete}/${coverage.required}` }),
        }),
      });
    }
    if (changedFields.includes("schedule") || changedFields.includes("timezone")) {
      await tx.auditLog.create({
        data: auditData({
          actorUserId: args.actorUserId,
          connectionId: row.id,
          action: INTEGRATION_AUDIT_ACTIONS.SCHEDULE_UPDATED,
          details: safeIntegrationAuditDetails({
            scheduleCadence:
              parseStoredJson(row.scheduleJson, scheduleMetadataSchema, {}).cadence ?? null,
          }),
        }),
      });
    }
    if (changedFields.includes("credentialRef") || changedFields.includes("certificateRef")) {
      await tx.auditLog.create({
        data: auditData({
          actorUserId: args.actorUserId,
          connectionId: row.id,
          action: INTEGRATION_AUDIT_ACTIONS.CREDENTIAL_REPLACED,
          details: safeIntegrationAuditDetails({
            credentialConfigured: Boolean(row.credentialRef),
            certificateConfigured: Boolean(row.certificateRef),
          }),
        }),
      });
    }
    return row;
  });
  return toDto(updated);
}

export async function validateStoredIntegrationConnection(args: {
  organisationId: string;
  connectionId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ connection: IntegrationConnectionDto; report: IntegrationConfigurationReport }> {
  const existing = await requireScopedConnection(args.organisationId, args.connectionId);
  if (existing.state === "ARCHIVED") throw new Error("Archived connections cannot be validated");
  const checkedAt = args.now ?? new Date();
  const report = await validateIntegrationConfiguration(existing, checkedAt);
  const nextState = existing.state === "PAUSED" ? "PAUSED" : deriveValidatedState(report);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.integrationConnection.update({
      where: { id: existing.id },
      data: {
        state: nextState,
        lastValidatedAt: checkedAt,
        lastValidationStatus: report.status,
        lastValidationSummary: report.summary,
        updatedByUserId: args.actorUserId,
      },
      include: actorInclude,
    });
    await tx.auditLog.create({
      data: auditData({
        actorUserId: args.actorUserId,
        connectionId: existing.id,
        action: INTEGRATION_AUDIT_ACTIONS.VALIDATED,
        details: safeIntegrationAuditDetails({
          previousState: existing.state,
          state: nextState,
          mappingCoverage: `${report.mappingComplete}/${report.mappingRequired}`,
          credentialConfigured: Boolean(existing.credentialRef),
          certificateConfigured: Boolean(existing.certificateRef),
          validationStatus: report.status,
          validationIssueCount: report.checks.filter((check) => ["FAIL", "WARNING"].includes(check.status)).length,
        }),
      }),
    });
    return updated;
  });
  return { connection: toDto(row), report };
}

export async function changeIntegrationConnectionState(args: {
  organisationId: string;
  connectionId: string;
  actorUserId: string;
  action: IntegrationConnectionAction;
}) {
  const existing = await requireScopedConnection(args.organisationId, args.connectionId);
  if (existing.state === "ARCHIVED") throw new Error("Archived connections cannot change state");
  let nextState: IntegrationConnectionState;
  if (args.action === "PAUSE") nextState = "PAUSED";
  else if (args.action === "RESUME") nextState = "CONFIGURED";
  else nextState = "ARCHIVED";
  if (args.action === "RESUME" && existing.state !== "PAUSED") {
    throw new Error("Only a paused connection can be resumed");
  }
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.integrationConnection.update({
      where: { id: existing.id },
      data: {
        state: nextState,
        archivedAt: nextState === "ARCHIVED" ? new Date() : null,
        updatedByUserId: args.actorUserId,
        ...(args.action === "RESUME"
          ? {
              lastValidationStatus: "STALE",
              lastValidationSummary: "Configuration must be validated again after resuming.",
            }
          : {}),
      },
      include: actorInclude,
    });
    await tx.auditLog.create({
      data: auditData({
        actorUserId: args.actorUserId,
        connectionId: existing.id,
        action: nextState === "ARCHIVED" ? INTEGRATION_AUDIT_ACTIONS.ARCHIVED : INTEGRATION_AUDIT_ACTIONS.STATE_CHANGED,
        details: safeIntegrationAuditDetails({ previousState: existing.state, state: nextState }),
      }),
    });
    return updated;
  });
  return toDto(row);
}
