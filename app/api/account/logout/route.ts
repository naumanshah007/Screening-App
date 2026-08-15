import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  recordSecurityEvent,
  SECURITY_EVENT_ACTION,
} from "@/lib/security/events";

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await recordSecurityEvent({
    action: SECURITY_EVENT_ACTION.LOGOUT,
    userId: user.id,
    request,
    details: { method: "user_initiated" },
  });
  return NextResponse.json({ ok: true });
}
