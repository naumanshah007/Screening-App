import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getReviewQueueCounts } from "@/lib/batch/persistence";
import { isFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !isAuthorizedForRoute("/review", role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counts = isFeatureEnabled("batchDemo")
    ? await getReviewQueueCounts()
    : { pending: 0, urgent: 0 };

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
  });
}
