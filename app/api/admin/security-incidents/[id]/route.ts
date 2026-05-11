import { NextRequest, NextResponse } from "next/server";
import { SecurityIncidentStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import {
  canManageSecurityIncidents,
  updateSecurityIncident,
} from "@/lib/security/incidents";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { id?: string; role?: string };
  if (!canManageSecurityIncidents(user.role) || !user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    status?: string;
    assignedToUserId?: string | null;
    dueAt?: string | null;
    resolutionNotes?: string | null;
  };

  if (
    body.status &&
    !Object.values(SecurityIncidentStatus).includes(
      body.status as SecurityIncidentStatus
    )
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (body.dueAt) {
    const parsedDueAt = new Date(body.dueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
  }

  try {
    const incident = await updateSecurityIncident(id, user.id, {
      status: body.status as SecurityIncidentStatus | undefined,
      assignedToUserId:
        body.assignedToUserId === undefined ? undefined : body.assignedToUserId,
      dueAt:
        body.dueAt === undefined
          ? undefined
          : body.dueAt
            ? new Date(body.dueAt)
            : null,
      resolutionNotes:
        body.resolutionNotes === undefined ? undefined : body.resolutionNotes,
    });

    return NextResponse.json({
      incident,
      message: "Security incident updated.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update security incident",
      },
      { status: 400 }
    );
  }
}
