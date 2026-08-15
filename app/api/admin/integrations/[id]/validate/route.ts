import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { validateStoredIntegrationConnection } from "@/lib/integrations/connections";
import { requireCurrentOrganisation } from "@/lib/organisation/current-organisation";

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
    const result = await validateStoredIntegrationConnection({
      organisationId: organisation.id,
      connectionId: id,
      actorUserId: user!.id!,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate integration configuration" },
      { status: 400 }
    );
  }
}
