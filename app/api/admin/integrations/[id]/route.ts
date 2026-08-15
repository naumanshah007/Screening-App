import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { integrationConnectionUpdateSchema } from "@/lib/integrations/connection-schema";
import { updateIntegrationConnection } from "@/lib/integrations/connections";
import { requireCurrentOrganisation } from "@/lib/organisation/current-organisation";

export async function PATCH(
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
    const parsed = integrationConnectionUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Configuration input is invalid",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    const organisation = await requireCurrentOrganisation();
    const { id } = await params;
    const connection = await updateIntegrationConnection({
      organisationId: organisation.id,
      connectionId: id,
      actorUserId: user!.id!,
      input: parsed.data,
    });
    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update integration configuration" },
      { status: 400 }
    );
  }
}
