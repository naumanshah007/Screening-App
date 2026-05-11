import type { TriagePriority } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { saveClinicianDecision } from "@/lib/cases/decision";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

type SaveDecisionBody = {
  finalPriority?: TriagePriority;
  finalCategory?: string;
  finalOutcome?: string;
  overrideReason?: string;
  notes?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:grade");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Session is missing user id" },
      { status: 401 }
    );
  }

  const body = (await req.json()) as SaveDecisionBody;
  if (!body.finalPriority) {
    return NextResponse.json(
      { error: "Final priority is required" },
      { status: 400 }
    );
  }

  if (!body.finalOutcome?.trim()) {
    return NextResponse.json(
      { error: "Final outcome is required" },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const decision = await saveClinicianDecision({
      caseId: id,
      decidedByUserId: userId,
      finalPriority: body.finalPriority,
      finalCategory: body.finalCategory,
      finalOutcome: body.finalOutcome,
      overrideReason: body.overrideReason,
      notes: body.notes,
    });

    return NextResponse.json(decision);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save clinician decision";
    const status = message === "Referral case not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
