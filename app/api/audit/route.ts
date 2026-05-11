import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildAuditWhere, resolveAuditFilters } from "@/lib/security/audit-investigations";

// GET /api/audit - Auditable query
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN" && user.role !== "INTEGRATION_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({
    logs,
    total,
    page: filters.page,
    limit: filters.limit,
    preset: filters.preset?.key ?? null,
  });
}
