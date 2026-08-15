import type { IntegrationConnection, IntegrationConnectivityCheck, Prisma } from "@prisma/client";

import { endpointMetadataSchema, parseStoredJson } from "@/lib/integrations/connection-schema";
import {
  testIntegrationConnectivity,
  type ConnectivityDiagnostic,
  type ConnectivityTestDependencies,
} from "@/lib/integrations/connectivity-test";
import { prisma } from "@/lib/prisma";

export const CONNECTIVITY_AUDIT_ACTIONS = {
  INITIATED: "INTEGRATION_LIVE_TEST_INITIATED",
  PASSED: "INTEGRATION_LIVE_TEST_PASSED",
  FAILED: "INTEGRATION_LIVE_TEST_FAILED",
  NOT_TESTED: "INTEGRATION_LIVE_TEST_NOT_TESTED",
  CREDENTIAL_RESOLUTION_FAILED: "INTEGRATION_CREDENTIAL_REFERENCE_RESOLUTION_FAILED",
  POLICY_BLOCKED: "INTEGRATION_OUTBOUND_POLICY_BLOCKED",
} as const;

export type IntegrationConnectivityCheckDto = {
  id: string;
  startedAt: string;
  completedAt: string;
  status: string;
  networkStatus: string;
  tlsStatus: string;
  authenticationStatus: string;
  protocolStatus: string;
  httpStatus: number | null;
  latencyMs: number | null;
  safeSummary: string;
  endpointHostname: string | null;
  connectorType: string;
  environment: string;
  performedBy: string;
  ageLabel: string;
  stale: boolean;
  readyForPilotTest: boolean;
  diagnostics: ConnectivityDiagnostic[];
};

export type LiveTestAvailability = {
  available: boolean;
  reason: string;
};

type CheckWithPerformer = IntegrationConnectivityCheck & {
  performedBy: { name: string | null; email: string };
};

function staleHours() {
  const parsed = Number.parseInt(process.env.INTEGRATION_CONNECTIVITY_STALE_HOURS ?? "72", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

function ageLabel(completedAt: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - completedAt.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function safeStoredDetails(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      diagnostics?: unknown;
      readyForPilotTest?: unknown;
    };
    const diagnostics = Array.isArray(parsed.diagnostics)
      ? parsed.diagnostics.filter((entry): entry is ConnectivityDiagnostic => {
          if (!entry || typeof entry !== "object") return false;
          const row = entry as Partial<ConnectivityDiagnostic>;
          return [row.key, row.label, row.status, row.value, row.detail].every((item) => typeof item === "string");
        })
      : [];
    return { diagnostics, readyForPilotTest: parsed.readyForPilotTest === true };
  } catch {
    return { diagnostics: [], readyForPilotTest: false };
  }
}

export function toConnectivityCheckDto(
  row: CheckWithPerformer,
  now = new Date()
): IntegrationConnectivityCheckDto {
  const details = safeStoredDetails(row.safeDetailsJson);
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    status: row.status,
    networkStatus: row.networkStatus,
    tlsStatus: row.tlsStatus,
    authenticationStatus: row.authenticationStatus,
    protocolStatus: row.protocolStatus,
    httpStatus: row.httpStatus,
    latencyMs: row.latencyMs,
    safeSummary: row.safeSummary,
    endpointHostname: row.endpointHostname,
    connectorType: row.connectorType,
    environment: row.environment,
    performedBy: row.performedBy.name ?? row.performedBy.email,
    ageLabel: ageLabel(row.completedAt, now),
    stale: now.getTime() - row.completedAt.getTime() > staleHours() * 60 * 60 * 1000,
    readyForPilotTest: details.readyForPilotTest,
    diagnostics: details.diagnostics,
  };
}

