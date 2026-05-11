import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { createReferralCase, listReferralCases } from "@/lib/cases/service";
import {
  parseReferralCaseFilters,
  validateCreateReferralCaseInput,
} from "@/lib/cases/validators";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

export async function GET(req: NextRequest) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const parsed = parseReferralCaseFilters(new URL(req.url));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await listReferralCases(parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:create");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Session is missing user id" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateCreateReferralCaseInput(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const createdCase = await createReferralCase(parsed.data, userId);
    return NextResponse.json(createdCase, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create referral case";
    const status =
      message === "Patient not found" ||
      message === "Assigned user not found" ||
      message === "regradeOfCaseId does not match an existing case"
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
