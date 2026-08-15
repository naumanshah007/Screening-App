import { prisma } from "@/lib/prisma";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import { safeLogError } from "@/lib/security/safe-logging";

export const SECURITY_EVENT_ENTITY = "SecurityEvent";

export const SECURITY_EVENT_ACTION = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED_UNKNOWN_USER: "LOGIN_FAILED_UNKNOWN_USER",
  LOGIN_FAILED_PASSWORD: "LOGIN_FAILED_PASSWORD",
  LOGIN_BLOCKED_LOCKED: "LOGIN_BLOCKED_LOCKED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGIN_FAILED_2FA: "LOGIN_FAILED_2FA",
  RECOVERY_CODE_FAILED: "RECOVERY_CODE_FAILED",
  RECOVERY_CODE_USED: "RECOVERY_CODE_USED",
  SESSION_REVOKED: "SESSION_REVOKED",
  SESSION_INVALIDATED: "SESSION_INVALIDATED",
  LOGOUT: "LOGOUT",
} as const;

type SecurityEventAction =
  (typeof SECURITY_EVENT_ACTION)[keyof typeof SECURITY_EVENT_ACTION];

export async function recordSecurityEvent(args: {
  action: SecurityEventAction;
  userId?: string | null;
  entityId?: string | null;
  request?: Request | null;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: buildProtectedAuditEntry({
        userId: args.userId ?? null,
        action: args.action,
        entity: SECURITY_EVENT_ENTITY,
        entityId: args.entityId ?? args.userId ?? null,
        newValue: args.details,
        request: args.request,
        severity:
          args.action === SECURITY_EVENT_ACTION.LOGIN_SUCCESS ||
          args.action === SECURITY_EVENT_ACTION.LOGOUT
            ? "INFO"
            : "WARN",
      }),
    });
  } catch (error) {
    safeLogError("security.audit.write_failed", error, {
      action: args.action,
      entity: SECURITY_EVENT_ENTITY,
    });
  }
}
