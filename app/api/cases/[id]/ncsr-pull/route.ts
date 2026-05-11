import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";
import { pullNcsrPatientRecord, isNcsrConfigured } from "@/lib/integrations/colposcopy-registry/client";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/cases/[id]/ncsr-pull
 *
 * Pulls the patient's colposcopy history from the National Colposcopy
 * Screening Registry and returns the record. Access is restricted to
 * COLPO_CNS, SMO_REVIEWER, and ADMIN roles.
 *
 * Every call is audit-logged for data sovereignty compliance.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("colposcopyModule")) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: UserRole }).role;
  const userId = (session.user as { id?: string }).id ?? null;
  const access = await getNcsrUserAccessStatus({
    userId,
    role,
  });

  if (!access.canPull) {
    return NextResponse.json(
      {
        error: access.summary,
        detail: access.detail,
        code: access.mode === "Role blocked" ? "ROLE_BLOCKED" : "CERTIFICATION_REQUIRED",
        access,
      },
      { status: 403 }
    );
  }

  const { id } = await params;

  const referralCase = await prisma.referralCase.findUnique({
    where: { id },
    select: {
      id: true,
      serviceLine: true,
      patient: { select: { nhi: true } },
    },
  });

  if (!referralCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (referralCase.serviceLine !== "COLPOSCOPY") {
    return NextResponse.json(
      { error: "NCSR pull is only available for colposcopy cases" },
      { status: 422 }
    );
  }
  const result = await pullNcsrPatientRecord({
    nhiNumber: referralCase.patient.nhi,
    requestedByUserId: userId ?? "unknown",
  });

  if (!result.ok) {
    // Return structured error so the UI can show the right message
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        stubMode: result.code === "STUB",
        configured: isNcsrConfigured(),
      },
      { status: result.code === "UNAUTHORIZED" ? 403 : result.code === "NOT_FOUND" ? 404 : 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: result.data,
    message: `Retrieved ${result.data.previousColposcopyVisits.length} colposcopy visits and ${result.data.previousTreatments.length} treatments from NCSR.`,
  });
}

/**
 * GET /api/cases/[id]/ncsr-pull
 *
 * Returns whether NCSR is configured (no data access, no audit log).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    configured: isNcsrConfigured(),
    stubMode: !isNcsrConfigured(),
    access: await getNcsrUserAccessStatus({
      userId: (session.user as { id?: string }).id ?? null,
      role: (session.user as { role?: UserRole }).role,
    }),
  });
}
