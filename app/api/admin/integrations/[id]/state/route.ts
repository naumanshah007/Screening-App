import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { integrationConnectionStateActionSchema } from "@/lib/integrations/connection-schema";
import { changeIntegrationConnectionState } from "@/lib/integrations/connections";
import { requireCurrentOrganisation } from "@/lib/organisation/current-organisation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const parsed = integrationConnectionStateActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "State action is invalid" }, { status: 400 });
    }
    const organisation = await requireCurrentOrganisation();
    const { id } = await params;
    const connection = await changeIntegrationConnectionState({
      organisationId: organisation.id,
      connectionId: id,
      actorUserId: user!.id!,
      action: parsed.data.action,
    });
    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to change integration state" },
      { status: 400 }
    );
  }
}
