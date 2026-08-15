import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTwoFactorCode } from "@/lib/auth/two-factor";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import { safeLogError } from "@/lib/security/safe-logging";

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string } | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { code?: string };
    if (!body.code?.trim()) {
      return NextResponse.json(
        { error: "Authenticator code is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        twoFASecret: true,
        twoFAEnabled: true,
      },
    });

    if (!user?.twoFASecret) {
      return NextResponse.json(
        { error: "Authenticator setup has not been prepared yet" },
        { status: 400 }
      );
    }

    if (user.twoFAEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is already enabled" },
        { status: 400 }
      );
    }

    if (!verifyTwoFactorCode(user.twoFASecret, body.code)) {
      return NextResponse.json(
        { error: "Authenticator code is invalid" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          twoFAEnabled: true,
          // The current password-only enrolment session must not inherit MFA
          // assurance. The user signs in again with a TOTP code.
          sessionVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: buildProtectedAuditEntry({
          userId: user.id,
          action: "MFA_ENABLED",
          entity: "User2FA",
          entityId: user.id,
          request: req,
          newValue: {
            twoFAEnabled: true,
            sessionRevoked: true,
          },
        }),
      });
    });

    return NextResponse.json({
      ok: true,
      message:
        "Authenticator setup complete. Sign in again with an authenticator code to continue.",
    });
  } catch (error) {
    safeLogError("auth.mfa.enable_failed", error);
    return NextResponse.json(
      { error: "Unable to enable two-factor authentication" },
      { status: 400 }
    );
  }
}
