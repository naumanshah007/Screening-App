import type { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  computePasswordExpiresAt,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy";
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
    throw new Error("Initial password must be at least 8 characters");
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
      data: {
        userId: args.createdByUserId,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        newValue: JSON.stringify({
          email: user.email,
          role: user.role,
          gpPracticeId: user.gpPracticeId,
        }),
      },
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
        userId: args.changedByUserId,
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        oldValue: JSON.stringify({
          role: targetUser.role,
          failedAttempts: targetUser.failedAttempts,
          lockedUntil: targetUser.lockedUntil?.toISOString() ?? null,
        }),
        newValue: JSON.stringify(changedFields),
      },
    });

    return user;
  });

  return updatedUser;
}

export async function resetUserPassword(args: {
  targetUserId: string;
  changedByUserId: string;
  password: string;
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

  if (args.password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error("Temporary password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(args.password, 10);

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: args.targetUserId },
      data: {
        passwordHash,
        passwordChangeRequired: true,
        passwordChangedAt: null,
        passwordExpiresAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      },
      include: adminUserInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: args.changedByUserId,
        action: "UPDATE",
        entity: "UserPassword",
        entityId: user.id,
        oldValue: JSON.stringify({
          failedAttempts: targetUser.failedAttempts,
          lockedUntil: targetUser.lockedUntil?.toISOString() ?? null,
        }),
        newValue: JSON.stringify({
          passwordReset: true,
          failedAttempts: 0,
          lockedUntil: null,
        }),
      },
    });

    return user;
  });

  return updatedUser;
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
    throw new Error("New password must be at least 8 characters");
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
        userId: args.userId,
        action: "UPDATE",
        entity: "UserPassword",
        entityId: user.id,
        oldValue: JSON.stringify({
          passwordChangeRequired: targetUser.passwordChangeRequired,
          passwordExpiresAt: targetUser.passwordExpiresAt?.toISOString() ?? null,
        }),
        newValue: JSON.stringify({
          passwordChangeRequired: false,
          passwordChangedAt: passwordChangedAt.toISOString(),
          passwordExpiresAt: passwordExpiresAt.toISOString(),
        }),
      },
    });

    return user;
  });

  return updatedUser;
}
