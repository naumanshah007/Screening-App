import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { getCompletedDecisionForUser } from "@/lib/decisions/completed-decisions";
import { recordDecisionPackageAudit } from "@/lib/decisions/package-audit";
import { buildSimulatedDecisionPackage } from "@/lib/decisions/package-generator";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  const { id } = await params;
  const decision = await getCompletedDecisionForUser(id, user);
  if (!decision) {
    return NextResponse.json({ error: "Completed decision not found." }, { status: 404 });
  }

  const generatedAt = new Date().toISOString();
  const pkg = buildSimulatedDecisionPackage(decision, generatedAt);

  await recordDecisionPackageAudit({
    action: "SIMULATED_PACKAGE_PREVIEW",
    actorUserId: user.id,
    batchReviewItemId: decision.id,
    batchRunId: decision.batchRunId,
    disposition: decision.disposition,
    format: "preview",
    timestamp: generatedAt,
    request: req,
  });

  return NextResponse.json(pkg);
}
