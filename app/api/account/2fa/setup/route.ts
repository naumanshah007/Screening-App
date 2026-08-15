import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTwoFactorOtpauthUrl,
  formatManualEntryKey,
  generateTwoFactorQrDataUrl,
  generateTwoFactorSecret,
} from "@/lib/auth/two-factor";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import { safeLogError } from "@/lib/security/safe-logging";

export async function POST(request: Request) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string | null } | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        twoFAEnabled: true,
        twoFASecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.twoFAEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is already enabled" },
        { status: 400 }
      );
    }

    const setup =
      user.twoFASecret && user.twoFASecret.trim()
        ? {
            secret: user.twoFASecret,
            otpauthUrl: buildTwoFactorOtpauthUrl(user.email, user.twoFASecret),
          }
        : generateTwoFactorSecret(user.email);

    if (!user.twoFASecret) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFASecret: setup.secret,
        },
      });

      await prisma.auditLog.create({
        data: buildProtectedAuditEntry({
          userId: user.id,
          action: "MFA_SETUP_PREPARED",
          entity: "User2FA",
          entityId: user.id,
          request,
          newValue: {
            setupPrepared: true,
          },
        }),
      });
    }

    const qrDataUrl = await generateTwoFactorQrDataUrl(setup.otpauthUrl);

    return NextResponse.json({
      ok: true,
      manualEntryKey: formatManualEntryKey(setup.secret),
      qrDataUrl,
    });
  } catch (error) {
    safeLogError("auth.mfa.setup_failed", error);
    return NextResponse.json(
      { error: "Unable to prepare authenticator setup" },
      { status: 400 }
    );
  }
}
