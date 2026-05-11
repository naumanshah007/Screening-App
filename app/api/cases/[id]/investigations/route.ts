import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id } = await params;
  const investigations = await prisma.caseInvestigation.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(investigations);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2")) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:edit");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id } = await params;
  const referralCase = await prisma.referralCase.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!referralCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const investigation = await prisma.caseInvestigation.create({
    data: {
      caseId: id,
      type,
      result: typeof body.result === "string" ? body.result.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      investigationDate:
        typeof body.investigationDate === "string"
          ? new Date(body.investigationDate)
          : null,
    },
  });

  const actorId = user?.id;
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "CREATE",
      entity: "CaseInvestigation",
      entityId: investigation.id,
      newValue: JSON.stringify({ caseId: id, type }),
    },
  });

  return NextResponse.json(investigation, { status: 201 });
}
