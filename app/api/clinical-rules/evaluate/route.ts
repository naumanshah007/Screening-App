import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  evaluateClinicalCase,
  evaluateWithActiveClinicalRuleVersion,
} from "@/lib/clinical-rules/evaluator";

const BodySchema = z.object({
  facts: z.record(z.string(), z.unknown()),
  ruleVersionId: z.string().trim().min(1).optional(),
  organisationKey: z.string().trim().min(1).optional(),
  evaluationMode: z.enum(["LIVE_DEMO", "SHADOW", "SIMULATION"]).default("SIMULATION"),
  legacyInput: z.record(z.string(), z.unknown()).optional(),
  caseId: z.string().trim().min(1).optional(),
  batchRunId: z.string().trim().min(1).optional(),
  previousEvaluationId: z.string().trim().min(1).optional(),
  regradeReason: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:simulate");
  if (permissionError) return NextResponse.json(permissionError.body, { status: permissionError.status });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const input = parsed.data;
    const result = input.ruleVersionId
      ? await evaluateClinicalCase({
          facts: input.facts,
          ruleVersionId: input.ruleVersionId,
          evaluationMode: input.evaluationMode,
          organisationKey: input.organisationKey,
          legacyInput: input.legacyInput as never,
          caseId: input.caseId,
          batchRunId: input.batchRunId,
          previousEvaluationId: input.previousEvaluationId,
          regradeReason: input.regradeReason,
        })
      : await evaluateWithActiveClinicalRuleVersion({
          facts: input.facts,
          organisationKey: input.organisationKey,
          evaluationMode: input.evaluationMode,
          legacyInput: input.legacyInput as never,
          caseId: input.caseId,
          batchRunId: input.batchRunId,
        });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to evaluate clinical facts" },
      { status: 409 }
    );
  }
}
