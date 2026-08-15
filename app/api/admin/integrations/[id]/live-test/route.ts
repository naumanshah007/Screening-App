import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { runStoredConnectivityCheck } from "@/lib/integrations/connectivity-checks";
import { requireCurrentOrganisation } from "@/lib/organisation/current-organisation";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const organisation = await requireCurrentOrganisation();
    const { id } = await params;
    const outcome = await runStoredConnectivityCheck({
      organisationId: organisation.id,
      connectionId: id,
      actorUserId: user!.id!,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch {
    return NextResponse.json(
      { error: "Unable to complete the live connection test safely." },
      { status: 400 }
    );
  }
}
