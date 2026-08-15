import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRecoveryCodes } from "@/lib/auth/recovery-codes";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import { safeLogError } from "@/lib/security/safe-logging";

export async function POST(request: Request) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string } | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        twoFAEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.twoFAEnabled) {
      return NextResponse.json(
        { error: "Enable authenticator access before generating recovery codes" },
        { status: 400 }
      );
    }

    const recoveryCodes = createRecoveryCodes();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          twoFARecoveryCodesJson: recoveryCodes.storedJson,
        },
      });

      await tx.auditLog.create({
        data: buildProtectedAuditEntry({
          userId: user.id,
          action: "MFA_RECOVERY_CODES_GENERATED",
          entity: "User2FARecoveryCodes",
          entityId: user.id,
          request,
          newValue: {
            generated: true,
            count: recoveryCodes.rawCodes.length,
          },
        }),
      });
    });

    return NextResponse.json({
      ok: true,
      message:
        "Recovery codes generated. Store them somewhere safe; each code works once.",
      recoveryCodes: recoveryCodes.rawCodes,
    });
  } catch (error) {
    safeLogError("auth.mfa.recovery_codes_failed", error);
    return NextResponse.json(
      { error: "Unable to generate recovery codes" },
      { status: 400 }
    );
  }
}
