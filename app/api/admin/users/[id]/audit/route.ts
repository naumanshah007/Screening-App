import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { listUserAccountAudit } from "@/lib/admin/user-management";

/**
 * Account-administration history for one user.
 *
 * The Manage drawer answers "what has been done to this account" in the place
 * the actions are taken, instead of sending an administrator to the global
 * Audit Trail to filter by entity id. It is read-only and returns the same
 * immutable rows the audit trail shows — nothing is summarised or rewritten.
 */
export async function GET(
  _req: NextRequest,
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
    const entries = await listUserAccountAudit(id);
    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load account history",
      },
      { status: 400 }
    );
  }
}
