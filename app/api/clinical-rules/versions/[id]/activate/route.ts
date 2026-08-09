import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { activateClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

const BodySchema = z.object({
  environment: z.enum(["DEMO", "TEST", "VALIDATION", "PRODUCTION"]).default("DEMO"),
  organisationKey: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:activate");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid activation request", issues: parsed.error.issues }, { status: 400 });
  try {
    return NextResponse.json(
      await activateClinicalRuleVersion({
        id: (await params).id,
        actorUserId: user!.id!,
        ...parsed.data,
        metadata: requestAuditMetadata(request),
      })
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to activate version" }, { status: 409 });
  }
}
