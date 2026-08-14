import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { processBatch } from "@/lib/batch/processor";
import { saveBatchRun, listBatchRuns } from "@/lib/batch/persistence";
import type { CanonicalBatchCase } from "@/lib/batch/types";

/**
 * GET /api/batch/runs — list saved batch runs (most recent first).
 */
export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  const runs = await listBatchRuns();
  return NextResponse.json({ runs });
}

/**
 * POST /api/batch/runs
 *
 * Re-processes the selected cases server-side (never trusts a client-computed
 * decision) and persists the result as a reviewable BatchRun. Returns the run id.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  const permissionError = getApiPermissionError(user, "cases:create");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!Array.isArray(body.cases)) {
      return NextResponse.json(
        { error: "Request body must contain a 'cases' array of CanonicalBatchCase objects." },
        { status: 400 }
      );
    }

    const cases: CanonicalBatchCase[] = body.cases;
    if (cases.length === 0) {
      return NextResponse.json({ error: "No cases provided." }, { status: 400 });
    }
    if (cases.length > 500) {
      return NextResponse.json(
        { error: `Too many cases (${cases.length}). Maximum is 500.` },
        { status: 400 }
      );
    }

    // Re-run the engine server-side so persisted decisions are authoritative.
    const result = processBatch(cases, {
      includeWarnings: body.includeWarnings ?? true,
      includeInvalid: body.includeInvalid ?? false,
    });

    if (result.results.length === 0) {
      return NextResponse.json(
        { error: "No processable cases after validation filtering." },
        { status: 400 }
      );
    }

    // Arrivals pulled in this intake but not sent for review. Recorded as
    // observations so a suppressed result is never indistinguishable from a
    // lost one.
    const withheldCases: CanonicalBatchCase[] = Array.isArray(body.withheldCases)
      ? body.withheldCases.slice(0, 500)
      : [];

    const run = await saveBatchRun({
      result,
      actorUserId: user!.id!,
      sourceSystem: typeof body.sourceSystem === "string" ? body.sourceSystem : undefined,
      withheldCases,
    });

    return NextResponse.json({ runId: run.id, totalCases: run.totalCases });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save batch run: ${message}` }, { status: 500 });
  }
}
