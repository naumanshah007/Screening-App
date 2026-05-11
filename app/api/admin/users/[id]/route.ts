import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { updateUserAccess } from "@/lib/admin/user-management";

const allowedRoles: UserRole[] = [
  "ADMIN",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COORDINATOR",
  "GP",
  "INTEGRATION_ADMIN",
];

export async function PATCH(
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
      role?: UserRole;
      unlockAccount?: boolean;
    };

    if (body.role && !allowedRoles.includes(body.role)) {
      return NextResponse.json({ error: "Role is invalid" }, { status: 400 });
    }

    const updatedUser = await updateUserAccess({
      targetUserId: id,
      changedByUserId: user!.id!,
      role: body.role,
      unlockAccount: body.unlockAccount,
    });

    return NextResponse.json({
      ok: true,
      message: `Updated access for ${updatedUser.name ?? updatedUser.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update user access",
      },
      { status: 400 }
    );
  }
}
