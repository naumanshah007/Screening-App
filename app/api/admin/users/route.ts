import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { createUserAccount } from "@/lib/admin/user-management";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:users");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const body = (await req.json()) as {
      name?: string | null;
      email?: string;
      role?: UserRole;
      gpPracticeId?: string | null;
      password?: string;
    };

    if (!body.email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!body.role || !allowedRoles.includes(body.role)) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    if (!body.password) {
      return NextResponse.json({ error: "Initial password is required" }, { status: 400 });
    }

    const createdUser = await createUserAccount({
      name: body.name,
      email: body.email,
      role: body.role,
      gpPracticeId: body.gpPracticeId,
      password: body.password,
      createdByUserId: user!.id!,
    });

    return NextResponse.json({
      ok: true,
      message: `Created ${createdUser.name ?? createdUser.email}. They must set a personal password at first sign-in.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create user",
      },
      { status: 400 }
    );
  }
}
