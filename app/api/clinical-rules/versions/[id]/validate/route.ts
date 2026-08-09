import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { validateClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:validate");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  try {
    return NextResponse.json(
      await validateClinicalRuleVersion({
        id: (await params).id,
        actorUserId: user!.id!,
        metadata: requestAuditMetadata(request),
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate version" },
      { status: 400 }
    );
  }
}
