import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAuditWhere,
  getAuditExportFilename,
  resolveAuditFilters,
} from "@/lib/security/audit-investigations";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { buildProtectedAuditEntry } from "@/lib/security/audit";

const MAX_EXPORT_ROWS = 1000;

function escapeCsvField(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "audit:export");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
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

  await prisma.auditLog.create({
    data: buildProtectedAuditEntry({
      userId: user!.id,
      action: "AUDIT_TRAIL_EXPORTED",
      entity: "AuditLog",
      request: req,
      exportEvent: true,
      severity: "WARN",
      newValue: {
        format,
        preset: filters.preset?.key ?? null,
        exported: logs.length,
        truncated: total > MAX_EXPORT_ROWS,
      },
    }),
  });

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
