import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  buildPatientScope,
  requirePermission,
  type ResourceActor,
} from "@/lib/auth/resource-access";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import type { Prisma, ScreeningType } from "@prisma/client";

// GET /api/patients/:id - Patient detail with full timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const actor = session?.user as ResourceActor | undefined;
  const permissionError = requirePermission(actor, "patients:view");
  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { AND: [{ id }, buildPatientScope(actor!)] },
    include: {
      gpPractice: true,
      medicalHistory: true,
      screeningSessions: {
        include: {
          testResults: true,
          colposcopyFindings: true,
          referrals: true,
          pathwayHistory: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      recalls: { orderBy: { dueDate: "desc" } },
    },
  });

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Audit read access
  await prisma.auditLog.create({
    data: buildProtectedAuditEntry({
      userId: actor!.id,
      action: "PHI_RECORD_READ",
      entity: "Patient",
      entityId: patient.id,
      request: req,
    }),
  });

  return NextResponse.json(patient);
}

// GET /api/patients/:id/timeline
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const actor = session?.user as ResourceActor | undefined;
  const permissionError = requirePermission(actor, "patients:edit");
  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.patient.findFirst({
    where: { AND: [{ id }, buildPatientScope(actor!)] },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Explicit allow-list prevents mass assignment into status, identity keys,
  // relations, timestamps, or future schema fields.
  const data: Prisma.PatientUpdateInput = {
    ...(typeof body.email === "string" || body.email === null ? { email: body.email } : {}),
    ...(typeof body.phone === "string" || body.phone === null ? { phone: body.phone } : {}),
    ...(typeof body.address === "string" || body.address === null ? { address: body.address } : {}),
    ...(typeof body.isPostHysterectomy === "boolean"
      ? { isPostHysterectomy: body.isPostHysterectomy }
      : {}),
    ...(typeof body.isFirstTimeHPVTransition === "boolean"
      ? { isFirstTimeHPVTransition: body.isFirstTimeHPVTransition }
      : {}),
    ...(body.previousScreeningType === "CYTOLOGY" ||
    body.previousScreeningType === "HPV" ||
    body.previousScreeningType === null
      ? { previousScreeningType: body.previousScreeningType as ScreeningType | null }
      : {}),
    updatedAt: new Date(),
  };

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...data,
    },
  });

  await prisma.auditLog.create({
    data: buildProtectedAuditEntry({
      userId: actor!.id,
      action: "PATIENT_UPDATED",
      entity: "Patient",
      entityId: patient.id,
      request: req,
      newValue: { changedFields: Object.keys(data).filter((key) => key !== "updatedAt") },
    }),
  });

  return NextResponse.json(patient);
}
