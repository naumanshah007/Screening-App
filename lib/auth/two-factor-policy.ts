import type { UserRole } from "@prisma/client";

// MFA required for ALL clinical and administrative roles — not just senior clinicians.
// COORDINATOR manages referral queues and can book appointments; a compromised account
// could create false bookings or delay urgent referrals.
const TWO_FACTOR_REQUIRED_ROLES = new Set<UserRole>([
  "ADMIN",
  "INTEGRATION_ADMIN",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COORDINATOR",
  "GP",
]);

export function requiresTwoFactorForRole(role?: UserRole | string | null) {
  if (!role) {
    return false;
  }

  return TWO_FACTOR_REQUIRED_ROLES.has(role as UserRole);
}

export function requiresTwoFactorSetup(args: {
  role?: UserRole | string | null;
  twoFAEnabled?: boolean | null;
}) {
  return requiresTwoFactorForRole(args.role) && !Boolean(args.twoFAEnabled);
}
