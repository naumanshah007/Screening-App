import { hasPermission } from "@/lib/auth/permissions";

export type WizardAccessUser = {
  id?: string | null;
  role?: string | null;
} | null | undefined;

export function canUseManualPathway(user: WizardAccessUser): boolean {
  return Boolean(user?.id && hasPermission(user.role ?? undefined, "pathway:use"));
}

export function canAccessWizardSession(
  user: WizardAccessUser,
  createdById: string
): boolean {
  if (!canUseManualPathway(user)) return false;
  return user?.role === "ADMIN" || user?.id === createdById;
}
