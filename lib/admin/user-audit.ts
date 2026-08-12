import type { Prisma } from "@prisma/client";

import { demoProvenance } from "@/lib/config/demo-mode";

/**
 * Account-administration audit vocabulary.
 *
 * These are recorded as distinct actions rather than a generic UPDATE so that a
 * reviewer can answer "who reset whose password, and when" from the action
 * column alone, without parsing payload JSON.
 */
export const USER_AUDIT_ACTION = {
  USER_CREATED: "USER_CREATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_ENABLED: "USER_ENABLED",
  USER_DISABLED: "USER_DISABLED",
  PASSWORD_RESET_BY_ADMIN: "PASSWORD_RESET_BY_ADMIN",
  DEMO_PASSWORD_RESET: "DEMO_PASSWORD_RESET",
  PASSWORD_CHANGED_BY_USER: "PASSWORD_CHANGED_BY_USER",
} as const;

export type UserAuditAction =
  (typeof USER_AUDIT_ACTION)[keyof typeof USER_AUDIT_ACTION];

/**
 * Build the AuditLog row for an account-administration event.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * No plaintext password, no password hash, no token and no secret is ever
 * placed in `details`. Password events record only that a reset happened and
 * what policy flags resulted. Callers pass already-safe metadata; this helper
 * does not receive credential material at all, so it cannot leak it.
 */
export function buildUserAuditEntry(args: {
  action: UserAuditAction;
  actorUserId: string | null;
  targetUserId: string;
  reason?: string | null;
  details?: Record<string, unknown>;
}): Prisma.AuditLogUncheckedCreateInput {
  const provenance = demoProvenance();

  return {
    userId: args.actorUserId ?? undefined,
    action: args.action,
    entity: "User",
    entityId: args.targetUserId,
    newValue: JSON.stringify({
      targetUserId: args.targetUserId,
      actorUserId: args.actorUserId,
      environment: provenance.environment,
      demoMode: provenance.isDemo,
      reason: args.reason ?? null,
      ...(args.details ?? {}),
    }),
  };
}
