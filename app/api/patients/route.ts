import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/patients - List patients with search
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "ACTIVE";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const where = {
    status: status as "ACTIVE" | "ARCHIVED" | "DECEASED",
    OR: search
      ? [
          { nhi: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ]
      : undefined,
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        gpPractice: { select: { name: true } },
        _count: { select: { screeningSessions: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ]);

  return NextResponse.json({ patients, total, page, limit });
}

// POST /api/patients - Create patient
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    nhi,
    firstName,
    lastName,
    dateOfBirth,
    email,
    phone,
    address,
    gpPracticeId,
    isPostHysterectomy,
    previousScreeningType,
    isFirstTimeHPVTransition,
  } = body;

  if (!nhi || !firstName || !lastName || !dateOfBirth) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.patient.findUnique({ where: { nhi } });
  if (existing) {
    return NextResponse.json({ error: "Patient with this NHI already exists" }, { status: 409 });
  }

  const patient = await prisma.patient.create({
    data: {
      nhi: nhi.toUpperCase(),
      firstName,
      lastName,
      dateOfBirth: new Date(dateOfBirth),
      email,
      phone,
      address,
      gpPracticeId,
      isPostHysterectomy: isPostHysterectomy ?? false,
      previousScreeningType,
      isFirstTimeHPVTransition: isFirstTimeHPVTransition ?? false,
      medicalHistory: {
        create: {},
      },
    },
    include: { medicalHistory: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: (session.user as { id?: string }).id,
      action: "CREATE",
      entity: "Patient",
      entityId: patient.id,
      newValue: JSON.stringify({ nhi: patient.nhi }),
    },
  });

  return NextResponse.json(patient, { status: 201 });
}
