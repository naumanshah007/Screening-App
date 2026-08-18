import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";

const NHI_FORMAT = /^[A-HJ-NP-Z]{3}(?:\d{4}|\d{2}[A-HJ-NP-Z]{2})$/;

// GET /api/patients - List patients with search
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "patients:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "ACTIVE";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20") || 20, 1), 100);

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
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "patients:edit");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });

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
    hysterectomyDate,
    hysterectomyType,
    ethnicityPrimary,
    ethnicityOther,
    interpreterRequired,
    preferredLanguage,
  } = body;

  if (!nhi || !firstName || !lastName || !dateOfBirth) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const normalizedNhi = String(nhi).trim().toUpperCase();
  if (!NHI_FORMAT.test(normalizedNhi)) {
    return NextResponse.json({ error: "NHI must use the 7-character NZ NHI format and cannot contain I or O." }, { status: 400 });
  }
  const parsedDob = new Date(dateOfBirth);
  if (Number.isNaN(parsedDob.getTime()) || parsedDob > new Date()) {
    return NextResponse.json({ error: "Date of birth is invalid." }, { status: 400 });
  }
  if (isPostHysterectomy && !["TOTAL", "SUBTOTAL"].includes(hysterectomyType)) {
    return NextResponse.json({ error: "Hysterectomy type is required." }, { status: 400 });
  }

  const existing = await prisma.patient.findUnique({ where: { nhi: normalizedNhi } });
  if (existing) {
    return NextResponse.json({ error: "Patient with this NHI already exists" }, { status: 409 });
  }

  const patient = await prisma.patient.create({
    data: {
      nhi: normalizedNhi,
      firstName,
      lastName,
      dateOfBirth: parsedDob,
      email,
      phone,
      address,
      gpPracticeId,
      isPostHysterectomy: isPostHysterectomy ?? false,
      previousScreeningType,
      isFirstTimeHPVTransition: isFirstTimeHPVTransition ?? false,
      hysterectomyDate: hysterectomyDate ? new Date(hysterectomyDate) : null,
      hysterectomyType: isPostHysterectomy ? hysterectomyType : null,
      ethnicityPrimary: ethnicityPrimary || null,
      ethnicityOther: ethnicityOther || null,
      interpreterRequired: interpreterRequired ?? false,
      preferredLanguage: preferredLanguage || null,
      medicalHistory: {
        create: {},
      },
    },
    include: { medicalHistory: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "CREATE",
      entity: "Patient",
      entityId: patient.id,
      newValue: JSON.stringify({ nhi: patient.nhi }),
    },
  });

  return NextResponse.json(patient, { status: 201 });
}
