import type {
  Prisma,
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
  UserRole,
} from "@prisma/client";

import { sendSecurityIncidentNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  getSecurityIncidentDueAt,
  getSecurityIncidentTimingState,
} from "@/lib/security/incident-shared";

const INCIDENT_MANAGER_ROLES: UserRole[] = ["ADMIN", "INTEGRATION_ADMIN"];

export const SECURITY_INCIDENT_ENTITY = "SecurityIncident";

export type SecurityIncidentRecord = Prisma.SecurityIncidentGetPayload<{
  include: {
    openedBy: { select: { name: true; email: true; role: true } };
    assignedTo: { select: { id: true; name: true; email: true; role: true } };
  };
}>;

export type SecurityIncidentAssignee = Awaited<
  ReturnType<typeof listSecurityIncidentAssignees>
>[number];

type SecurityIncidentUpdateInput = {
  status?: SecurityIncidentStatus;
  assignedToUserId?: string | null;
  dueAt?: Date | null;
  resolutionNotes?: string | null;
};

export function canManageSecurityIncidents(role?: string) {
  return role === "ADMIN" || role === "INTEGRATION_ADMIN";
}

export async function listSecurityIncidentAssignees() {
  return prisma.user.findMany({
    where: {
      role: {
        in: INCIDENT_MANAGER_ROLES,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
}

export async function getSecurityIncidentOverview() {
  const [incidents, assignees] = await Promise.all([
    prisma.securityIncident.findMany({
      include: {
        openedBy: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    listSecurityIncidentAssignees(),
  ]);

  const orderedIncidents = [...incidents].sort((left, right) => {
    const leftResolved = left.status === "RESOLVED";
    const rightResolved = right.status === "RESOLVED";
    if (leftResolved !== rightResolved) {
      return leftResolved ? 1 : -1;
    }

    const timingRank = (incident: SecurityIncidentRecord) => {
      const state = getSecurityIncidentTimingState(incident);
      switch (state) {
        case "OVERDUE":
          return 0;
        case "DUE_SOON":
          return 1;
        case "ON_TRACK":
          return 2;
        case "RESOLVED":
          return 3;
      }
    };

    const rankDiff = timingRank(left) - timingRank(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    if (left.dueAt && right.dueAt) {
      return left.dueAt.getTime() - right.dueAt.getTime();
    }
    if (left.dueAt) {
      return -1;
    }
    if (right.dueAt) {
      return 1;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const counts = orderedIncidents.reduce(
    (summary, incident) => {
      summary.total += 1;
      if (incident.status === "RESOLVED") {
        summary.resolved += 1;
      } else {
        summary.open += 1;
      }
      if (incident.status === "ACKNOWLEDGED") {
        summary.acknowledged += 1;
      }
      if (incident.status === "UNDER_REVIEW") {
        summary.underReview += 1;
      }
      if (!incident.assignedToUserId && incident.status !== "RESOLVED") {
        summary.unassigned += 1;
      }
      const timingState = getSecurityIncidentTimingState(incident);
      if (timingState === "OVERDUE") {
        summary.overdue += 1;
      }
      if (timingState === "DUE_SOON") {
        summary.dueSoon += 1;
      }
      return summary;
    },
    {
      total: 0,
      open: 0,
      resolved: 0,
      acknowledged: 0,
      underReview: 0,
      unassigned: 0,
      overdue: 0,
      dueSoon: 0,
    }
  );

  return { incidents: orderedIncidents, assignees, counts };
}

function buildIncidentAuditPayload(incident: SecurityIncidentRecord) {
  return {
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    sourcePreset: incident.sourcePreset,
    sourceEntity: incident.sourceEntity,
    sourceAction: incident.sourceAction,
    sourceUserId: incident.sourceUserId,
    assignedToUserId: incident.assignedToUserId,
    dueAt: incident.dueAt?.toISOString() ?? null,
    lastReminderAt: incident.lastReminderAt?.toISOString() ?? null,
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    resolutionNotes: incident.resolutionNotes ?? null,
  };
}

export async function createSecurityIncident(input: {
  actorUserId: string;
  title: string;
  summary: string;
  severity: SecurityIncidentSeverity;
  sourcePreset?: string | null;
  sourceEntity?: string | null;
  sourceAction?: string | null;
  sourceUserId?: string | null;
  auditFilterJson?: string | null;
}) {
  const existing = await prisma.securityIncident.findFirst({
    where: {
      title: input.title.trim(),
      sourcePreset: input.sourcePreset ?? null,
      sourceEntity: input.sourceEntity ?? null,
      sourceAction: input.sourceAction ?? null,
      sourceUserId: input.sourceUserId ?? null,
      status: {
        not: "RESOLVED",
      },
    },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const incident = await prisma.securityIncident.create({
    data: {
      title: input.title.trim(),
      summary: input.summary.trim(),
      severity: input.severity,
      sourcePreset: input.sourcePreset ?? null,
      sourceEntity: input.sourceEntity ?? null,
      sourceAction: input.sourceAction ?? null,
      sourceUserId: input.sourceUserId ?? null,
      auditFilterJson: input.auditFilterJson ?? null,
      dueAt: getSecurityIncidentDueAt(input.severity),
      openedByUserId: input.actorUserId,
    },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: input.actorUserId,
      action: "CREATE",
      entity: SECURITY_INCIDENT_ENTITY,
      entityId: incident.id,
      newValue: JSON.stringify(buildIncidentAuditPayload(incident)),
    },
  });

  return incident;
}

export async function updateSecurityIncident(
  incidentId: string,
  actorUserId: string,
  input: SecurityIncidentUpdateInput
) {
  const existing = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Security incident not found");
  }

  const nextStatus = input.status ?? existing.status;
  const shouldAcknowledge =
    !existing.acknowledgedAt &&
    (nextStatus === "ACKNOWLEDGED" ||
      nextStatus === "UNDER_REVIEW" ||
      nextStatus === "RESOLVED");
  const resolvedAt =
    nextStatus === "RESOLVED" ? new Date() : null;

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: {
      status: nextStatus,
      assignedToUserId: input.assignedToUserId === undefined
        ? existing.assignedToUserId
        : input.assignedToUserId,
      dueAt:
        input.dueAt === undefined
          ? existing.dueAt
          : input.dueAt,
      resolutionNotes:
        input.resolutionNotes === undefined
          ? existing.resolutionNotes
          : input.resolutionNotes,
      acknowledgedAt: shouldAcknowledge
        ? new Date()
        : nextStatus === "OPEN"
          ? null
          : existing.acknowledgedAt,
      resolvedAt,
    },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "UPDATE",
      entity: SECURITY_INCIDENT_ENTITY,
      entityId: updated.id,
      oldValue: JSON.stringify(buildIncidentAuditPayload(existing)),
      newValue: JSON.stringify(buildIncidentAuditPayload(updated)),
    },
  });

  return updated;
}

export async function sendSecurityIncidentReminder(
  incidentId: string,
  actorUserId: string | null,
  options?: {
    automated?: boolean;
    reason?: "manual" | "due_soon" | "overdue";
  }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!incident) {
    throw new Error("Security incident not found");
  }

  const recipient =
    incident.assignedTo?.email ?? incident.openedBy.email ?? "security-team";

  await sendSecurityIncidentNotification({
    recipientEmail: recipient,
    recipientName: incident.assignedTo?.name ?? incident.openedBy.name,
    incidentTitle: incident.title,
    incidentSummary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    dueAt: incident.dueAt,
    reminderKind: options?.reason ?? "manual",
    referenceId: incident.id,
  });

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: {
      lastReminderAt: new Date(),
    },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: options?.automated
        ? options.reason === "overdue"
          ? "AUTO_REMINDER_OVERDUE"
          : "AUTO_REMINDER_DUE_SOON"
        : "REMINDER_SENT",
      entity: SECURITY_INCIDENT_ENTITY,
      entityId: incident.id,
      newValue: JSON.stringify({
        title: incident.title,
        recipient,
        dueAt: incident.dueAt?.toISOString() ?? null,
        reminderReason: options?.reason ?? "manual",
      }),
    },
  });

  return updated;
}
