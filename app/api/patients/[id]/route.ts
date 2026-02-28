import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/patients/:id - Patient detail with full timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

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
      userId: (session.user as { id?: string }).id,
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
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...body,
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as { id?: string }).id,
      action: "UPDATE",
      entity: "Patient",
      entityId: patient.id,
      newValue: JSON.stringify(body),
    },
  });

  return NextResponse.json(patient);
}
