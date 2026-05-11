import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  canManageSecurityIncidents,
  sendSecurityIncidentReminder,
} from "@/lib/security/incidents";

export async function POST(
  _req: Request,
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

  try {
    const { id } = await params;
    const incident = await sendSecurityIncidentReminder(id, user.id);

    return NextResponse.json({
      incident,
      message: "Reminder sent.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to send reminder",
      },
      { status: 400 }
    );
  }
}
