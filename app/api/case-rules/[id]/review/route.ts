import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canReviewCaseRuleReleases } from "@/lib/cases/rule-governance";
import { reviewCaseRuleSetRelease } from "@/lib/cases/rule-releases";
import { isFeatureEnabled } from "@/lib/features";

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
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canReviewCaseRuleReleases(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const release = await reviewCaseRuleSetRelease({
      id,
      actorUserId: user.id,
    });
    return NextResponse.json(release);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review case rule release";
    const status =
      message === "Case rule release not found"
        ? 404
        : message === "Only editable drafts can be reviewed" ||
            message === "Change notes are required before review" ||
            message === "Regression suite must pass before review"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
