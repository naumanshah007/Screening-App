import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { resetUserToDemoPassword } from "@/lib/admin/user-management";
import { isDemoModeEnabled } from "@/lib/config/demo-mode";

/**
 * Reset a demonstration account to the shared demo password.
 *
 * Returns 404 when DEMO_MODE is off so the endpoint is not merely refused but
 * absent from a real deployment's surface. resetUserToDemoPassword re-checks
 * demo mode independently — this is a fast rejection, not the security boundary.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
    const updatedUser = await resetUserToDemoPassword({
      targetUserId: id,
      changedByUserId: user!.id!,
    });

    return NextResponse.json({
      ok: true,
      message: `${updatedUser.name ?? updatedUser.email} has been reset to the shared demonstration password.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset to the demonstration password",
      },
      { status: 400 }
    );
  }
}
