import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { Download, FileSearch, ShieldAlert } from "lucide-react";

import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import {
  buildAuditSearchParams,
  buildAuditWhere,
  getInvestigationPresets,
  resolveAuditFilters,
  summarizeAuditFilter,
} from "@/lib/security/audit-investigations";
import { getWorkspaceContext } from "@/lib/workspace/context";

type AuditSearchParams = Promise<{
  preset?: string;
  entity?: string;
  action?: string;
  userId?: string;
  days?: string;
  page?: string;
  limit?: string;
}>;

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { name: true; email: true; role: true } };
  };
}>;

function auditDescription(log: AuditLogRecord) {
  if (log.entity === "SecurityEvent") {
    return log.action.replaceAll("_", " ").toLowerCase();
  }

  return `${log.entity} · ${log.action}`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: AuditSearchParams;
}) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (user?.role !== "ADMIN" && user?.role !== "INTEGRATION_ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filters = resolveAuditFilters(params);
  const workspace = getWorkspaceContext(user?.role, true);
  const where: Prisma.AuditLogWhereInput = buildAuditWhere(filters);

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
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const presets = getInvestigationPresets();
  const exportJsonHref = `/api/audit/export?${buildAuditSearchParams(filters, {
    format: "json",
  }).toString()}`;
  const exportCsvHref = `/api/audit/export?${buildAuditSearchParams(filters, {
    format: "csv",
  }).toString()}`;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageIntro
        eyebrow={workspace.label}
        title="Audit Investigation"
        description="Saved investigations, filtered audit review, and exportable evidence for security and governance follow-up."
        actions={[
          { href: "/analytics", label: "Back to analytics" },
          { href: "/admin", label: "Open admin" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Saved Investigations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {presets.map((preset) => {
            const isActive = filters.preset?.key === preset.key;
            const presetHref = `/audit?${buildAuditSearchParams(filters, {
              preset: preset.key,
              entity: null,
              action: null,
              days: preset.days,
              page: 1,
            }).toString()}`;

            return (
              <Link
                key={preset.key}
                href={presetHref}
                className={`rounded-lg border px-4 py-4 transition-colors ${
                  isActive
                    ? "border-brand-300 bg-brand-50"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{preset.label}</p>
                  {isActive && <Badge variant="info">Active</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{preset.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Last {preset.days} day{preset.days === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-brand-600" />
            Active Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.preset && (
              <Badge variant="info">Preset: {filters.preset.label}</Badge>
            )}
            <Badge variant="default">
              Window: last {filters.days} day{filters.days === 1 ? "" : "s"}
            </Badge>
            <Badge
              variant={filters.entities.length > 0 ? "info" : "default"}
            >
              Entity: {summarizeAuditFilter(filters.entities)}
            </Badge>
            <Badge
              variant={filters.actions.length > 0 ? "info" : "default"}
            >
              Action: {summarizeAuditFilter(filters.actions)}
            </Badge>
            <Badge variant={filters.userId ? "info" : "default"}>
              User filter: {filters.userId ?? "All"}
            </Badge>
            <Badge variant="default">
              Total matches: {total.toLocaleString()}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={exportJsonHref}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </a>
            <a
              href={exportCsvHref}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              eyebrow={workspace.label}
              title="No audit events matched"
              description="This filter set did not return any audit records."
              nextStep="Broaden the time window or switch to one of the saved investigations to investigate further."
              action={{ href: "/audit?preset=recent-security", label: "Open security review" }}
            />
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border bg-card px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={log.entity === "SecurityEvent" ? "high" : "default"}>
                        {log.entity}
                      </Badge>
                      <Badge variant="default">{log.action}</Badge>
                      {log.user?.role && <Badge variant="default">{log.user.role}</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString("en-NZ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {auditDescription(log)}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Actor: {log.user?.name ?? log.user?.email ?? "System"}
                  </div>
                  {log.newValue && (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      {log.newValue}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Page {filters.page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {filters.page > 1 && (
            <Link
              href={`/audit?${buildAuditSearchParams(filters, {
                page: filters.page - 1,
              }).toString()}`}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
            >
              Previous
            </Link>
          )}
          {filters.page < totalPages && (
            <Link
              href={`/audit?${buildAuditSearchParams(filters, {
                page: filters.page + 1,
              }).toString()}`}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
