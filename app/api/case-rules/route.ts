import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createCaseRuleSetDraft } from "@/lib/cases/rule-releases";
import { canManageCaseRuleReleases } from "@/lib/cases/rule-governance";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

export async function POST(req: Request) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canManageCaseRuleReleases(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const serviceLine = (body as { serviceLine?: unknown }).serviceLine;
  if (serviceLine !== "COLPOSCOPY" && serviceLine !== "GYNAECOLOGY") {
    return NextResponse.json(
      { error: "serviceLine must be COLPOSCOPY or GYNAECOLOGY" },
      { status: 400 }
    );
  }

  try {
    const release = await createCaseRuleSetDraft({
      serviceLine,
      actorUserId: user.id,
    });
    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create case rule draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
