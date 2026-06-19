import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { getCompletedDecisionForUser } from "@/lib/decisions/completed-decisions";
import { buildSimulatedDecisionPackage } from "@/lib/decisions/package-generator";

export async function POST(
  _req: Request,
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

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SIMULATED_PACKAGE_PREVIEW",
      entity: "DecisionPackage",
      entityId: decision.id,
      exportEvent: true,
      newValue: JSON.stringify({
        eventLabel: "Simulated write-back preview",
        packageLabel: "Integration-ready export package",
        simulated: true,
        actorUserId: user.id,
        batchReviewItemId: decision.id,
        batchRunId: decision.batchRunId,
        format: "preview",
        disposition: decision.disposition,
        timestamp: generatedAt,
      }),
    },
  });

  return NextResponse.json(pkg);
}
