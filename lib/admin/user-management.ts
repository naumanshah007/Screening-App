import type { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  computePasswordExpiresAt,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy";
import { assertDemoModeEnabled, getDemoPassword } from "@/lib/config/demo-mode";
import { buildUserAuditEntry, USER_AUDIT_ACTION } from "@/lib/admin/user-audit";
import { prisma } from "@/lib/prisma";

const adminUserInclude = {
  gpPractice: {
    select: {
      id: true,
      name: true,
      hpiNumber: true,
    },
  },
} satisfies Prisma.UserInclude;

export type AdminUserRecord = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

export async function listAdminUsers() {
  return prisma.user.findMany({
    include: adminUserInclude,
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
  });
}

export async function createUserAccount(args: {
  name?: string | null;
  email: string;
  role: UserRole;
  gpPracticeId?: string | null;
  password: string;
  createdByUserId: string;
}) {
  const normalizedEmail = args.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (args.password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Initial password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  if (args.gpPracticeId) {
    const practice = await prisma.gPPractice.findUnique({
      where: { id: args.gpPracticeId },
      select: { id: true },
    });

    if (!practice) {
      throw new Error("Selected practice was not found");
    }
  }

  const passwordHash = await bcrypt.hash(args.password, 10);

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: args.name?.trim() || null,
        email: normalizedEmail,
        role: args.role,
        gpPracticeId: args.gpPracticeId || null,
        passwordHash,
        passwordChangeRequired: true,
        passwordChangedAt: null,
        passwordExpiresAt: null,
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: buildUserAuditEntry({
        action: USER_AUDIT_ACTION.USER_CREATED,
        actorUserId: args.createdByUserId,
        targetUserId: user.id,
        details: {
          email: user.email,
          role: user.role,
          gpPracticeId: user.gpPracticeId,
        },
      }),
    });

    return user;
  });

  return createdUser;
}

export async function updateUserAccess(args: {
  targetUserId: string;
  changedByUserId: string;
  role?: UserRole;
  unlockAccount?: boolean;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      failedAttempts: true,
      lockedUntil: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  const updateData: Prisma.UserUpdateInput = {};
  const changedFields: Record<string, unknown> = {};

  if (args.role && args.role !== targetUser.role) {
    if (targetUser.role === "ADMIN" && args.role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });

      if (adminCount <= 1) {
        throw new Error("You cannot remove the last remaining admin.");
      }
    }

    updateData.role = args.role;
    changedFields.role = args.role;
  }

  if (args.unlockAccount) {
    updateData.failedAttempts = 0;
    updateData.lockedUntil = null;
    changedFields.failedAttempts = 0;
    changedFields.lockedUntil = null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("No access changes were requested");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.targetUserId },
      data: updateData,
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: {
        ...buildUserAuditEntry({
          action: USER_AUDIT_ACTION.USER_ROLE_CHANGED,
          actorUserId: args.changedByUserId,
          targetUserId: user.id,
          details: changedFields,
        }),
        oldValue: JSON.stringify({
          role: targetUser.role,
          failedAttempts: targetUser.failedAttempts,
          lockedUntil: targetUser.lockedUntil?.toISOString() ?? null,
        }),
      },
    });

    return user;
  });

  return updatedUser;
}

/**
 * Enable or disable an account.
 *
 * Disabling is enforced in the credentials provider before any password
 * comparison, so it takes effect on the next authentication attempt rather than
 * waiting for an existing session to expire.
 */
