import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  SECURITY_EVENT_ACTION,
  SECURITY_EVENT_ENTITY,
} from "@/lib/security/events";
import { buildAuditSearchParams, resolveAuditFilters } from "@/lib/security/audit-investigations";
import { getSecurityIncidentTimingState } from "@/lib/security/incident-shared";
import { requiresTwoFactorForRole } from "@/lib/auth/two-factor-policy";

const PRIVILEGED_ROLES: UserRole[] = [
  "ADMIN",
  "INTEGRATION_ADMIN",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
];

type SecurityRecentAuditLog = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { name: true; email: true; role: true } };
  };
}>;

function safeParseJson(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function describeSecurityEvent(log: SecurityRecentAuditLog) {
  const payload = safeParseJson(log.newValue);

  switch (log.entity) {
    case SECURITY_EVENT_ENTITY:
      switch (log.action) {
        case SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER:
          return "Unknown username or email was used in a sign-in attempt.";
        case SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD:
          return `Password sign-in failed${typeof payload?.failedAttempts === "number" ? ` after ${payload.failedAttempts} attempt${payload.failedAttempts === 1 ? "" : "s"}` : ""}.`;
        case SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED:
          return "Sign-in was blocked because the account is currently locked.";
        case SECURITY_EVENT_ACTION.LOGIN_LOCKED:
          return "Account lockout threshold was reached during sign-in.";
        case SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA:
          return "Authenticator verification failed or was missing.";
        case SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED:
          return "A recovery code was supplied but did not match any valid backup code.";
        case SECURITY_EVENT_ACTION.RECOVERY_CODE_USED:
          return `A one-time recovery code was used${typeof payload?.remainingCount === "number" ? `, leaving ${payload.remainingCount} remaining` : ""}.`;
        case SECURITY_EVENT_ACTION.LOGIN_SUCCESS:
          return `Sign-in succeeded${typeof payload?.method === "string" ? ` using ${String(payload.method).replaceAll("_", " ")}` : ""}.`;
        default:
          return "Security event recorded.";
      }
    case "UserPassword":
      return payload?.passwordReset
        ? "Administrator issued a temporary password reset."
        : "User updated their password.";
    case "User2FA":
      return payload?.reset
        ? "Administrator reset authenticator access for this account."
        : payload?.twoFAEnabled
          ? "Authenticator access was enabled."
          : "Two-factor setup state changed.";
    case "User2FARecoveryCode":
      return "A one-time recovery code was successfully consumed.";
    case "User2FARecoveryCodes":
      return "Recovery codes were generated or rotated.";
    default:
      return "Security-related audit event.";
  }
}

function eventBadgeVariant(log: SecurityRecentAuditLog) {
  if (
    log.action === SECURITY_EVENT_ACTION.LOGIN_LOCKED ||
    log.action === SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED
  ) {
    return "urgent" as const;
  }

  if (
    log.action === SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD ||
    log.action === SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA ||
    log.action === SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED ||
    log.action === SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER
  ) {
    return "high" as const;
  }

  if (
    log.action === SECURITY_EVENT_ACTION.RECOVERY_CODE_USED ||
    log.entity === "UserPassword" ||
    log.entity === "User2FA"
  ) {
    return "info" as const;
  }

  return "default" as const;
}

function eventLabel(log: SecurityRecentAuditLog) {
  if (log.entity !== SECURITY_EVENT_ENTITY) {
    switch (log.entity) {
      case "UserPassword":
        return "Password action";
      case "User2FA":
        return "2FA action";
      case "User2FARecoveryCode":
        return "Recovery code used";
      case "User2FARecoveryCodes":
        return "Recovery codes rotated";
      default:
        return log.entity;
    }
  }

  switch (log.action) {
    case SECURITY_EVENT_ACTION.LOGIN_SUCCESS:
      return "Login success";
    case SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER:
      return "Unknown user";
    case SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD:
      return "Bad password";
    case SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED:
      return "Blocked by lockout";
    case SECURITY_EVENT_ACTION.LOGIN_LOCKED:
      return "Account locked";
    case SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA:
      return "2FA failure";
    case SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED:
      return "Recovery code failure";
    case SECURITY_EVENT_ACTION.RECOVERY_CODE_USED:
      return "Recovery code used";
    default:
      return log.action;
  }
}

export async function getSecurityAnalyticsSummary() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [failedLogin24h, lockedEvents7d, invalidRecovery7d, privilegedSignIns24h, lockedAccountsNow, privilegedWithout2FA, openIncidents, unassignedIncidents, incidentTimingRows, atRiskUsers, recentSecurityLogs] =
    await Promise.all([
      prisma.auditLog.count({
        where: {
          entity: SECURITY_EVENT_ENTITY,
          action: {
            in: [
              SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER,
              SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD,
              SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA,
              SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED,
            ],
          },
          createdAt: { gte: last24Hours },
        },
      }),
      prisma.auditLog.count({
        where: {
          entity: SECURITY_EVENT_ENTITY,
          action: {
            in: [
              SECURITY_EVENT_ACTION.LOGIN_LOCKED,
              SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
            ],
          },
          createdAt: { gte: last7Days },
        },
      }),
      prisma.auditLog.count({
        where: {
          entity: SECURITY_EVENT_ENTITY,
          action: SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED,
          createdAt: { gte: last7Days },
        },
      }),
      prisma.auditLog.count({
        where: {
          entity: SECURITY_EVENT_ENTITY,
          action: SECURITY_EVENT_ACTION.LOGIN_SUCCESS,
          createdAt: { gte: last24Hours },
          user: {
            role: {
              in: PRIVILEGED_ROLES,
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          lockedUntil: {
            gt: now,
          },
        },
      }),
      prisma.user.count({
        where: {
          role: {
            in: PRIVILEGED_ROLES,
          },
          twoFAEnabled: false,
        },
      }),
      prisma.securityIncident.count({
        where: {
          status: {
            not: "RESOLVED",
          },
        },
      }),
      prisma.securityIncident.count({
        where: {
          status: {
            not: "RESOLVED",
          },
          assignedToUserId: null,
        },
      }),
      prisma.securityIncident.findMany({
        where: {
          status: {
            not: "RESOLVED",
          },
        },
        select: {
          dueAt: true,
          status: true,
        },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            {
              lockedUntil: {
                gt: now,
              },
            },
            {
              failedAttempts: {
                gt: 0,
              },
            },
            {
              role: {
                in: PRIVILEGED_ROLES,
              },
              twoFAEnabled: false,
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          failedAttempts: true,
          lockedUntil: true,
          twoFAEnabled: true,
        },
        orderBy: [{ lockedUntil: "desc" }, { failedAttempts: "desc" }, { email: "asc" }],
        take: 8,
      }),
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: last7Days },
          OR: [
            { entity: SECURITY_EVENT_ENTITY },
            { entity: "UserPassword" },
            { entity: "User2FA" },
            { entity: "User2FARecoveryCode" },
            { entity: "User2FARecoveryCodes" },
          ],
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 14,
      }),
    ]);

  const passwordResets7d = recentSecurityLogs.filter((log) => {
    if (log.entity !== "UserPassword") return false;
    const payload = safeParseJson(log.newValue);
    return payload?.passwordReset === true;
  }).length;

  const twoFactorResets7d = recentSecurityLogs.filter((log) => {
    if (log.entity !== "User2FA") return false;
    const payload = safeParseJson(log.newValue);
    return payload?.reset === true;
  }).length;

  const failedSignInHref = `/audit?${buildAuditSearchParams(
    resolveAuditFilters({ preset: "failed-sign-ins", days: "7" }),
    { preset: "failed-sign-ins", page: 1 }
  ).toString()}`;
  const lockedAccountsHref = `/audit?${buildAuditSearchParams(
    resolveAuditFilters({ preset: "locked-accounts", days: "30" }),
    { preset: "locked-accounts", page: 1 }
  ).toString()}`;
  const credentialRecoveryHref = `/audit?${buildAuditSearchParams(
    resolveAuditFilters({ preset: "credential-recovery", days: "30" }),
    { preset: "credential-recovery", page: 1 }
  ).toString()}`;
  const overdueIncidents = incidentTimingRows.filter(
    (incident) => getSecurityIncidentTimingState(incident) === "OVERDUE"
  ).length;
  const dueSoonIncidents = incidentTimingRows.filter(
    (incident) => getSecurityIncidentTimingState(incident) === "DUE_SOON"
  ).length;
  const alerts: Array<{
    severity: "urgent" | "high" | "info";
    title: string;
    detail: string;
    auditHref?: string;
    actionLabel?: string;
  }> = [];

  if (lockedAccountsNow > 0) {
    alerts.push({
      severity: "urgent",
      title: "Accounts currently locked",
      detail: `${lockedAccountsNow} account${lockedAccountsNow === 1 ? " is" : "s are"} locked right now and may need review or recovery support.`,
      auditHref: lockedAccountsHref,
    });
  }

  if (overdueIncidents > 0) {
    alerts.push({
      severity: "urgent",
      title: "Security incidents overdue",
      detail: `${overdueIncidents} open security incident${overdueIncidents === 1 ? " is" : "s are"} past the response target and need follow-up.`,
      auditHref: "/admin#security-incidents",
      actionLabel: "Open incident queue",
    });
  }

  if (failedLogin24h >= 5) {
    alerts.push({
      severity: "high",
      title: "Raised failed sign-in volume",
      detail: `${failedLogin24h} failed sign-in event${failedLogin24h === 1 ? "" : "s"} were recorded in the last 24 hours.`,
      auditHref: failedSignInHref,
    });
  }

  if (invalidRecovery7d > 0) {
    alerts.push({
      severity: "high",
      title: "Recovery code failures detected",
      detail: `${invalidRecovery7d} invalid recovery-code attempt${invalidRecovery7d === 1 ? "" : "s"} occurred in the last 7 days.`,
      auditHref: failedSignInHref,
    });
  }

  if (privilegedWithout2FA > 0) {
    alerts.push({
      severity: "high",
      title: "Privileged users still missing 2FA",
      detail: `${privilegedWithout2FA} privileged account${privilegedWithout2FA === 1 ? "" : "s"} still need authenticator enrollment.`,
    });
  }

  if (passwordResets7d + twoFactorResets7d > 0) {
    alerts.push({
      severity: "info",
      title: "Admin credential recovery activity",
      detail: `${passwordResets7d} password reset${passwordResets7d === 1 ? "" : "s"} and ${twoFactorResets7d} 2FA reset${twoFactorResets7d === 1 ? "" : "s"} were issued in the last 7 days.`,
      auditHref: credentialRecoveryHref,
    });
  }

  return {
    counts: {
      failedLogin24h,
      lockedEvents7d,
      invalidRecovery7d,
      passwordResets7d,
      twoFactorResets7d,
      privilegedSignIns24h,
      lockedAccountsNow,
      privilegedWithout2FA,
      openIncidents,
      unassignedIncidents,
      overdueIncidents,
      dueSoonIncidents,
    },
    alerts,
    atRiskUsers: atRiskUsers.map((user) => ({
      ...user,
      twoFactorRequired: requiresTwoFactorForRole(user.role),
    })),
    recentEvents: recentSecurityLogs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      entity: log.entity,
      actorName: log.user?.name ?? log.user?.email ?? "System",
      actorRole: log.user?.role ?? null,
      label: eventLabel(log),
      description: describeSecurityEvent(log),
      variant: eventBadgeVariant(log),
    })),
  };
}
