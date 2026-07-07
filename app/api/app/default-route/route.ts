import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDefaultAppRouteForRole } from "@/lib/auth/permissions";

export async function GET() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  return NextResponse.json({
    route: getDefaultAppRouteForRole(user?.role),
  });
}
