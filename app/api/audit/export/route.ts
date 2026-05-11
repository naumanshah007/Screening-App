import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAuditWhere,
  getAuditExportFilename,
  resolveAuditFilters,
} from "@/lib/security/audit-investigations";

const MAX_EXPORT_ROWS = 1000;

function ensureAuditAccess(role?: string) {
  return role === "ADMIN" || role === "INTEGRATION_ADMIN";
}

function escapeCsvField(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { role?: string };
  if (!ensureAuditAccess(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
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
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const fileName = getAuditExportFilename(filters, format);

  if (format === "csv") {
    const rows = [
      [
        "createdAt",
        "entity",
        "action",
        "actorName",
        "actorEmail",
        "actorRole",
        "oldValue",
        "newValue",
      ].join(","),
      ...logs.map((log) =>
        [
          log.createdAt.toISOString(),
          log.entity,
          log.action,
          log.user?.name ?? "",
          log.user?.email ?? "",
          log.user?.role ?? "",
          log.oldValue ?? "",
          log.newValue ?? "",
        ]
          .map((value) => escapeCsvField(String(value)))
          .join(",")
      ),
    ].join("\n");

    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        preset: filters.preset?.key ?? null,
        filters: {
          entities: filters.entities,
          actions: filters.actions,
          userId: filters.userId ?? null,
          days: filters.days,
        },
        total,
        exported: logs.length,
        truncated: total > MAX_EXPORT_ROWS,
        logs: logs.map((log) => ({
          id: log.id,
          createdAt: log.createdAt.toISOString(),
          entity: log.entity,
          action: log.action,
          actor: {
            name: log.user?.name ?? null,
            email: log.user?.email ?? null,
            role: log.user?.role ?? null,
          },
          oldValue: log.oldValue,
          newValue: log.newValue,
        })),
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    }
  );
}
