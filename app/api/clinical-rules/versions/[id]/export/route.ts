import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { getClinicalRuleVersionSnapshot } from "@/lib/clinical-rules/lifecycle";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:export");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  try {
    const { version, snapshot } = await getClinicalRuleVersionSnapshot((await params).id);
    const metadata = requestAuditMetadata(request);
    await prisma.$transaction([
      prisma.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: version.ruleSetId,
          ruleVersionId: version.id,
          actorUserId: user!.id!,
          eventType: "EXPORT",
          reason: "Canonical JSON snapshot export",
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: user!.id!,
          action: "EXPORT",
          entity: "ClinicalRuleVersion",
          entityId: version.id,
          exportEvent: true,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
    return new NextResponse(JSON.stringify({ version: { id: version.id, displayVersion: version.displayVersion, checksum: version.checksum }, snapshot }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${version.displayVersion.toLowerCase()}-canonical-snapshot.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export version" }, { status: 404 });
  }
}
