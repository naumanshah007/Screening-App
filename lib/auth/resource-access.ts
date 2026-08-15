import type { Prisma, UserRole } from "@prisma/client";

import { hasPermission, type Permission } from "@/lib/auth/permissions";

export type ResourceActor = {
  id?: string | null;
  role?: UserRole | string | null;
  gpPracticeId?: string | null;
};

export function requirePermission(
  actor: ResourceActor | null | undefined,
  permission: Permission
) {
  if (!actor?.id) return { status: 401 as const, error: "Unauthorised" };
  if (!hasPermission(actor.role ?? undefined, permission)) {
    return { status: 403 as const, error: "Forbidden" };
  }
  return null;
}

/**
 * Patient object scope. GP identities are confined to their own configured
 * practice; operational/clinical roles with explicit permission may access the
 * pilot cohort. Integration administrators have no patient permission.
 */
export function buildPatientScope(
  actor: ResourceActor
): Prisma.PatientWhereInput {
  if (actor.role === "GP") {
    return actor.gpPracticeId
      ? { gpPracticeId: actor.gpPracticeId }
      : { id: "__gp_practice_scope_missing__" };
  }
  return {};
}

export function canAccessPatientObject(args: {
  actor: ResourceActor;
  patientGpPracticeId: string | null;
  permission: "patients:view" | "patients:edit";
}) {
  if (!args.actor.id || !hasPermission(args.actor.role ?? undefined, args.permission)) {
    return false;
  }
  if (args.actor.role !== "GP") return true;
  return Boolean(
    args.actor.gpPracticeId &&
      args.patientGpPracticeId === args.actor.gpPracticeId
  );
}

export function resolvePatientCreatePractice(args: {
  actor: ResourceActor;
  requestedGpPracticeId?: string | null;
}) {
  if (args.actor.role === "GP") {
    if (!args.actor.gpPracticeId) return null;
    if (
      args.requestedGpPracticeId &&
      args.requestedGpPracticeId !== args.actor.gpPracticeId
    ) {
      return null;
    }
    return args.actor.gpPracticeId;
  }
  return args.requestedGpPracticeId ?? null;
}
