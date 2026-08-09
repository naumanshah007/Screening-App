import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  getClinicalRuleVersionSnapshot,
  updateClinicalRuleDraft,
} from "@/lib/clinical-rules/lifecycle";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";

const UpdateSchema = z.object({
  expectedRevision: z.number().int().positive(),
  snapshot: z.unknown(),
  changeSummary: z.string().optional(),
  checkpoint: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  try {
    return NextResponse.json(await getClinicalRuleVersionSnapshot((await params).id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clinical rule version not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:edit");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft update", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const version = await updateClinicalRuleDraft({
      id: (await params).id,
      ...parsed.data,
      actorUserId: user!.id!,
      metadata: requestAuditMetadata(request),
    });
    return NextResponse.json({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update clinical rule draft";
    return NextResponse.json({ error: message }, { status: message.includes("conflict") ? 409 : 400 });
  }
}
