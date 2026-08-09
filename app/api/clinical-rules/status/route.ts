import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  return NextResponse.json({ authority: await getClinicalAuthorityDisplay() });
}
