import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { integrationConnectionInputSchema } from "@/lib/integrations/connection-schema";
import { createIntegrationConnection } from "@/lib/integrations/connections";
import { requireCurrentOrganisation } from "@/lib/organisation/current-organisation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const parsed = integrationConnectionInputSchema.safeParse(await request.json());
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
    const connection = await createIntegrationConnection({
      organisationId: organisation.id,
      actorUserId: user!.id!,
      input: parsed.data,
    });
    return NextResponse.json({ ok: true, connection }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create integration configuration" },
      { status: 400 }
    );
  }
}
