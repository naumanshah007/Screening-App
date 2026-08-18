import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { z } from "zod";

const patientUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  gpPracticeId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DECEASED"]).optional(),
  isFirstTimeHPVTransition: z.boolean().optional(),
  previousScreeningType: z.enum(["CYTOLOGY", "HPV"]).nullable().optional(),
  isPostHysterectomy: z.boolean().optional(),
  hysterectomyDate: z.coerce.date().nullable().optional(),
  hysterectomyType: z.enum(["TOTAL", "SUBTOTAL"]).nullable().optional(),
  ethnicityPrimary: z.string().trim().max(40).nullable().optional(),
  ethnicityOther: z.string().trim().max(40).nullable().optional(),
  interpreterRequired: z.boolean().optional(),
  preferredLanguage: z.string().trim().max(20).nullable().optional(),
}).strict();

// GET /api/patients/:id - Patient detail with full timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "patients:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });

  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
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
    data: {
      userId: user!.id,
      action: "READ",
      entity: "Patient",
      entityId: patient.id,
    },
  });

  return NextResponse.json(patient);
}

// GET /api/patients/:id/timeline
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "patients:edit");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });

  const { id } = await params;
  const parsed = patientUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patient update", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...body,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "UPDATE",
      entity: "Patient",
      entityId: patient.id,
      newValue: JSON.stringify(body),
    },
  });

  return NextResponse.json(patient);
}
