import type {
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
} from "@prisma/client";

export type SecurityIncidentTimingState =
  | "RESOLVED"
  | "OVERDUE"
  | "DUE_SOON"
  | "ON_TRACK";

export function securityIncidentSeverityVariant(severity: SecurityIncidentSeverity) {
  switch (severity) {
    case "URGENT":
      return "urgent" as const;
    case "HIGH":
      return "high" as const;
    default:
      return "info" as const;
  }
}

export function securityIncidentStatusVariant(status: SecurityIncidentStatus) {
  switch (status) {
    case "OPEN":
      return "urgent" as const;
    case "ACKNOWLEDGED":
      return "high" as const;
    case "UNDER_REVIEW":
      return "info" as const;
    case "RESOLVED":
      return "low" as const;
  }
}

export function securityIncidentStatusLabel(status: SecurityIncidentStatus) {
  return status.replaceAll("_", " ");
}

export function getSecurityIncidentTargetHours(
  severity: SecurityIncidentSeverity
) {
  switch (severity) {
    case "URGENT":
      return 4;
    case "HIGH":
      return 24;
    case "INFO":
      return 72;
  }
}

export function getSecurityIncidentDueAt(
  severity: SecurityIncidentSeverity,
  from = new Date()
) {
  return new Date(
    from.getTime() + getSecurityIncidentTargetHours(severity) * 60 * 60 * 1000
  );
}

export function getSecurityIncidentTimingState(
  incident: {
    status: SecurityIncidentStatus;
    dueAt: Date | null;
  },
  now = new Date()
): SecurityIncidentTimingState {
  if (incident.status === "RESOLVED") {
    return "RESOLVED";
  }

  if (!incident.dueAt) {
    return "ON_TRACK";
  }

  if (incident.dueAt.getTime() < now.getTime()) {
    return "OVERDUE";
  }

  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  if (incident.dueAt.getTime() <= sixHoursFromNow.getTime()) {
    return "DUE_SOON";
  }

  return "ON_TRACK";
}

export function securityIncidentTimingVariant(
  state: SecurityIncidentTimingState
) {
  switch (state) {
    case "OVERDUE":
      return "urgent" as const;
    case "DUE_SOON":
      return "high" as const;
    case "RESOLVED":
      return "low" as const;
    case "ON_TRACK":
      return "default" as const;
  }
}

export function securityIncidentTimingLabel(incident: {
  status: SecurityIncidentStatus;
  dueAt: Date | null;
}) {
  const state = getSecurityIncidentTimingState(incident);
  if (state === "RESOLVED") {
    return "Resolved";
  }
  if (!incident.dueAt) {
    return "No due date";
  }
  if (state === "OVERDUE") {
    return "Overdue";
  }
  if (state === "DUE_SOON") {
    return "Due soon";
  }
  return "On track";
}
