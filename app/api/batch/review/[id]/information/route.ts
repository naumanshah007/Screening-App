import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import {
  BatchReviewConflictError,
  BatchReviewError,
  returnNeedsInformationToQueue,
} from "@/lib/batch/persistence";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasPermission(user.role, "cases:edit") && !hasPermission(user.role, "cases:grade")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null) as { resolutionNote?: unknown } | null;
    if (typeof body?.resolutionNote !== "string" || body.resolutionNote.trim().length > 2_000) {
      return NextResponse.json({ error: "resolutionNote is required and must be at most 2,000 characters." }, { status: 400 });
    }
    await returnNeedsInformationToQueue({
      itemId: (await params).id,
      actorUserId: user.id,
      resolutionNote: body.resolutionNote,
    });
    return NextResponse.json({ disposition: "PENDING" });
  } catch (error) {
    if (error instanceof BatchReviewConflictError) {
      return NextResponse.json({ error: error.message, code: "REVIEW_CONFLICT" }, { status: 409 });
    }
    if (error instanceof BatchReviewError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to return this case to review." }, { status: 500 });
  }
}
