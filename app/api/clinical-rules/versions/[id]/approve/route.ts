import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { approveClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

const BodySchema = z.object({ reason: z.string().trim().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:approve");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Approval reason is required" }, { status: 400 });
  try {
    const version = await approveClinicalRuleVersion({
      id: (await params).id,
      actorUserId: user!.id!,
      reason: parsed.data.reason,
      metadata: requestAuditMetadata(request),
    });
    return NextResponse.json({ version });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve version" }, { status: 409 });
  }
}
