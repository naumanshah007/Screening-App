import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { requestAuditMetadata } from "@/lib/clinical-rules/governance";
import { evaluateClinicalCase } from "@/lib/clinical-rules/evaluator";
import { getClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { prisma } from "@/lib/prisma";
import {
  isPersistedManualRegradeRetry,
  recordManualRegradeUsage,
} from "@/lib/usage/manual-regrade";
import { requireUsageEventEpisode } from "@/lib/usage/usage-events";

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
  const reason = parsed.data.reason;
  try {
    const [target, run] = await Promise.all([
      getClinicalRuleVersion(parsed.data.ruleVersionId),
      prisma.batchRun.findUnique({
        where: { id: runId },
        include: {
          items: {
            where: { disposition: "PENDING" },
            select: {
              id: true,
              inputJson: true,
              episodeId: true,
              ruleEvaluationId: true,
              ruleEvaluation: true,
            },
          },
        },
      }),
    ]);
    if (!target) return NextResponse.json({ error: "Clinical rule version not found" }, { status: 404 });
    if (!run) return NextResponse.json({ error: "Batch run not found" }, { status: 404 });
    if (!["PUBLISHED", "ACTIVE"].includes(target.status)) {
      return NextResponse.json({ error: "Open cases can only be regraded with a published or active version" }, { status: 409 });
    }
    if (!run.organisationId) {
      return NextResponse.json(
        { error: "MANUAL_REGRADE_ORGANISATION_REQUIRED" },
        { status: 409 }
      );
    }

    // Fail before creating any immutable evaluation if usage cannot be attached
    // to a durable episode. Historical pre-episode cases remain readable but
    // cannot produce unattributable new metered work.
    const unlinked = run.items.find((item) => !item.episodeId);
    if (unlinked) {
      return NextResponse.json(
        { error: "MANUAL_REGRADE_EPISODE_REQUIRED", itemId: unlinked.id },
        { status: 409 }
      );
    }
    await prisma.$transaction(async (tx) => {
      for (const item of run.items) {
        await requireUsageEventEpisode({
          tx,
          organisationId: run.organisationId!,
          episodeId: item.episodeId!,
        });
      }
    });

    const changes: Array<{
      itemId: string;
      previousEvaluationId: string | null;
      evaluationId: string;
      changedFields: string[];
      reused: boolean;
    }> = [];
    for (const item of run.items) {
      if (
        isPersistedManualRegradeRetry({
          evaluation: item.ruleEvaluation,
          targetRuleVersionId: target.id,
          reason,
        })
      ) {
        // The evaluation already exists: retry only the idempotent metering
        // write. No new evaluation and no second REGRADE event are created.
        await prisma.$transaction((tx) =>
          recordManualRegradeUsage({
            tx,
            organisationId: run.organisationId!,
            episodeId: item.episodeId!,
            batchReviewItemId: item.id,
            ruleEvaluationId: item.ruleEvaluation!.id,
            batchRunId: run.id,
            rulesetVersion: target.displayVersion,
            rulesetChecksum: target.checksum,
            source: run.source,
          })
        );
        changes.push({
          itemId: item.id,
          previousEvaluationId: item.ruleEvaluation!.previousEvaluationId,
          evaluationId: item.ruleEvaluation!.id,
          changedFields: [],
          reused: true,
        });
        continue;
      }

      const next = await evaluateClinicalCase({
        facts: JSON.parse(item.inputJson) as Record<string, unknown>,
        ruleVersionId: target.id,
        evaluationMode: "LIVE_DEMO",
        batchRunId: run.id,
        previousEvaluationId: item.ruleEvaluationId ?? undefined,
        regradeReason: reason,
      });
      await prisma.$transaction(async (tx) => {
        await tx.batchReviewItem.update({
          where: { id: item.id },
          data: { ruleEvaluationId: next.evaluationId },
        });
        await recordManualRegradeUsage({
          tx,
          organisationId: run.organisationId!,
          episodeId: item.episodeId!,
          batchReviewItemId: item.id,
          ruleEvaluationId: next.evaluationId,
          batchRunId: run.id,
          rulesetVersion: target.displayVersion,
          rulesetChecksum: target.checksum,
          source: run.source,
        });
      });

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
      changes.push({
        itemId: item.id,
        previousEvaluationId: item.ruleEvaluationId,
        evaluationId: next.evaluationId,
        changedFields,
        reused: false,
      });
    }

    const metadata = requestAuditMetadata(request);
    await prisma.$transaction([
      prisma.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: target.ruleSetId,
          ruleVersionId: target.id,
          actorUserId: user!.id!,
          eventType: "REGRADE",
          reason,
          beforeJson: JSON.stringify({ batchRunId: run.id, pinnedRuleVersionId: run.pinnedRuleVersionId }),
          afterJson: JSON.stringify({
            batchRunId: run.id,
            regradedItems: changes.filter((change) => !change.reused).length,
            reusedPersistedRegrades: changes.filter((change) => change.reused).length,
            targetRuleVersionId: target.id,
          }),
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
          newValue: JSON.stringify({
            targetRuleVersionId: target.id,
            regradedItems: changes.filter((change) => !change.reused).length,
            reusedPersistedRegrades: changes.filter((change) => change.reused).length,
            reason,
          }),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    return NextResponse.json({
      batchRunId: run.id,
      pinnedVersionPreserved: run.pinnedRuleVersionDisplay,
      targetVersion: target.displayVersion,
      regraded: changes.filter((change) => !change.reused).length,
      reused: changes.filter((change) => change.reused).length,
      changed: changes.filter(
        (change) => !change.reused && change.changedFields.length > 0
      ).length,
      changes,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to regrade open cases" }, { status: 409 });
  }
}
