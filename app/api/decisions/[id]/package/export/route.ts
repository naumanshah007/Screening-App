import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { getCompletedDecisionForUser } from "@/lib/decisions/completed-decisions";
import {
  buildSimulatedDecisionPackage,
  serialiseCsvRow,
  type DecisionPackageFormat,
} from "@/lib/decisions/package-generator";

const FORMATS = ["csv", "fhir", "hl7", "json"] as const;

function isFormat(value: string | null): value is DecisionPackageFormat {
  return Boolean(value && (FORMATS as readonly string[]).includes(value));
}

function responseForFormat(
  format: DecisionPackageFormat,
  decisionId: string,
  pkg: ReturnType<typeof buildSimulatedDecisionPackage>
) {
  const filenameBase = `simulated-decision-package-${decisionId}`;

  if (format === "csv") {
    return new NextResponse(serialiseCsvRow(pkg.csvExportRow), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "hl7") {
    return new NextResponse(pkg.hl7StyleMessage, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.hl7.txt"`,
      },
    });
  }

  const body = format === "fhir" ? pkg.fhirLikeJson : pkg;
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.${format === "fhir" ? "fhir.json" : "json"}"`,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json({ error: "Batch feature is not enabled." }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (!isFormat(format)) {
    return NextResponse.json(
      { error: "format must be one of csv, fhir, hl7, json." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const decision = await getCompletedDecisionForUser(id, user);
  if (!decision) {
    return NextResponse.json({ error: "Completed decision not found." }, { status: 404 });
  }

  const generatedAt = new Date().toISOString();
  const pkg = buildSimulatedDecisionPackage(decision, generatedAt);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SIMULATED_PACKAGE_EXPORT",
      entity: "DecisionPackage",
      entityId: decision.id,
      exportEvent: true,
      newValue: JSON.stringify({
        eventLabel: "Simulated write-back export/download",
        packageLabel: "Integration-ready export package",
        simulated: true,
        actorUserId: user.id,
        batchReviewItemId: decision.id,
        batchRunId: decision.batchRunId,
        format,
        disposition: decision.disposition,
        timestamp: generatedAt,
      }),
    },
  });

  return responseForFormat(format, decision.id, pkg);
}
