import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/referrals - List referrals with filtering
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        screeningSession: {
          include: {
            patient: {
              select: {
                id: true,
                nhi: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gpPractice: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.referral.count({ where }),
  ]);

  return NextResponse.json({ referrals, total, page, limit });
}

// PATCH /api/referrals/:id - Update referral status
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id, status, appointmentDate, clinicalNotes } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const referral = await prisma.referral.update({
    where: { id },
    data: {
      status,
      appointmentDate: appointmentDate ? new Date(appointmentDate) : undefined,
      clinicalNotes,
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as { id?: string }).id,
      action: "UPDATE",
      entity: "Referral",
      entityId: referral.id,
      newValue: JSON.stringify({ status }),
    },
  });

  return NextResponse.json(referral);
}
