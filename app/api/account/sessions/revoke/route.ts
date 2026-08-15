import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildProtectedAuditEntry } from "@/lib/security/audit";

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: buildProtectedAuditEntry({
        userId: user.id,
        action: "ALL_SESSIONS_REVOKED",
        entity: "UserSession",
        entityId: user.id,
        request,
        severity: "WARN",
        newValue: { scope: "all_sessions", initiatedBy: "account_owner" },
      }),
    });
  });

  return NextResponse.json({ ok: true });
}