export async function setUserEnabled(args: {
  targetUserId: string;
  changedByUserId: string;
  isActive: boolean;
  reason?: string | null;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (targetUser.isActive === args.isActive) {
    throw new Error(
      `Account is already ${args.isActive ? "enabled" : "disabled"}`
    );
  }

  // Disabling the last enabled admin would lock everyone out of user
  // administration, so it is refused for the same reason as removing the last
  // admin role.
  if (!args.isActive && targetUser.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (activeAdmins <= 1) {
      throw new Error("You cannot disable the last remaining active admin.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.targetUserId },
      data: {
        isActive: args.isActive,
        // Re-enabling clears a stale lockout so the account is usable again.
        ...(args.isActive ? { failedAttempts: 0, lockedUntil: null } : {}),
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: buildUserAuditEntry({
        action: args.isActive
          ? USER_AUDIT_ACTION.USER_ENABLED
          : USER_AUDIT_ACTION.USER_DISABLED,
        actorUserId: args.changedByUserId,
        targetUserId: user.id,
        reason: args.reason ?? null,
        details: { email: user.email, isActive: args.isActive },
      }),
    });

    return user;
  });
}

export async function resetUserPassword(args: {
  targetUserId: string;
  changedByUserId: string;
  password: string;
  /**
   * Force a change at next sign-in. Defaults to true: an administrator knows
   * the value they just set, so for a real account the user must replace it.
   * Explicitly false only for demonstration accounts, whose whole purpose is a
   * repeatable shared login.
   */
  requirePasswordChange?: boolean;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      failedAttempts: true,
      lockedUntil: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  // The generic administrative path always enforces the full policy length.
  // The demo password is shorter than policy and is therefore only reachable
  // through resetUserToDemoPassword, which is itself gated on DEMO_MODE.
  if (args.password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  return applyPasswordReset({
    targetUser,
    changedByUserId: args.changedByUserId,
    password: args.password,
    requirePasswordChange: args.requirePasswordChange ?? true,
    action: USER_AUDIT_ACTION.PASSWORD_RESET_BY_ADMIN,
  });
}

/**
 * Reset a demonstration account to the shared demo password.
 *
 * Deliberately separate from resetUserPassword so the policy-length bypass has
 * exactly one call site and three independent guards: DEMO_MODE must be on, the
 * password must be configured in the environment, and the target must be a
 * seeded demo account. A real account can never be reset to the demo password
 * even while DEMO_MODE is on.
 */
export async function resetUserToDemoPassword(args: {
  targetUserId: string;
  changedByUserId: string;
}) {
  assertDemoModeEnabled("Reset to demo password");

  const demoPassword = getDemoPassword();
  if (!demoPassword) {
    throw new Error(
      "DEMO_PASSWORD is not configured for this deployment."
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      failedAttempts: true,
      lockedUntil: true,
      isDemoAccount: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (!targetUser.isDemoAccount) {
    throw new Error(
      "Only demonstration accounts can be reset to the shared demo password."
    );
  }

  return applyPasswordReset({
    targetUser,
    changedByUserId: args.changedByUserId,
    password: demoPassword,
    // A demo account must stay immediately reusable, so it is not forced
    // through the change-password flow on next sign-in.
    requirePasswordChange: false,
    action: USER_AUDIT_ACTION.DEMO_PASSWORD_RESET,
  });
}

/**
 * Shared write path for both reset flavours.
 *
 * Receives an already-validated plaintext, hashes it with bcrypt, and records
 * an audit row that contains no credential material — only the resulting policy
 * flags.
 */
async function applyPasswordReset(args: {
  targetUser: {
    id: string;
    failedAttempts: number;
    lockedUntil: Date | null;
  };
  changedByUserId: string;
  password: string;
  requirePasswordChange: boolean;
  action: (typeof USER_AUDIT_ACTION)[keyof typeof USER_AUDIT_ACTION];
}) {
  const passwordHash = await bcrypt.hash(args.password, 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.targetUser.id },
      data: {
        passwordHash,
        passwordChangeRequired: args.requirePasswordChange,
        passwordChangedAt: args.requirePasswordChange ? null : new Date(),
        passwordExpiresAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: {
        ...buildUserAuditEntry({
          action: args.action,
          actorUserId: args.changedByUserId,
          targetUserId: user.id,
          details: {
            passwordReset: true,
            requirePasswordChange: args.requirePasswordChange,
            failedAttempts: 0,
            lockedUntil: null,
          },
        }),
        oldValue: JSON.stringify({
          failedAttempts: args.targetUser.failedAttempts,
          lockedUntil: args.targetUser.lockedUntil?.toISOString() ?? null,
        }),
      },
    });

    return user;
  });
}

export async function resetUserTwoFactor(args: {
  targetUserId: string;
  changedByUserId: string;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      twoFAEnabled: true,
      twoFASecret: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.targetUserId },
      data: {
        twoFAEnabled: false,
        twoFASecret: null,
        twoFARecoveryCodesJson: null,
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: args.changedByUserId,
        action: "UPDATE",
        entity: "User2FA",
        entityId: user.id,
        oldValue: JSON.stringify({
          twoFAEnabled: targetUser.twoFAEnabled,
          hadSecret: Boolean(targetUser.twoFASecret),
        }),
        newValue: JSON.stringify({
          twoFAEnabled: false,
          hadSecret: false,
          recoveryCodesCleared: true,
          reset: true,
        }),
      },
    });

    return user;
  });

  return updatedUser;
}

export async function changeOwnPassword(args: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      passwordChangeRequired: true,
      passwordExpiresAt: true,
    },
  });

  if (!targetUser?.passwordHash) {
    throw new Error("Account password is not configured");
  }

  if (args.newPassword.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  const currentPasswordValid = await bcrypt.compare(
    args.currentPassword,
    targetUser.passwordHash
  );
  if (!currentPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  const samePassword = await bcrypt.compare(
    args.newPassword,
    targetUser.passwordHash
  );
  if (samePassword) {
    throw new Error("New password must be different from the current password");
  }

  const passwordHash = await bcrypt.hash(args.newPassword, 10);
  const passwordChangedAt = new Date();
  const passwordExpiresAt = computePasswordExpiresAt(passwordChangedAt);

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.userId },
      data: {
        passwordHash,
        passwordChangeRequired: false,
        passwordChangedAt,
        passwordExpiresAt,
        failedAttempts: 0,
        lockedUntil: null,
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: {
        ...buildUserAuditEntry({
          action: USER_AUDIT_ACTION.PASSWORD_CHANGED_BY_USER,
          actorUserId: args.userId,
          targetUserId: user.id,
          details: {
            passwordChangeRequired: false,
            passwordChangedAt: passwordChangedAt.toISOString(),
            passwordExpiresAt: passwordExpiresAt.toISOString(),
          },
        }),
        oldValue: JSON.stringify({
          passwordChangeRequired: targetUser.passwordChangeRequired,
          passwordExpiresAt: targetUser.passwordExpiresAt?.toISOString() ?? null,
        }),
      },
    });

    return user;
  });

  return updatedUser;
}
