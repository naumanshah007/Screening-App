import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { resolveActiveClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

const QuerySchema = z.object({
  environment: z.enum(["DEMO", "TEST", "VALIDATION", "PRODUCTION"]).default("DEMO"),
  organisationKey: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:view");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const url = new URL(request.url);
  const query = QuerySchema.safeParse({
    environment: url.searchParams.get("environment") ?? undefined,
    organisationKey: url.searchParams.get("organisationKey") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Invalid active-version query" }, { status: 400 });
  const version = await resolveActiveClinicalRuleVersion(query.data);
  return NextResponse.json({ version });
}
