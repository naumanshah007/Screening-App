import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  buildPatientScope,
  requirePermission,
  resolvePatientCreatePractice,
  type ResourceActor,
} from "@/lib/auth/resource-access";
import { buildProtectedAuditEntry } from "@/lib/security/audit";

// GET /api/patients - List patients with search
export async function GET(req: NextRequest) {
  const session = await auth();
  const actor = session?.user as ResourceActor | undefined;
  const permissionError = requirePermission(actor, "patients:view");
  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "ACTIVE";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20") || 20));

  const where = {
    AND: [
      buildPatientScope(actor!),
      {
    status: status as "ACTIVE" | "ARCHIVED" | "DECEASED",
    OR: search
      ? [
          { nhi: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ]
      : undefined,
      },
    ],
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

  await prisma.auditLog.create({
    data: buildProtectedAuditEntry({
      userId: actor!.id,
      action: "PHI_LIST_READ",
      entity: "PatientCollection",
      request: req,
      newValue: {
        status,
        searchApplied: Boolean(search),
        returnedCount: patients.length,
        page,
      },
    }),
  });

  return NextResponse.json({ patients, total, page, limit });
}

// POST /api/patients - Create patient
export async function POST(req: NextRequest) {
  const session = await auth();
  const actor = session?.user as ResourceActor | undefined;
  const permissionError = requirePermission(actor, "patients:create");
  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

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

  const scopedPracticeId = resolvePatientCreatePractice({
    actor: actor!,
    requestedGpPracticeId: gpPracticeId,
  });
  if (actor!.role === "GP" && !scopedPracticeId) {
    return NextResponse.json(
      { error: "A GP may create patients only within their configured practice." },
      { status: 403 }
    );
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
      gpPracticeId: scopedPracticeId,
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
    data: buildProtectedAuditEntry({
      userId: actor!.id,
      action: "PATIENT_CREATED",
      entity: "Patient",
      entityId: patient.id,
      request: req,
      newValue: { gpPracticeId: patient.gpPracticeId },
    }),
  });

  return NextResponse.json(patient, { status: 201 });
}
