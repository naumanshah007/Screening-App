import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  ActivationGateDecisionSchema,
  recordActivationGateDecision,
} from "@/lib/clinical-rules/activation-governance";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !user.role) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = ActivationGateDecisionSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid activation-gate decision", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const event = await recordActivationGateDecision({
      ruleVersionId: (await params).id,
      actorUserId: user.id,
      actorRole: user.role,
      ...parsed.data,
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ id: event.id, recordedAt: event.createdAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record activation gate";
    return NextResponse.json(
      { error: message },
      { status: /cannot decide|must be an ADMIN/i.test(message) ? 403 : 409 }
    );
  }
}
