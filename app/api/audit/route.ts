import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildAuditWhere, resolveAuditFilters } from "@/lib/security/audit-investigations";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { buildProtectedAuditEntry } from "@/lib/security/audit";

// GET /api/audit - Auditable query
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "audit:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { searchParams } = new URL(req.url);
  const filters = resolveAuditFilters({
    preset: searchParams.get("preset"),
    entity: searchParams.get("entity"),
    action: searchParams.get("action"),
    userId: searchParams.get("userId"),
    days: searchParams.get("days"),
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });
  const where = buildAuditWhere(filters);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  await prisma.auditLog.create({
    data: buildProtectedAuditEntry({
      userId: user!.id,
      action: "AUDIT_TRAIL_READ",
      entity: "AuditLog",
      request: req,
      newValue: {
        preset: filters.preset?.key ?? null,
        entityFilterCount: filters.entities.length,
        actionFilterCount: filters.actions.length,
        page: filters.page,
        returnedCount: logs.length,
      },
    }),
  });

  return NextResponse.json({
    logs,
    total,
    page: filters.page,
    limit: filters.limit,
    preset: filters.preset?.key ?? null,
  });
}