export function getLiveTestAvailability(
  connection: Pick<IntegrationConnection, "connectorType" | "state" | "endpointJson" | "authMethod" | "credentialRef" | "lastValidationStatus">
): LiveTestAvailability {
  const endpoint = parseStoredJson(connection.endpointJson, endpointMetadataSchema, {});
  if (connection.connectorType === "HL7_V2_LAB") {
    return { available: false, reason: "MLLP receiver connection test unavailable — CerviGrade HL7 Gateway required." };
  }
  if (["PAUSED", "ARCHIVED"].includes(connection.state)) {
    return { available: false, reason: "Resume the connection before testing." };
  }
  if (connection.lastValidationStatus !== "PASSED") {
    return { available: false, reason: "Validate Configuration must pass first." };
  }
  if (connection.authMethod === "MUTUAL_TLS") {
    return { available: false, reason: "Configured; mTLS connection testing is not supported in this deployment." };
  }
  if (!endpoint.baseUrl) {
    return { available: false, reason: connection.connectorType === "SCREENING_REGISTER" ? "Awaiting authorised endpoint / integration contract." : "A configured HTTP endpoint is required." };
  }
  if (
    connection.connectorType === "SCREENING_REGISTER" &&
    (!endpoint.agreementReference || !endpoint.connectivityPath || !connection.credentialRef)
  ) {
    return { available: false, reason: "Awaiting authorised endpoint / integration contract." };
  }
  return { available: true, reason: "Ready for an explicit bounded connection test." };
}

export async function listConnectivityChecksForConnections(
  organisationId: string,
  connectionIds: string[],
  now = new Date()
) {
  if (!connectionIds.length) return new Map<string, IntegrationConnectivityCheckDto[]>();
  const rows = await prisma.integrationConnectivityCheck.findMany({
    where: { organisationId, integrationConnectionId: { in: connectionIds } },
    include: { performedBy: { select: { name: true, email: true } } },
    orderBy: { completedAt: "desc" },
    take: Math.min(500, connectionIds.length * 20),
  });
  const byConnection = new Map<string, IntegrationConnectivityCheckDto[]>();
  for (const row of rows) {
    const current = byConnection.get(row.integrationConnectionId) ?? [];
    if (current.length < 10) {
      current.push(toConnectivityCheckDto(row, now));
      byConnection.set(row.integrationConnectionId, current);
    }
  }
  return byConnection;
}

/** Latest evidence only for fast connection-card rendering. */
export async function listLatestConnectivityChecksForConnections(
  organisationId: string,
  connectionIds: string[],
  now = new Date()
) {
  const latest = new Map<string, IntegrationConnectivityCheckDto>();
  if (!connectionIds.length) return latest;

  const timestamps = await prisma.integrationConnectivityCheck.groupBy({
    by: ["integrationConnectionId"],
    where: { organisationId, integrationConnectionId: { in: connectionIds } },
    _max: { completedAt: true },
  });
  const pairs = timestamps.flatMap((row) =>
    row._max.completedAt
      ? [{
          integrationConnectionId: row.integrationConnectionId,
          completedAt: row._max.completedAt,
        }]
      : []
  );
  if (!pairs.length) return latest;

  const rows = await prisma.integrationConnectivityCheck.findMany({
    where: { organisationId, OR: pairs },
    include: { performedBy: { select: { name: true, email: true } } },
    orderBy: { completedAt: "desc" },
  });
  for (const row of rows) {
    if (!latest.has(row.integrationConnectionId)) {
      latest.set(row.integrationConnectionId, toConnectivityCheckDto(row, now));
    }
  }
  return latest;
}

function safeAuditDetails(details: {
  connectorType: string;
  environment: string;
  endpointHostname?: string;
  status?: string;
  networkStatus?: string;
  tlsStatus?: string;
  authenticationStatus?: string;
  protocolStatus?: string;
  httpStatus?: number;
  latencyMs?: number;
}) {
  return {
    connectorType: details.connectorType,
    environment: details.environment,
    ...(details.endpointHostname ? { endpointHostname: details.endpointHostname } : {}),
    ...(details.status ? { status: details.status } : {}),
    ...(details.networkStatus ? { networkStatus: details.networkStatus } : {}),
    ...(details.tlsStatus ? { tlsStatus: details.tlsStatus } : {}),
    ...(details.authenticationStatus ? { authenticationStatus: details.authenticationStatus } : {}),
    ...(details.protocolStatus ? { protocolStatus: details.protocolStatus } : {}),
    ...(details.httpStatus !== undefined ? { httpStatus: details.httpStatus } : {}),
    ...(details.latencyMs !== undefined ? { latencyMs: details.latencyMs } : {}),
  };
}

