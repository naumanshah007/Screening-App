import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  getSecurityIncidentAutomationOverview,
  isSecurityAutomationSecretValid,
  processSecurityIncidentAutomation,
} from "@/lib/security/incident-automation";
import { canManageSecurityIncidents } from "@/lib/security/incidents";

function canRunAutomation(role?: string) {
  return role === "ADMIN" || role === "INTEGRATION_ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const bearerAuthorized = isSecurityAutomationSecretValid(
    req.headers.get("authorization")
  );

  if (bearerAuthorized && !session) {
    const summary = await processSecurityIncidentAutomation({
      actorUserId: null,
      trigger: "job",
    });

    return NextResponse.json({
      message: "Security incident automation run completed.",
      summary,
    });
  }

  if (!bearerAuthorized && !canRunAutomation(user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overview = await getSecurityIncidentAutomationOverview();
  return NextResponse.json(overview);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const bearerAuthorized = isSecurityAutomationSecretValid(
    req.headers.get("authorization")
  );

  if (!bearerAuthorized && !canManageSecurityIncidents(user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await processSecurityIncidentAutomation({
    actorUserId: bearerAuthorized ? null : user?.id ?? null,
    trigger: bearerAuthorized ? "job" : "manual",
  });

  return NextResponse.json({
    message: "Security incident automation run completed.",
    summary,
  });
}
