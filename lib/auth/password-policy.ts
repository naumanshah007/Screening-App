type PasswordLifecycleUser = {
  passwordChangeRequired?: boolean | null;
  passwordExpiresAt?: Date | null;
};

// 12 chars aligns with NIST SP 800-63B and HISO 10029 recommendations for health systems.
export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_ROTATION_DAYS = 90;
export const PASSWORD_ROTATION_WARNING_DAYS = 14;

export function computePasswordExpiresAt(from = new Date()) {
  return new Date(
    from.getTime() + PASSWORD_ROTATION_DAYS * 24 * 60 * 60 * 1000
  );
}

export function isPasswordExpired(
  passwordExpiresAt?: Date | null,
  now = new Date()
) {
  return Boolean(passwordExpiresAt && passwordExpiresAt <= now);
}

export function requiresPasswordUpdate(
  user: PasswordLifecycleUser,
  now = new Date()
) {
  return Boolean(user.passwordChangeRequired) || isPasswordExpired(user.passwordExpiresAt, now);
}

export function getPasswordLifecycleSummary(
  user: PasswordLifecycleUser,
  now = new Date()
) {
  if (Boolean(user.passwordChangeRequired)) {
    return {
      label: "Temporary password",
      detail: "User must set a personal password at next sign-in.",
      variant: "high" as const,
      requiresImmediateChange: true,
    };
  }

  if (isPasswordExpired(user.passwordExpiresAt, now)) {
    return {
      label: "Rotation overdue",
      detail: "Password has expired and must be changed before work continues.",
      variant: "urgent" as const,
      requiresImmediateChange: true,
    };
  }

  if (user.passwordExpiresAt) {
    const msRemaining = user.passwordExpiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    if (daysRemaining <= PASSWORD_ROTATION_WARNING_DAYS) {
      return {
        label: "Rotation due soon",
        detail: `Password should be rotated within ${Math.max(daysRemaining, 0)} day${Math.max(daysRemaining, 0) === 1 ? "" : "s"}.`,
        variant: "medium" as const,
        requiresImmediateChange: false,
      };
    }

    return {
      label: "Rotation scheduled",
      detail: `Password rotation is scheduled for ${user.passwordExpiresAt.toLocaleDateString("en-NZ")}.`,
      variant: "low" as const,
      requiresImmediateChange: false,
    };
  }

  return {
    label: "No rotation date",
    detail: "No password rotation date is recorded for this account yet.",
    variant: "default" as const,
    requiresImmediateChange: false,
  };
}
