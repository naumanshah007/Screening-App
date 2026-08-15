import { requiresTwoFactorForRole } from "@/lib/auth/two-factor-policy";

export const PRIVILEGED_REAUTH_HOURS = Number(
  process.env.PRIVILEGED_REAUTH_HOURS ?? 4
);

const REAUTH_WARNING_MINUTES = 30;

export type PilotSessionState = {
  valid: boolean;
  reason: "idle_timeout" | "reauth_required" | "missing_timestamp" | null;
};

export function evaluatePilotSession(args: {
  authenticatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  idleTimeoutMinutes: number;
  reauthMinutes: number;
  now?: Date;
}): PilotSessionState {
  const now = args.now ?? new Date();
  const authenticatedAt = args.authenticatedAt
    ? new Date(args.authenticatedAt)
    : null;
  const lastActivityAt = args.lastActivityAt
    ? new Date(args.lastActivityAt)
    : null;
  if (
    !authenticatedAt ||
    !lastActivityAt ||
    Number.isNaN(authenticatedAt.getTime()) ||
    Number.isNaN(lastActivityAt.getTime())
  ) {
    return { valid: false, reason: "missing_timestamp" };
  }

  if (
    now.getTime() - lastActivityAt.getTime() >
    args.idleTimeoutMinutes * 60 * 1000
  ) {
    return { valid: false, reason: "idle_timeout" };
  }

  if (
    now.getTime() - authenticatedAt.getTime() >
    args.reauthMinutes * 60 * 1000
  ) {
    return { valid: false, reason: "reauth_required" };
  }

  return { valid: true, reason: null };
}

export function requiresPrivilegedSessionRefresh(args: {
  role?: string | null;
  authenticatedAt?: string | Date | null;
  now?: Date;
}) {
  if (!requiresTwoFactorForRole(args.role)) {
    return false;
  }

  if (!args.authenticatedAt) {
    return true;
  }

  const now = args.now ?? new Date();
  const authenticatedAt =
    args.authenticatedAt instanceof Date
      ? args.authenticatedAt
      : new Date(args.authenticatedAt);

  if (Number.isNaN(authenticatedAt.getTime())) {
    return true;
  }

  return (
    now.getTime() - authenticatedAt.getTime() >
    PRIVILEGED_REAUTH_HOURS * 60 * 60 * 1000
  );
}

export function getSessionFreshnessSummary(args: {
  role?: string | null;
  authenticatedAt?: string | Date | null;
  now?: Date;
}) {
  if (!requiresTwoFactorForRole(args.role)) {
    return {
      label: "Standard session",
      detail: "This role uses the standard session window for everyday access.",
      variant: "default" as const,
      requiresReauth: false,
    };
  }

  if (requiresPrivilegedSessionRefresh(args)) {
    return {
      label: "Re-authentication required",
      detail: `Privileged sessions must be refreshed at least every ${PRIVILEGED_REAUTH_HOURS} hours.`,
      variant: "urgent" as const,
      requiresReauth: true,
    };
  }

  const authenticatedAt =
    args.authenticatedAt instanceof Date
      ? args.authenticatedAt
      : args.authenticatedAt
        ? new Date(args.authenticatedAt)
        : null;

  if (!authenticatedAt || Number.isNaN(authenticatedAt.getTime())) {
    return {
      label: "Privileged session",
      detail: `Privileged sessions must be refreshed at least every ${PRIVILEGED_REAUTH_HOURS} hours.`,
      variant: "high" as const,
      requiresReauth: false,
    };
  }

  const now = args.now ?? new Date();
  const msRemaining =
    PRIVILEGED_REAUTH_HOURS * 60 * 60 * 1000 -
    (now.getTime() - authenticatedAt.getTime());
  const minutesRemaining = Math.ceil(msRemaining / (60 * 1000));

  if (minutesRemaining <= REAUTH_WARNING_MINUTES) {
    return {
      label: "Re-auth soon",
      detail: `This privileged session should be refreshed within ${Math.max(minutesRemaining, 0)} minute${Math.max(minutesRemaining, 0) === 1 ? "" : "s"}.`,
      variant: "high" as const,
      requiresReauth: false,
    };
  }

  return {
    label: "Privileged session active",
    detail: `This privileged session remains valid until it reaches the ${PRIVILEGED_REAUTH_HOURS}-hour refresh window.`,
    variant: "low" as const,
    requiresReauth: false,
  };
}
