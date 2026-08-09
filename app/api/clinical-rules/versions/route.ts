import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { cloneClinicalRuleVersion, listClinicalRuleVersions } from "@/lib/clinical-rules/lifecycle";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";

const CloneSchema = z.object({
  sourceVersionId: z.string().trim().min(1),
  displayVersion: z.string().trim().min(1),
  changeSummary: z.string().trim().min(1),
  changeClassification: z.enum(["DISPLAY_ONLY", "OPERATIONAL", "CLINICAL_LOGIC"]),
});

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  return NextResponse.json({ versions: await listClinicalRuleVersions() });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:edit");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });

  const parsed = CloneSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid clone request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const version = await cloneClinicalRuleVersion({
      ...parsed.data,
      actorUserId: user!.id!,
      metadata: requestAuditMetadata(request),
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to clone clinical rule version" },
      { status: 409 }
    );
  }
}
