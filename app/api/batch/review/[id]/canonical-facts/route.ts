import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  CanonicalClinicalFactsV2Schema,
  CanonicalFactSourceSchema,
} from "@/lib/clinical-rules/canonical-facts-v2";
import { evaluateClinicalCase } from "@/lib/clinical-rules/evaluator";
import { parseSnapshot } from "@/lib/clinical-rules/schema";
import { snapshotFactNames } from "@/lib/clinical-rules/canonical-facts-v2";
import { prisma } from "@/lib/prisma";

const FactValueSchema = z.union([
  z.string().max(1_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([z.string().max(1_000), z.number().finite(), z.boolean()])).max(100),
]);

const CorrectionSchema = z
  .object({
    factName: z.string().trim().min(1).max(160),
    status: z.enum([
      "KNOWN",
      "UNKNOWN",
      "NOT_RECORDED",
      "NOT_APPLICABLE",
      "PENDING",
      "CONFLICTING",
    ]),
    value: FactValueSchema.optional(),
    source: CanonicalFactSourceSchema,
    sourceDocumentId: z.string().trim().min(1).max(300).optional(),
    externalReference: z.string().trim().min(1).max(300).optional(),
    observedAt: z.string().datetime().optional(),
    reason: z.string().trim().min(10).max(2_000),
  })
  .superRefine((input, context) => {
    if (input.status === "KNOWN" && input.value === undefined) {
      context.addIssue({ code: "custom", path: ["value"], message: "KNOWN requires a value." });
    }
    if (input.status !== "KNOWN" && input.value !== undefined) {
      context.addIssue({ code: "custom", path: ["value"], message: `${input.status} cannot carry a value.` });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:grade");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  const parsed = CorrectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid canonical fact correction", issues: parsed.error.issues }, { status: 400 });
  }

  const reviewItem = await prisma.batchReviewItem.findUnique({
    where: { id: (await params).id },
    include: {
      ruleEvaluation: { include: { ruleVersion: true } },
    },
  });
  if (!reviewItem?.ruleEvaluation) {
    return NextResponse.json({ error: "Canonical shadow evaluation not found." }, { status: 404 });
  }
  if (reviewItem.disposition !== "PENDING") {
    return NextResponse.json(
      { error: "Completed decisions are immutable; create an explicit regrade workflow instead." },
      { status: 409 }
    );
  }

  try {
    const snapshot = parseSnapshot(JSON.parse(reviewItem.ruleEvaluation.ruleVersion.snapshotJson));
    if (!snapshotFactNames(snapshot).has(parsed.data.factName)) {
      return NextResponse.json(
        { error: "Fact name is not used by the pinned clinical ruleset." },
        { status: 400 }
      );
    }
    const priorFacts = CanonicalClinicalFactsV2Schema.parse(
      JSON.parse(reviewItem.ruleEvaluation.canonicalInputSnapshot)
    );
    const previous = priorFacts.facts[parsed.data.factName];
    const now = new Date().toISOString();
    const nextFacts = CanonicalClinicalFactsV2Schema.parse({
      ...priorFacts,
      capturedAt: now,
      facts: {
        ...priorFacts.facts,
        [parsed.data.factName]: {
          ...(parsed.data.status === "KNOWN" ? { value: parsed.data.value } : {}),
          status: parsed.data.status,
          source: parsed.data.source,
          observedAt: parsed.data.observedAt,
          recordedAt: now,
          enteredBy: user!.id!,
          verifiedBy: user!.id!,
          verificationStatus:
            parsed.data.status === "CONFLICTING" ? "CONFLICTING" : "REVIEWER_VERIFIED",
          sourceDocumentId: parsed.data.sourceDocumentId,
          externalReference: parsed.data.externalReference,
          corrections: [
            ...(previous?.corrections ?? []),
            ...(previous
              ? [{
                  correctedAt: now,
                  correctedBy: user!.id!,
                  reason: parsed.data.reason,
                  previousStatus: previous.status,
                  ...(previous.value === undefined ? {} : { previousValue: previous.value }),
                }]
              : []),
          ],
        },
      },
    });
    const next = await evaluateClinicalCase({
      canonicalFactsV2: nextFacts,
      ruleVersionId: reviewItem.ruleEvaluation.ruleVersionId,
      evaluationMode: "SHADOW",
      legacyInput: JSON.parse(reviewItem.inputJson),
      batchRunId: reviewItem.batchRunId,
      previousEvaluationId: reviewItem.ruleEvaluation.id,
      regradeReason: parsed.data.reason,
    });
    const updated = await prisma.batchReviewItem.updateMany({
      where: {
        id: reviewItem.id,
        disposition: "PENDING",
        ruleEvaluationId: reviewItem.ruleEvaluation.id,
      },
      data: { ruleEvaluationId: next.evaluationId },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "The review item changed while the correction was evaluated. Refresh before continuing." },
        { status: 409 }
      );
    }
    await prisma.auditLog.create({
      data: {
        userId: user!.id!,
        action: "CANONICAL_FACT_CORRECTED_AND_REEVALUATED",
        entity: "BatchReviewItem",
        entityId: reviewItem.id,
        oldValue: JSON.stringify({ ruleEvaluationId: reviewItem.ruleEvaluation.id }),
        newValue: JSON.stringify({
          ruleEvaluationId: next.evaluationId,
          factName: parsed.data.factName,
          status: parsed.data.status,
          source: parsed.data.source,
          reason: parsed.data.reason,
        }),
      },
    });
    return NextResponse.json({
      evaluationId: next.evaluationId,
      previousEvaluationId: reviewItem.ruleEvaluation.id,
      result: next.result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to correct canonical fact" },
      { status: 400 }
    );
  }
}
