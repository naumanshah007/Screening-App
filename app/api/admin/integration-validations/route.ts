import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  ENTERPRISE_INTEGRATION_IDS,
  saveIntegrationValidation,
  type EnterpriseIntegrationId,
  type IntegrationValidationOutcomeValue,
} from "@/lib/ops/integration-validations";

function parseDate(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return date;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const permissionError = getApiPermissionError(user, "admin:settings");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const body = (await req.json()) as {
      integrationId?: EnterpriseIntegrationId;
      environment?: string | null;
      outcome?: IntegrationValidationOutcomeValue;
      summary?: string;
      notes?: string | null;
      validatedAt?: string;
      expiresAt?: string | null;
    };

    if (!body.integrationId || !ENTERPRISE_INTEGRATION_IDS.includes(body.integrationId)) {
      return NextResponse.json({ error: "Integration is required" }, { status: 400 });
    }

    if (!body.outcome || !["PASSED", "WARNING", "FAILED"].includes(body.outcome)) {
      return NextResponse.json({ error: "Validation outcome is required" }, { status: 400 });
    }

    if (typeof body.summary !== "string" || !body.summary.trim()) {
      return NextResponse.json({ error: "Validation summary is required" }, { status: 400 });
    }

    const validatedAt = parseDate(body.validatedAt, "Validated date");
    const expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt.trim()
        ? parseDate(body.expiresAt, "Expiry date")
        : null;

    if (expiresAt && expiresAt.getTime() < validatedAt.getTime()) {
      return NextResponse.json(
        { error: "Expiry date cannot be earlier than the validated date" },
        { status: 400 }
      );
    }

    const validation = await saveIntegrationValidation({
      integrationId: body.integrationId,
      environment: body.environment,
      outcome: body.outcome,
      summary: body.summary,
      notes: body.notes,
      validatedAt,
      expiresAt,
      validatedByUserId: user!.id!,
    });

    return NextResponse.json({
      ok: true,
      id: validation.id,
      message: `Recorded ${body.outcome.toLowerCase()} validation for ${body.integrationId}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save integration validation",
      },
      { status: 400 }
    );
  }
}
