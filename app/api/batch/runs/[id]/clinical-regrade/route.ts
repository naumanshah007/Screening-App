import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { evaluateClinicalCase } from "@/lib/clinical-rules/evaluator";
import { getClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  ruleVersionId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:simulate");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A published ruleset version and regrade reason are required" }, { status: 400 });

  const runId = (await params).id;
  try {
    const [target, run] = await Promise.all([
      getClinicalRuleVersion(parsed.data.ruleVersionId),
      prisma.batchRun.findUnique({
        where: { id: runId },
        include: {
          items: {
            where: { disposition: "PENDING" },
            select: { id: true, inputJson: true, ruleEvaluationId: true, ruleEvaluation: true },
          },
        },
      }),
    ]);
    if (!target) return NextResponse.json({ error: "Clinical rule version not found" }, { status: 404 });
    if (!run) return NextResponse.json({ error: "Batch run not found" }, { status: 404 });
    if (!["PUBLISHED", "ACTIVE"].includes(target.status)) {
      return NextResponse.json({ error: "Open cases can only be regraded with a published or active version" }, { status: 409 });
    }

    const changes: Array<{ itemId: string; previousEvaluationId: string | null; evaluationId: string; changedFields: string[] }> = [];
    for (const item of run.items) {
      const next = await evaluateClinicalCase({
        facts: JSON.parse(item.inputJson) as Record<string, unknown>,
        ruleVersionId: target.id,
        evaluationMode: "LIVE_DEMO",
        batchRunId: run.id,
        previousEvaluationId: item.ruleEvaluationId ?? undefined,
        regradeReason: parsed.data.reason,
      });
      await prisma.batchReviewItem.update({ where: { id: item.id }, data: { ruleEvaluationId: next.evaluationId } });

      const before = item.ruleEvaluation;
      const comparisons: Array<[string, string | null, string | null]> = before
        ? [
            ["recommendation", before.provisionalRecommendation, next.result.provisionalRecommendation],
            ["risk", before.riskLevel, next.result.riskLevel],
            ["urgency", before.urgency, next.result.urgency ?? null],
            ["destination", before.referralDestination, next.result.referralDestination ?? null],
            ["repeat interval", before.repeatInterval, next.result.repeatInterval ?? null],
            ["reviewer requirement", before.reviewerRequirement, next.result.clinicianOnly ? "CLINICIAN_ONLY" : "MANDATORY_CLINICIAN_CONFIRMATION"],
            ["missing information", before.missingInformation, JSON.stringify(next.result.missingInformation)],
            ["pathway", before.branchPath, JSON.stringify(next.result.branchPath)],
          ]
        : [];
      const changedFields = before
        ? comparisons.filter(([, previous, current]) => previous !== current).map(([field]) => field)
        : ["new governed evaluation"];
      changes.push({ itemId: item.id, previousEvaluationId: item.ruleEvaluationId, evaluationId: next.evaluationId, changedFields });
    }

    const metadata = requestAuditMetadata(request);
    await prisma.$transaction([
      prisma.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: target.ruleSetId,
          ruleVersionId: target.id,
          actorUserId: user!.id!,
          eventType: "REGRADE",
          reason: parsed.data.reason,
          beforeJson: JSON.stringify({ batchRunId: run.id, pinnedRuleVersionId: run.pinnedRuleVersionId }),
          afterJson: JSON.stringify({ batchRunId: run.id, regradedItems: changes.length, targetRuleVersionId: target.id }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: user!.id!,
          action: "CLINICAL_RULE_REGRADE",
          entity: "BatchRun",
          entityId: run.id,
          oldValue: JSON.stringify({ pinnedRuleVersionId: run.pinnedRuleVersionId }),
          newValue: JSON.stringify({ targetRuleVersionId: target.id, regradedItems: changes.length, reason: parsed.data.reason }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    return NextResponse.json({
      batchRunId: run.id,
      pinnedVersionPreserved: run.pinnedRuleVersionDisplay,
      targetVersion: target.displayVersion,
      regraded: changes.length,
      changed: changes.filter((change) => change.changedFields.length > 0).length,
      changes,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to regrade open cases" }, { status: 409 });
  }
}
