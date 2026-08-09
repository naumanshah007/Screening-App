import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  ClinicalGovernanceReviewActionSchema,
  recordClinicalGovernanceReview,
} from "@/lib/clinical-rules/governance-review";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const parsed = ClinicalGovernanceReviewActionSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid governance review", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const permissionError = getApiPermissionError(
    user,
    parsed.data.action === "APPROVE" || parsed.data.action === "REJECT" || parsed.data.action === "REQUEST_CHANGE"
      ? "rules:approve"
      : "rules:validate"
  );
  if (permissionError) {
    return NextResponse.json(permissionError.body, {
      status: permissionError.status,
    });
  }
  try {
    const result = await recordClinicalGovernanceReview({
      versionId: (await params).id,
      actorUserId: user!.id!,
      ...parsed.data,
      ...requestAuditMetadata(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record governance review";
    return NextResponse.json(
      { error: message },
      { status: /conflict|refresh/i.test(message) ? 409 : 400 }
    );
  }
}
