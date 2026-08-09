import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { diffClinicalRuleSnapshots } from "@/lib/clinical-rules/diff";
import { getClinicalRuleVersionSnapshot } from "@/lib/clinical-rules/lifecycle";

const BodySchema = z.object({ compareVersionId: z.string().trim().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "compareVersionId is required" }, { status: 400 });
  try {
    const [before, after] = await Promise.all([
      getClinicalRuleVersionSnapshot(parsed.data.compareVersionId),
      getClinicalRuleVersionSnapshot((await params).id),
    ]);
    return NextResponse.json({
      before: { id: before.version.id, displayVersion: before.version.displayVersion },
      after: { id: after.version.id, displayVersion: after.version.displayVersion },
      diff: diffClinicalRuleSnapshots(before.snapshot, after.snapshot),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to compare versions" }, { status: 404 });
  }
}
