import { prisma } from "@/lib/prisma";

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
} as const;

type SecurityEventAction =
  (typeof SECURITY_EVENT_ACTION)[keyof typeof SECURITY_EVENT_ACTION];

function getRequestMetadata(request?: Request | null) {
  if (!request) {
    return {
      ipAddress: null,
      userAgent: null,
    };
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function recordSecurityEvent(args: {
  action: SecurityEventAction;
  userId?: string | null;
  entityId?: string | null;
  request?: Request | null;
  details?: Record<string, unknown>;
}) {
  try {
    const metadata = getRequestMetadata(args.request);

    await prisma.auditLog.create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entity: SECURITY_EVENT_ENTITY,
        entityId: args.entityId ?? args.userId ?? null,
        newValue: args.details ? JSON.stringify(args.details) : null,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to record security event", error);
  }
}
