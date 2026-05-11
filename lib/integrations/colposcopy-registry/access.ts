import type { UserRole } from "@prisma/client";

import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const NCSR_SYSTEM_NAME = "NCSR";
export const NCSR_CERTIFICATION_TYPE = "CONFIDENTIALITY_AND_SAFETY";
const NCSR_EXPIRY_WARNING_DAYS = 30;

const NCSR_ACCESS_ROLES: UserRole[] = [
  "ADMIN",
  "COLPO_CNS",
  "SMO_REVIEWER",
  "INTEGRATION_ADMIN",
];

export type NcsrAccessStatus = {
  status: "ready" | "warning" | "blocked";
  mode: string;
  canPull: boolean;
  summary: string;
  detail: string;
  nextStep?: string;
  certification: {
    completedAt: string | null;
    expiresAt: string | null;
  } | null;
};

export type NcsrAccessStatusRow = {
  userId: string;
  name: string | null;
  email: string;
  role: UserRole;
  access: NcsrAccessStatus;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildCertificationStatus(args: {
  role: UserRole | string | undefined;
  certification: {
    completedAt: Date;
    expiresAt: Date | null;
  } | null;
}): NcsrAccessStatus {
  if (!hasPermission(args.role, "integration:ncsr_pull")) {
    return {
      status: "blocked",
      mode: "Role blocked",
      canPull: false,
      summary: "This role cannot pull restricted NCSR history.",
      detail:
        "Restricted national registry access is limited to approved roles only.",
      nextStep:
        "Use a COLPO_CNS, SMO_REVIEWER, ADMIN, or INTEGRATION_ADMIN account for NCSR validation work.",
      certification: null,
    };
  }

  if (!args.certification) {
    return {
      status: "blocked",
      mode: "Training missing",
      canPull: false,
      summary: "NCSR access is blocked until confidentiality training is recorded.",
      detail:
        "This user has the right role, but no active NCSR confidentiality and safety certification is on file.",
      nextStep:
        "Record the user’s NCSR confidentiality and safety training before allowing a live pull.",
      certification: null,
    };
  }

  const now = new Date();
  const expiresAt = args.certification.expiresAt;
  const certification = {
    completedAt: toIso(args.certification.completedAt),
    expiresAt: toIso(expiresAt),
  };

  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    return {
      status: "blocked",
      mode: "Certification expired",
      canPull: false,
      summary: "NCSR access is blocked because the recorded training has expired.",
      detail:
        "The user needs renewed confidentiality and safety sign-off before accessing restricted registry data.",
      nextStep:
        "Renew the user’s NCSR training and update the certification record.",
      certification,
    };
  }

  if (expiresAt) {
    const warningThreshold = new Date(
      now.getTime() + NCSR_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000
    );

    if (expiresAt.getTime() <= warningThreshold.getTime()) {
      return {
        status: "warning",
        mode: "Certified · expires soon",
        canPull: true,
        summary: "NCSR access is active, but the training record is close to expiry.",
        detail:
          "A live pull is still allowed, but this access should be renewed before the expiry date.",
        nextStep:
          "Schedule the next confidentiality refresh before the current certification expires.",
        certification,
      };
    }
  }

  return {
    status: "ready",
    mode: "Certified",
    canPull: true,
    summary: "NCSR access is available for this user.",
    detail:
      "Role permission and confidentiality training are both in place for restricted registry access.",
    certification,
  };
}

export async function getNcsrUserAccessStatus(args: {
  userId?: string | null;
  role?: UserRole | string;
}): Promise<NcsrAccessStatus> {
  if (!args.userId) {
    return {
      status: "blocked",
      mode: "No signed-in user",
      canPull: false,
      summary: "NCSR access needs an authenticated user context.",
      detail:
        "The system cannot audit a restricted registry pull without a signed-in user.",
      nextStep: "Sign in with an authorised hospital account before pulling NCSR data.",
      certification: null,
    };
  }

  const certification = await prisma.accessCertification.findFirst({
    where: {
      userId: args.userId,
      systemName: NCSR_SYSTEM_NAME,
      certificationType: NCSR_CERTIFICATION_TYPE,
      active: true,
    },
    orderBy: [{ completedAt: "desc" }],
    select: {
      completedAt: true,
      expiresAt: true,
    },
  });

  return buildCertificationStatus({
    role: args.role,
    certification,
  });
}

