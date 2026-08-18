import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  canEditCaseRuleDrafts,
  canViewCaseRuleReleases,
} from "@/lib/cases/rule-governance";
import {
  getCaseRuleSetReleaseById,
  updateCaseRuleSetReleaseDraft,
} from "@/lib/cases/rule-releases";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json({ error: "Cases v2 is disabled" }, { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canViewCaseRuleReleases(user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const release = await getCaseRuleSetReleaseById(id);
  if (!release) {
    return NextResponse.json({ error: "Case rule release not found" }, { status: 404 });
  }

  return NextResponse.json(release);
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
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canEditCaseRuleDrafts(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  if (
    typeof payload.name !== "string" ||
    typeof payload.description !== "string" ||
    typeof payload.changeNotes !== "string" ||
    typeof payload.definitionJson !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "name, description, changeNotes, and definitionJson must all be strings",
      },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const release = await updateCaseRuleSetReleaseDraft({
      id,
      actorUserId: user.id,
      name: payload.name,
      description: payload.description,
      changeNotes: payload.changeNotes,
      definitionJson: payload.definitionJson,
    });
    return NextResponse.json(release);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update case rule release";
    const status =
      message === "Case rule release not found"
        ? 404
        : message === "Active case rule releases are immutable" ||
            message === "Published case rule releases are immutable; create a draft instead"
          ? 409
          : message === "name is required" ||
              message === "change notes are required before saving a draft" ||
              message === "definitionJson must be valid JSON" ||
              message ===
                "definitionJson must match the enterprise case rule schema for this service" ||
              message.includes(" requires ") ||
              message.includes(" is duplicated")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
