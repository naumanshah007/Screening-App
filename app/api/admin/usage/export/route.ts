import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getCurrentOrganisation } from "@/lib/organisation/current-organisation";
import {
  listUsageActivity,
  REVIEW_STATUS_LABELS,
} from "@/lib/usage/usage-activity";
import {
  resolveUsageActivityRequest,
  type UsageActivitySearchParams,
} from "@/lib/usage/usage-activity-request";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 10_000;

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!isAuthorizedForRoute("/admin/usage", user?.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const organisation = await getCurrentOrganisation();
  if (!organisation) {
    return Response.json({ error: "Operating organisation is not configured." }, { status: 409 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as UsageActivitySearchParams;
  const resolved = resolveUsageActivityRequest(params, organisation.id);
  const rows = [];
  let page = 1;
  while (rows.length < EXPORT_LIMIT) {
    const result = await listUsageActivity({
      ...resolved.filters,
      page,
      pageSize: 100,
    });
    rows.push(...result.rows.slice(0, EXPORT_LIMIT - rows.length));
    if (page >= result.totalPages) break;
    page += 1;
  }

  const header = [
    "Date/time",
    "Episode reference",
    "Source",
    "Event",
    "Episode activity",
    "Review status",
    "Ruleset",
    "Evaluation reference",
  ];
  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.occurredAt,
        row.episodeReference,
        row.source,
        row.eventLabel,
        row.classificationLabel,
        row.reviewStatus ? REVIEW_STATUS_LABELS[row.reviewStatus] ?? row.reviewStatus : "",
        row.rulesetVersion,
        row.ruleEvaluationId ? `evaluation-${row.ruleEvaluationId.slice(-8)}` : "",
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cervigrade-usage-${resolved.range.fromDate}-to-${resolved.range.toDate}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Export-Limit": String(EXPORT_LIMIT),
    },
  });
}
