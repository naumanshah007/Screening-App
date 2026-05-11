import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { resetUserTwoFactor } from "@/lib/admin/user-management";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:users");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const { id } = await params;

    const updatedUser = await resetUserTwoFactor({
      targetUserId: id,
      changedByUserId: user!.id!,
    });

    return NextResponse.json({
      ok: true,
      message: `Authenticator access reset for ${updatedUser.name ?? updatedUser.email}. They will need to set up 2FA again at next sign-in.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset authenticator access",
      },
      { status: 400 }
    );
  }
}