export async function listNcsrAccessStatuses(): Promise<NcsrAccessStatusRow[]> {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: NCSR_ACCESS_ROLES,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessCertifications: {
        where: {
          systemName: NCSR_SYSTEM_NAME,
          certificationType: NCSR_CERTIFICATION_TYPE,
          active: true,
        },
        orderBy: [{ completedAt: "desc" }],
        take: 1,
        select: {
          completedAt: true,
          expiresAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
  });

  return users.map((user) => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    access: buildCertificationStatus({
      role: user.role,
      certification: user.accessCertifications[0] ?? null,
    }),
  }));
}

export async function getNcsrCertificationSummary() {
  const rows = await listNcsrAccessStatuses();

  return {
    totalEligibleUsers: rows.length,
    readyCount: rows.filter((row) => row.access.status === "ready").length,
    warningCount: rows.filter((row) => row.access.status === "warning").length,
    blockedCount: rows.filter((row) => row.access.status === "blocked").length,
    rows,
  };
}

export async function saveNcsrCertification(args: {
  targetUserId: string;
  completedAt: Date;
  expiresAt?: Date | null;
  notes?: string | null;
  changedByUserId: string;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  if (!hasPermission(targetUser.role, "integration:ncsr_pull")) {
    throw new Error("Selected user role is not eligible for NCSR certification");
  }

  const activeCertification = await prisma.accessCertification.findFirst({
    where: {
      userId: args.targetUserId,
      systemName: NCSR_SYSTEM_NAME,
      certificationType: NCSR_CERTIFICATION_TYPE,
      active: true,
    },
    orderBy: [{ completedAt: "desc" }],
    select: {
      id: true,
      completedAt: true,
      expiresAt: true,
      notes: true,
    },
  });

  const certification = await prisma.$transaction(async (tx) => {
    await tx.accessCertification.updateMany({
      where: {
        userId: args.targetUserId,
        systemName: NCSR_SYSTEM_NAME,
        certificationType: NCSR_CERTIFICATION_TYPE,
        active: true,
      },
      data: {
        active: false,
      },
    });

    const created = await tx.accessCertification.create({
      data: {
        userId: args.targetUserId,
        systemName: NCSR_SYSTEM_NAME,
        certificationType: NCSR_CERTIFICATION_TYPE,
        completedAt: args.completedAt,
        expiresAt: args.expiresAt ?? null,
        active: true,
        notes: args.notes?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: args.changedByUserId,
        action: "UPDATE",
        entity: "AccessCertification",
        entityId: created.id,
        oldValue: JSON.stringify(activeCertification),
        newValue: JSON.stringify({
          userId: args.targetUserId,
          systemName: NCSR_SYSTEM_NAME,
          certificationType: NCSR_CERTIFICATION_TYPE,
          completedAt: args.completedAt.toISOString(),
          expiresAt: args.expiresAt?.toISOString() ?? null,
          notes: args.notes?.trim() || null,
        }),
      },
    });

    return created;
  });

  return {
    certification,
    targetUser,
  };
}

export async function revokeNcsrCertification(args: {
  targetUserId: string;
  changedByUserId: string;
  reason?: string | null;
}) {
  const targetUser = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  const activeCertifications = await prisma.accessCertification.findMany({
    where: {
      userId: args.targetUserId,
      systemName: NCSR_SYSTEM_NAME,
      certificationType: NCSR_CERTIFICATION_TYPE,
      active: true,
    },
    select: {
      id: true,
      completedAt: true,
      expiresAt: true,
      notes: true,
    },
  });

  if (activeCertifications.length === 0) {
    throw new Error("No active NCSR certification is recorded for this user");
  }

  await prisma.$transaction(async (tx) => {
    await tx.accessCertification.updateMany({
      where: {
        userId: args.targetUserId,
        systemName: NCSR_SYSTEM_NAME,
        certificationType: NCSR_CERTIFICATION_TYPE,
        active: true,
      },
      data: {
        active: false,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: args.changedByUserId,
        action: "DELETE",
        entity: "AccessCertification",
        entityId: args.targetUserId,
        oldValue: JSON.stringify(activeCertifications),
        newValue: JSON.stringify({
          revoked: true,
          reason: args.reason?.trim() || null,
        }),
      },
    });
  });

  return {
    targetUser,
  };
}
