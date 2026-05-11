import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isFeatureEnabled } from "@/lib/features";
import { reviewClinicalSummary } from "@/lib/cases/summary";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Cases v2 is disabled" },
    { status: 404 }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: string; name?: string; email?: string }
    | undefined;
  const permissionError = getApiPermissionError(user, "summary:approve");
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
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const action = (body as { action?: unknown }).action;
  const renderedMarkdown = (body as { renderedMarkdown?: unknown }).renderedMarkdown;

  if (action !== "review" && action !== "approve") {
    return NextResponse.json(
      { error: "action must be 'review' or 'approve'" },
      { status: 400 }
    );
  }

  if (typeof renderedMarkdown !== "string") {
    return NextResponse.json(
      { error: "renderedMarkdown is required" },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const summary = await reviewClinicalSummary({
      caseId: id,
      actorUserId: userId,
      actorLabel:
        user?.name ??
        user?.email ??
        userId,
      renderedMarkdown,
      action,
    });

    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update summary review";
    const status =
      message === "Clinical summary not found"
        ? 404
        : message === "Summary markdown is required"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
