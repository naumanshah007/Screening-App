import { createHash, randomUUID } from "node:crypto";
import type { AuditSeverity, Prisma } from "@prisma/client";

import { sanitizeForLog } from "@/lib/security/safe-logging";
import { resolveRuntimeMode } from "@/lib/config/runtime-boundary";

export type ProtectedAuditInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  request?: Request | null;
  exportEvent?: boolean;
  severity?: AuditSeverity;
  correlationId?: string | null;
  sessionId?: string | null;
  createdAt?: Date;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

export function getAuditRequestMetadata(request?: Request | null) {
  if (!request) return { ipAddress: null, userAgent: null };
  const forwardedFor = request.headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function safeJson(value: unknown) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(sanitizeForLog(value));
}

/**
 * Builds append-only audit evidence for pilot-sensitive activity.
 *
 * The SHA-256 digest is corruption evidence, while database triggers prevent
 * ordinary application update/delete. A database owner can still bypass local
 * controls, so externally anchored/WORM evidence remains an explicit gate.
 */
export function buildProtectedAuditEntry(
  input: ProtectedAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const id = randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const protectionEnabled = !["DEVELOPMENT", "DEMO"].includes(
    resolveRuntimeMode().mode
  );
  const protectedAt = protectionEnabled ? new Date() : null;
  const requestMetadata = getAuditRequestMetadata(input.request);
  const oldValue = safeJson(input.oldValue);
  const newValue = safeJson(input.newValue);
  const evidence = {
    id,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    oldValue,
    newValue,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    exportEvent: Boolean(input.exportEvent),
    severity: input.severity ?? "INFO",
    correlationId: input.correlationId ?? null,
    sessionId: input.sessionId ?? null,
    createdAt: createdAt.toISOString(),
    protectedAt: protectedAt?.toISOString() ?? null,
  };
  const integrityDigest = protectionEnabled
    ? createHash("sha256").update(canonicalJson(evidence)).digest("hex")
    : null;

  return {
    ...evidence,
    createdAt,
    protectedAt: protectedAt ?? undefined,
    integrityDigest: integrityDigest ?? undefined,
    userId: evidence.userId ?? undefined,
    entityId: evidence.entityId ?? undefined,
    oldValue: oldValue ?? undefined,
    newValue: newValue ?? undefined,
    ipAddress: evidence.ipAddress ?? undefined,
    userAgent: evidence.userAgent ?? undefined,
    correlationId: evidence.correlationId ?? undefined,
    sessionId: evidence.sessionId ?? undefined,
  };
}

export function verifyProtectedAuditEntry(input: {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  exportEvent: boolean;
  severity: AuditSeverity;
  correlationId: string | null;
  sessionId: string | null;
  createdAt: Date;
  protectedAt: Date | null;
  integrityDigest: string | null;
}) {
  if (!input.protectedAt || !input.integrityDigest) return false;
  const evidence = {
    id: input.id,
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    exportEvent: input.exportEvent,
    severity: input.severity,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    createdAt: input.createdAt.toISOString(),
    protectedAt: input.protectedAt.toISOString(),
  };
  const actual = createHash("sha256")
    .update(canonicalJson(evidence))
    .digest("hex");
  return actual === input.integrityDigest;
}
