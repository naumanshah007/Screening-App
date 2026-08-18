import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { generateRuleDecision } from "@/lib/cases/grading";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: string; name?: string; email?: string }
    | undefined;
  const permissionError = getApiPermissionError(user, "cases:grade");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Session is missing user id" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const decision = await generateRuleDecision({
      caseId: id,
      generatedByUserId: userId,
      generatedByLabel:
        user?.name ??
        user?.email ??
        userId,
    });

    return NextResponse.json(decision);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to evaluate rules";
    const status =
      message === "Referral case not found"
        ? 404
        : message === "Generate a clinical summary before evaluating rules" ||
            message === "Approve the clinical summary before evaluating rules" ||
            message === "No active case rule release is configured for this service"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
