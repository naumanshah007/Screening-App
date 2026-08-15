import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  getReferralCaseById,
  recordReferralCaseRead,
  updateReferralCase,
} from "@/lib/cases/service";
import { validateUpdateReferralCaseInput } from "@/lib/cases/validators";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id } = await params;
  const referralCase = await getReferralCaseById(id);

  if (!referralCase) {
    return NextResponse.json({ error: "Referral case not found" }, { status: 404 });
  }

  await recordReferralCaseRead(id, user?.id, req);

  return NextResponse.json(referralCase);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:edit");
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateUpdateReferralCaseInput(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await params;

  try {
    const updatedCase = await updateReferralCase(id, parsed.data, userId);
    return NextResponse.json(updatedCase);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update referral case";
    const status =
      message === "Referral case not found"
        ? 404
        : message === "Assigned user not found" ||
            message === "regradeOfCaseId does not match an existing case" ||
            message === "regradeOfCaseId cannot point to the same case"
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
