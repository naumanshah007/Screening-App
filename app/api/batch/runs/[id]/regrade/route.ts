import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { regradeRunWithActiveRules, BatchReviewError } from "@/lib/batch/persistence";

/**
 * POST /api/batch/runs/[id]/regrade
 *
 * Re-applies the currently-active rule release to the run's pending items, so a
 * rule edit + activation is visibly reflected without re-pulling. Gated behind
 * cases:grade.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  const permissionError = getApiPermissionError(user, "cases:grade");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await regradeRunWithActiveRules({ runId: id, actorUserId: user!.id! });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BatchReviewError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Re-grade failed: ${message}` }, { status: 500 });
  }
}
