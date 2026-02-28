import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/analytics/overdue-recalls
// Phase 1 enhancement: Missing endpoint from report
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const now = new Date();

  const [
    overdueRecalls,
    overdueP1Referrals,
    totalActivePatients,
    pendingReferrals,
    recentSessions,
  ] = await Promise.all([
    prisma.recall.count({
      where: { status: "PENDING", dueDate: { lt: now } },
    }),
    prisma.referral.findMany({
      where: {
        priority: "P1",
        status: { in: ["PENDING", "APPROVED", "AWAITING_APPOINTMENT"] },
      },
      include: {
        screeningSession: {
          include: {
            patient: {
              select: { nhi: true, firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.patient.count({ where: { status: "ACTIVE" } }),
    prisma.referral.count({ where: { status: "PENDING" } }),
    prisma.screeningSession.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Check P1 referrals exceeding target (20 working days)
  const overdueP1 = overdueP1Referrals.filter((r) => {
    const daysSinceCreated = Math.floor(
      (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated > 28; // ~20 working days
  });

  // By-priority referral counts
  const referralsByPriority = await prisma.referral.groupBy({
    by: ["priority", "status"],
    _count: true,
    where: { status: { in: ["PENDING", "AWAITING_APPOINTMENT", "APPROVED"] } },
  });

  // Pathway distribution
  const pathwayDistribution = await prisma.screeningSession.groupBy({
    by: ["activeModule"],
    _count: true,
    where: { activeModule: { not: null } },
  });

  // Avg P1 wait time
  const completedP1 = await prisma.referral.findMany({
    where: { priority: "P1", status: "COMPLETE", appointmentDate: { not: null } },
    select: { createdAt: true, appointmentDate: true },
  });
  const avgP1WaitDays =
    completedP1.length > 0
      ? Math.round(
          completedP1.reduce((sum, r) => {
            return (
              sum +
              (r.appointmentDate!.getTime() - r.createdAt.getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }, 0) / completedP1.length
        )
      : null;

  return NextResponse.json({
    kpis: {
      totalActivePatients,
      overdueRecalls,
      pendingReferrals,
      recentSessions30d: recentSessions,
      avgP1WaitDays,
    },
    overdueP1: overdueP1.map((r) => ({
      referralId: r.id,
      priority: r.priority,
      createdAt: r.createdAt,
      patient: r.screeningSession.patient,
      daysSince: Math.floor(
        (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    })),
    referralsByPriority,
    pathwayDistribution,
  });
}
