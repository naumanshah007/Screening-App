import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTwoFactorCode } from "@/lib/auth/two-factor";

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
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entity: "User2FA",
          entityId: user.id,
          newValue: JSON.stringify({
            twoFAEnabled: true,
          }),
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message:
        "Authenticator setup complete. Your account now satisfies two-factor requirements.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to enable two-factor authentication",
      },
      { status: 400 }
    );
  }
}
