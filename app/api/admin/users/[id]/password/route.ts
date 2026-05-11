import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { resetUserPassword } from "@/lib/admin/user-management";

export async function POST(
  req: NextRequest,
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
    const body = (await req.json()) as {
      password?: string;
    };

    if (!body.password) {
      return NextResponse.json(
        { error: "Temporary password is required" },
        { status: 400 }
      );
    }

    const updatedUser = await resetUserPassword({
      targetUserId: id,
      changedByUserId: user!.id!,
      password: body.password,
    });

    return NextResponse.json({
      ok: true,
      message: `Temporary password set for ${updatedUser.name ?? updatedUser.email}. Account lock state has been cleared and the user must update the password at next sign-in.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset password",
      },
      { status: 400 }
    );
  }
}
