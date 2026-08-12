import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { setUserEnabled } from "@/lib/admin/user-management";

/** Enable or disable an account. ADMIN only, via the admin:users permission. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:users");
  if (permissionError) {
    return NextResponse.json(permissionError.body, {
      status: permissionError.status,
    });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as {
      isActive?: boolean;
      reason?: string;
    };

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be provided" },
        { status: 400 }
      );
    }

    const updatedUser = await setUserEnabled({
      targetUserId: id,
      changedByUserId: user!.id!,
      isActive: body.isActive,
      reason: body.reason ?? null,
    });

    return NextResponse.json({
      ok: true,
      message: `${updatedUser.name ?? updatedUser.email} is now ${
        body.isActive ? "enabled" : "disabled"
      }.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update account status",
      },
      { status: 400 }
    );
  }
}
