/**
 * RBAC permission definitions for CerviGrade.
 *
 * Roles are defined in the Prisma UserRole enum.
 * Permissions map actions → allowed roles.
 * Route guards map URL prefixes → required roles.
 */

import type { UserRole } from "@prisma/client";

// ─── Permission actions ───────────────────────────────────────────────────────

export type Permission =
  // Case management
  | "cases:view"
  | "cases:create"
  | "cases:edit"
  | "cases:grade"
  | "cases:book"
  | "cases:smo_grade"        // SMO-only grading decisions
  // Documents & evidence
  | "documents:upload"
  | "documents:ingest"
  | "summary:generate"
  | "summary:approve"
  // Rules
  | "rules:view"
  | "rules:edit"
  | "rules:publish"
  // Analytics
  | "analytics:view"
  // Admin
  | "admin:users"
  | "admin:settings"
  // AI
  | "ai:recommend"
  // Integration
  | "integration:ncsr_pull";

// ─── Role → permissions mapping ───────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "cases:view", "cases:create", "cases:edit", "cases:grade", "cases:book", "cases:smo_grade",
    "documents:upload", "documents:ingest", "summary:generate", "summary:approve",
    "rules:view", "rules:edit", "rules:publish",
    "analytics:view",
    "admin:users", "admin:settings",
    "ai:recommend",
    "integration:ncsr_pull",
  ],
  SMO_REVIEWER: [
    "cases:view", "cases:grade", "cases:smo_grade", "cases:book",
    "documents:upload", "summary:generate", "summary:approve",
    "rules:view",
    "analytics:view",
    "ai:recommend",
    "integration:ncsr_pull",
  ],
  COLPOSCOPIST: [
    "cases:view", "cases:create", "cases:edit", "cases:grade", "cases:book",
    "documents:upload", "documents:ingest", "summary:generate", "summary:approve",
    "rules:view",
    "analytics:view",
    "ai:recommend",
  ],
  COLPO_CNS: [
    "cases:view", "cases:create", "cases:edit", "cases:book",
    "documents:upload", "documents:ingest", "summary:generate",
    "rules:view",
    "analytics:view",
    "ai:recommend",
    "integration:ncsr_pull",
  ],
  GYNAE_GRADER: [
    "cases:view", "cases:create", "cases:edit", "cases:grade", "cases:book",
    "documents:upload", "documents:ingest", "summary:generate", "summary:approve",
    "rules:view",
    "analytics:view",
    "ai:recommend",
  ],
  COORDINATOR: [
    "cases:view", "cases:create", "cases:edit", "cases:book",
    "documents:upload",
    "analytics:view",
  ],
  GP: [
    "cases:view",
    "documents:upload",
  ],
  INTEGRATION_ADMIN: [
    "cases:view",
    "rules:view",
    "analytics:view",
    "admin:settings",
    "integration:ncsr_pull",
  ],
};

// ─── Route guards — prefix → minimum required roles ───────────────────────────
// Listed from most-specific to least-specific.

type RouteGuard = {
  prefix: string;
  requiredRoles: UserRole[];
  description: string;
};

const DEFAULT_APP_ROUTE_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/dashboard",
  SMO_REVIEWER: "/dashboard",
  COLPOSCOPIST: "/dashboard",
  COLPO_CNS: "/dashboard",
  GYNAE_GRADER: "/dashboard",
  COORDINATOR: "/dashboard",
  GP: "/dashboard",
  INTEGRATION_ADMIN: "/admin",
};

export const ROUTE_GUARDS: RouteGuard[] = [
  {
    prefix: "/readiness",
    requiredRoles: ["ADMIN", "INTEGRATION_ADMIN", "SMO_REVIEWER", "COLPOSCOPIST", "COLPO_CNS", "GYNAE_GRADER", "COORDINATOR"],
    description: "Launch readiness",
  },
  {
    prefix: "/audit",
    requiredRoles: ["ADMIN", "INTEGRATION_ADMIN"],
    description: "Audit investigation",
  },
  {
    prefix: "/admin",
    requiredRoles: ["ADMIN", "INTEGRATION_ADMIN"],
    description: "System administration",
  },
  {
    prefix: "/rules",
    requiredRoles: ["ADMIN", "SMO_REVIEWER", "COLPOSCOPIST", "GYNAE_GRADER", "COLPO_CNS", "COORDINATOR"],
    description: "Rule management",
  },
  {
    prefix: "/analytics",
    requiredRoles: ["ADMIN", "SMO_REVIEWER", "COLPOSCOPIST", "GYNAE_GRADER", "COLPO_CNS", "COORDINATOR", "INTEGRATION_ADMIN"],
    description: "Analytics dashboard",
  },
  {
    prefix: "/cases",
    requiredRoles: ["ADMIN", "SMO_REVIEWER", "COLPOSCOPIST", "GYNAE_GRADER", "COLPO_CNS", "COORDINATOR"],
    description: "Case management",
  },
  {
    prefix: "/coordinator",
    requiredRoles: ["ADMIN", "COORDINATOR", "COLPO_CNS", "COLPOSCOPIST", "GYNAE_GRADER", "SMO_REVIEWER"],
    description: "Coordinator queue",
  },
  {
    prefix: "/dashboard",
    requiredRoles: ["ADMIN", "SMO_REVIEWER", "COLPOSCOPIST", "GYNAE_GRADER", "COLPO_CNS", "COORDINATOR", "GP"],
    description: "Dashboard",
  },
];

// ─── Permission helpers ───────────────────────────────────────────────────────

export function hasPermission(role: UserRole | string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as UserRole];
  return perms?.includes(permission) ?? false;
}

export function hasAnyRole(role: UserRole | string | undefined, roles: UserRole[]): boolean {
  if (!role) return false;
  return roles.includes(role as UserRole);
}

export function getRouteGuard(pathname: string): RouteGuard | null {
  return ROUTE_GUARDS.find((g) => pathname.startsWith(g.prefix)) ?? null;
}

export function isAuthorizedForRoute(pathname: string, role: UserRole | string | undefined): boolean {
  const guard = getRouteGuard(pathname);
  if (!guard) return true; // no guard = public
  return hasAnyRole(role, guard.requiredRoles);
}

/** Returns all permissions for a given role */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getDefaultAppRouteForRole(
  role: UserRole | string | undefined
): string {
  if (!role) {
    return "/dashboard";
  }

  return DEFAULT_APP_ROUTE_BY_ROLE[role as UserRole] ?? "/dashboard";
}