function auditRow(args: {
  actorUserId: string;
  connectionId: string;
  action: string;
  details: ReturnType<typeof safeAuditDetails>;
}): Prisma.AuditLogCreateInput {
  return {
    user: { connect: { id: args.actorUserId } },
    action: args.action,
    entity: "IntegrationConnection",
    entityId: args.connectionId,
    severity: args.action === CONNECTIVITY_AUDIT_ACTIONS.PASSED || args.action === CONNECTIVITY_AUDIT_ACTIONS.INITIATED ? "INFO" : "WARN",
    newValue: JSON.stringify(args.details),
  };
}

export async function runStoredConnectivityCheck(args: {
  organisationId: string;
  connectionId: string;
  actorUserId: string;
  now?: () => Date;
  dependencies?: ConnectivityTestDependencies;
}) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: args.connectionId, organisationId: args.organisationId },
  });
  if (!connection) throw new Error("Integration connection not found for this organisation");
  const startedAt = args.now?.() ?? new Date();

  await prisma.auditLog.create({
    data: auditRow({
      actorUserId: args.actorUserId,
      connectionId: connection.id,
      action: CONNECTIVITY_AUDIT_ACTIONS.INITIATED,
      details: safeAuditDetails({
        connectorType: connection.connectorType,
        environment: connection.environment,
      }),
    }),
  });

  const result = await testIntegrationConnectivity(connection, args.dependencies);
  const completedAt = args.now?.() ?? new Date();
  const finalAction = result.auditCategory === "POLICY_BLOCKED"
    ? CONNECTIVITY_AUDIT_ACTIONS.POLICY_BLOCKED
    : result.auditCategory === "CREDENTIAL_RESOLUTION_FAILED"
      ? CONNECTIVITY_AUDIT_ACTIONS.CREDENTIAL_RESOLUTION_FAILED
      : result.status === "PASSED"
        ? CONNECTIVITY_AUDIT_ACTIONS.PASSED
        : result.status === "FAILED"
          ? CONNECTIVITY_AUDIT_ACTIONS.FAILED
          : CONNECTIVITY_AUDIT_ACTIONS.NOT_TESTED;
  const finalHostname = result.endpointHostname;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.integrationConnectivityCheck.create({
      data: {
        organisationId: args.organisationId,
        integrationConnectionId: connection.id,
        startedAt,
        completedAt,
        status: result.status,
        networkStatus: result.networkStatus,
        tlsStatus: result.tlsStatus,
        authenticationStatus: result.authenticationStatus,
        protocolStatus: result.protocolStatus,
        httpStatus: result.httpStatus ?? null,
        latencyMs: result.latencyMs ?? null,
        safeSummary: result.safeSummary,
        safeDetailsJson: JSON.stringify({
          ...result.safeDetails,
          readyForPilotTest: result.readyForPilotTest,
          diagnostics: result.diagnostics,
        }),
        endpointHostname: finalHostname ?? null,
        connectorType: connection.connectorType,
        environment: connection.environment,
        performedByUserId: args.actorUserId,
      },
      include: { performedBy: { select: { name: true, email: true } } },
    });
    await tx.auditLog.create({
      data: auditRow({
        actorUserId: args.actorUserId,
        connectionId: connection.id,
        action: finalAction,
        details: safeAuditDetails({
          connectorType: connection.connectorType,
          environment: connection.environment,
          ...(finalHostname ? { endpointHostname: finalHostname } : {}),
          status: result.status,
          networkStatus: result.networkStatus,
          tlsStatus: result.tlsStatus,
          authenticationStatus: result.authenticationStatus,
          protocolStatus: result.protocolStatus,
          ...(result.httpStatus !== undefined ? { httpStatus: result.httpStatus } : {}),
          ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
        }),
      }),
    });
    return created;
  });

  return { result, check: toConnectivityCheckDto(row, completedAt) };
}
