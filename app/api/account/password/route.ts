import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/admin/user-management";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword?.trim()) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    if (!body.newPassword?.trim()) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    await changeOwnPassword({
      userId: user.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Password updated. Sign in again with your new password to continue.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update password",
      },
      { status: 400 }
    );
  }
}
