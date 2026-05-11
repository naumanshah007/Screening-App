import { NextRequest, NextResponse } from "next/server";
import { SecurityIncidentSeverity } from "@prisma/client";

import { auth } from "@/lib/auth";
import {
  canManageSecurityIncidents,
  createSecurityIncident,
} from "@/lib/security/incidents";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = session.user as { id?: string; role?: string };
  if (!canManageSecurityIncidents(user.role) || !user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    title?: string;
    summary?: string;
    severity?: string;
    sourcePreset?: string | null;
    sourceEntity?: string | null;
    sourceAction?: string | null;
    sourceUserId?: string | null;
    auditFilterJson?: string | null;
  };

  if (!body.title?.trim() || !body.summary?.trim()) {
    return NextResponse.json(
      { error: "Title and summary are required" },
      { status: 400 }
    );
  }

  if (
    !body.severity ||
    !Object.values(SecurityIncidentSeverity).includes(
      body.severity as SecurityIncidentSeverity
    )
  ) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }

  const incident = await createSecurityIncident({
    actorUserId: user.id,
    title: body.title,
    summary: body.summary,
    severity: body.severity as SecurityIncidentSeverity,
    sourcePreset: body.sourcePreset,
    sourceEntity: body.sourceEntity,
    sourceAction: body.sourceAction,
    sourceUserId: body.sourceUserId,
    auditFilterJson: body.auditFilterJson,
  });

  return NextResponse.json({
    incident,
    message: "Security incident opened.",
  });
}
