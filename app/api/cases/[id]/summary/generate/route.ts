import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { generateClinicalSummary } from "@/lib/cases/summary";

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
  const permissionError = getApiPermissionError(user, "summary:generate");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Session is missing user id" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const summary = await generateClinicalSummary({
      caseId: id,
      generatedByUserId: userId,
      generatedByLabel:
        user?.name ??
        user?.email ??
        userId,
    });

    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate summary";
    const status = message === "Referral case not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
