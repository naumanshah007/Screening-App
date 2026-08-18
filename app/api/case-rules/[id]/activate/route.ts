import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canActivateCaseRuleReleases } from "@/lib/cases/rule-governance";
import { activateCaseRuleSetRelease } from "@/lib/cases/rule-releases";
import { isFeatureEnabled } from "@/lib/features";

/**
 * POST /api/case-rules/[id]/activate
 *
 * Activate (or roll back to) a reviewed release. Exactly one release is active
 * per service line; the baseline always remains as a safe default.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return NextResponse.json({ error: "Cases v2 is disabled" }, { status: 404 });
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canActivateCaseRuleReleases(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const release = await activateCaseRuleSetRelease({ id, actorUserId: user.id });
    return NextResponse.json(release);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to activate case rule release";
    const status =
      message === "Case rule release not found"
        ? 404
        : message === "Only reviewed releases can be activated" ||
            message === "Reviewer and activator must be different users" ||
            message === "Regression suite must pass before activation"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
