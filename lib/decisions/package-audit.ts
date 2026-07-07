import type { BatchReviewDisposition } from "@prisma/client";

import type { DecisionPackageFormat } from "@/lib/decisions/package-generator";

export const DECISION_PACKAGE_AUDIT_ACTIONS = [
  "SIMULATED_PACKAGE_PREVIEW",
  "SIMULATED_PACKAGE_EXPORT",
] as const;

export type DecisionPackageAuditAction = (typeof DECISION_PACKAGE_AUDIT_ACTIONS)[number];
export type DecisionPackageAuditFormat = DecisionPackageFormat | "preview";

export type DecisionPackageAuditInput = {
  action: DecisionPackageAuditAction;
  actorUserId: string;
  batchReviewItemId: string;
  batchRunId: string;
  disposition: BatchReviewDisposition;
  format: DecisionPackageAuditFormat;
  timestamp: string;
};

export function extractDecisionPackageRequestMetadata(request?: Request | null) {
  const forwardedFor = request?.headers.get("x-forwarded-for") ?? "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;

  return {
    ipAddress,
    userAgent: request?.headers.get("user-agent") ?? null,
  };
}

export function buildDecisionPackageAuditPayload(input: DecisionPackageAuditInput) {
  const eventLabel =
    input.action === "SIMULATED_PACKAGE_PREVIEW"
      ? "Simulated export package preview"
      : "Simulated export package download";

  return {
    eventLabel,
    packageLabel: "Integration-ready preview",
    simulated: true,
    safetyNotice: "Demo environment. Not for direct clinical action.",
    actorUserId: input.actorUserId,
    batchReviewItemId: input.batchReviewItemId,
    batchRunId: input.batchRunId,
    format: input.format,
    disposition: input.disposition,
    timestamp: input.timestamp,
  };
}

export async function recordDecisionPackageAudit(args: DecisionPackageAuditInput & {
  request?: Request | null;
}) {
  const { prisma } = await import("@/lib/prisma");
  const { ipAddress, userAgent } = extractDecisionPackageRequestMetadata(args.request);
  const payload = buildDecisionPackageAuditPayload(args);

  return prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: args.action,
      entity: "DecisionPackage",
      entityId: args.batchReviewItemId,
      exportEvent: true,
      ipAddress,
      userAgent,
      newValue: JSON.stringify(payload),
    },
  });
}
