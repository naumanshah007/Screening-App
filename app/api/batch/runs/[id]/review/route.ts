import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { reviewBatchItems, BatchReviewError } from "@/lib/batch/persistence";
import { safeLogError } from "@/lib/security/safe-logging";

const ALLOWED_DISPOSITIONS = ["ACCEPTED", "REJECTED", "NEEDS_INFO"] as const;
type AllowedDisposition = (typeof ALLOWED_DISPOSITIONS)[number];

function isAllowedDisposition(value: unknown): value is AllowedDisposition {
  return typeof value === "string" && (ALLOWED_DISPOSITIONS as readonly string[]).includes(value);
}

/**
 * POST /api/batch/runs/[id]/review
 *
 * Bulk-apply a reviewer disposition (accept / reject / needs-info) to a set of
 * items in a run. Gated behind cases:grade — only clinical graders can dispose.
 */
export async function POST(
  req: NextRequest,
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

  const { id: runId } = await params;

  try {
    const body = await req.json();

    if (!Array.isArray(body.itemIds) || body.itemIds.some((x: unknown) => typeof x !== "string")) {
      return NextResponse.json({ error: "itemIds must be an array of strings." }, { status: 400 });
    }
    if (!isAllowedDisposition(body.disposition)) {
      return NextResponse.json(
        { error: `disposition must be one of ${ALLOWED_DISPOSITIONS.join(", ")}.` },
        { status: 400 }
      );
    }

    const run = await reviewBatchItems({
      runId,
      itemIds: body.itemIds,
      disposition: body.disposition,
      reviewedByUserId: user!.id!,
      note: typeof body.note === "string" ? body.note : null,
      overrideReason: typeof body.overrideReason === "string" ? body.overrideReason : null,
    });

    return NextResponse.json({
      pendingCount: run.pendingCount,
      acceptedCount: run.acceptedCount,
      rejectedCount: run.rejectedCount,
      needsInfoCount: run.needsInfoCount,
    });
  } catch (e) {
    if (e instanceof BatchReviewError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    safeLogError("batch.run_review.failed", e);
    return NextResponse.json({ error: "Review failed." }, { status: 500 });
  }
}
