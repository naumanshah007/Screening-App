import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  revokeNcsrCertification,
  saveNcsrCertification,
} from "@/lib/integrations/colposcopy-registry/access";

function parseDate(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return date;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const body = (await req.json()) as {
      userId?: string;
      completedAt?: string;
      expiresAt?: string | null;
      notes?: string | null;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "User is required" }, { status: 400 });
    }

    const completedAt = parseDate(body.completedAt, "Completed date");
    const expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt.trim()
        ? parseDate(body.expiresAt, "Expiry date")
        : null;

    if (expiresAt && expiresAt.getTime() < completedAt.getTime()) {
      return NextResponse.json(
        { error: "Expiry date cannot be earlier than the completion date" },
        { status: 400 }
      );
    }

    const result = await saveNcsrCertification({
      targetUserId: body.userId,
      completedAt,
      expiresAt,
      notes: body.notes,
      changedByUserId: user!.id!,
    });

    return NextResponse.json({
      ok: true,
      message: `Saved NCSR certification for ${result.targetUser.name ?? result.targetUser.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save NCSR certification",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const body = (await req.json()) as {
      userId?: string;
      reason?: string | null;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "User is required" }, { status: 400 });
    }

    const result = await revokeNcsrCertification({
      targetUserId: body.userId,
      changedByUserId: user!.id!,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      message: `Revoked active NCSR certification for ${result.targetUser.name ?? result.targetUser.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to revoke NCSR certification",
      },
      { status: 400 }
    );
  }
}
