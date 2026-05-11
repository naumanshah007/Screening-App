/**
 * POST /api/cases/[id]/ai/recommend
 *
 * Runs AI-assisted grading on a referral case and returns a suggested priority.
 *
 * Data sovereignty guarantee:
 *   Patient clinical data is sent ONLY to the configured AI_PROVIDER.
 *   When AI_PROVIDER=ollama (the hospital default), all inference runs on-premises.
 *   The Anthropic provider is available for development/evaluation on synthetic data only.
 *
 * Prerequisites:
 *   - Case must have an APPROVED clinical summary
 *   - ENABLE_AI_ASSIST=true in environment
 *   - AI provider must be reachable (Ollama running, or ANTHROPIC_API_KEY set)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";
import {
  buildGradingSystemPrompt,
  buildGradingUserPrompt,
  PROMPT_VERSION,
  type GradingOutput,
} from "@/lib/ai/prompts";
import { aiProvider } from "@/lib/ai/provider";
import { parseGradeRecommendationPayload } from "@/lib/cases/grading";
import type { TriagePriority } from "@prisma/client";

const VALID_PRIORITIES = new Set<string>([
  "P1", "P1_HSC", "P2", "P2_HSC", "P3", "P5",
  "REJECT", "DECLINE", "INFO_REQUIRED",
]);

function isPriority(value: unknown): value is TriagePriority {
  return typeof value === "string" && VALID_PRIORITIES.has(value);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled("casesV2") || !isFeatureEnabled("aiAssist")) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 404 });
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "ai:recommend");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }
  const userId = user?.id ?? null;

  const { id } = await params;

  const referralCase = await prisma.referralCase.findUnique({
    where: { id },
    include: {
      summary: { select: { renderedMarkdown: true, status: true } },
      ruleDecision: {
        select: { priority: true, category: true, outcome: true, rationale: true, traceJson: true },
      },
    },
  });

  if (!referralCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (!referralCase.summary || referralCase.summary.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Clinical summary must be approved before AI assist can run." },
      { status: 422 }
    );
  }

  const deterministicRecommendation = referralCase.ruleDecision
    ? (() => {
        const payload = parseGradeRecommendationPayload(referralCase.ruleDecision.traceJson);
        return {
          priority: referralCase.ruleDecision.priority ?? "INFO_REQUIRED",
          category: referralCase.ruleDecision.category ?? "",
          outcome: referralCase.ruleDecision.outcome,
          rationale: payload.rationale.join(" "),
        };
      })()
    : null;

  const systemPrompt = buildGradingSystemPrompt(referralCase.serviceLine);
  const userPrompt = buildGradingUserPrompt({
    serviceLine: referralCase.serviceLine,
    clinicalSummaryMarkdown: referralCase.summary.renderedMarkdown,
    deterministicRecommendation,
  });

  // ── Call the AI provider (Ollama / Anthropic / Stub) ──────────────────────
  // The provider is determined by AI_PROVIDER env var.
  // In hospital production: AI_PROVIDER=ollama (data stays on-premises).

  const inputJson = JSON.stringify({
    provider: aiProvider.providerName,
    model: aiProvider.modelName,
    system: systemPrompt,
    user: userPrompt,
  });

  const inferenceResult = await aiProvider.infer({
    systemPrompt,
    userPrompt,
    maxTokens: 1024,
  });

  if (!inferenceResult.ok) {
    const statusCode =
      inferenceResult.code === "TIMEOUT" ? 504
      : inferenceResult.code === "CONFIG_MISSING" ? 503
      : 502;

    return NextResponse.json(
      {
        error: inferenceResult.error,
        provider: aiProvider.providerName,
        hint:
          aiProvider.providerName === "ollama"
            ? "Ensure Ollama is running: `ollama serve` and the model is pulled: `ollama pull mistral:7b-instruct`"
            : undefined,
      },
      { status: statusCode }
    );
  }

  // ── Parse the JSON output ─────────────────────────────────────────────────

  let parsedOutput: GradingOutput;

  try {
    // Extract JSON object from the raw text (model may include surrounding text)
    const jsonMatch = inferenceResult.rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in model output");
    }
    parsedOutput = JSON.parse(jsonMatch[0]) as GradingOutput;
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to parse AI response as JSON",
        detail: String(err),
        rawOutput: inferenceResult.rawText.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const suggestedPriority = isPriority(parsedOutput.suggestedPriority)
    ? parsedOutput.suggestedPriority
    : null;

  // ── Persist the recommendation ────────────────────────────────────────────

  const aiRec = await prisma.aIRecommendation.create({
    data: {
      caseId: id,
      modelName: inferenceResult.modelName,      // e.g. "mistral:7b-instruct"
      modelVersion: inferenceResult.providerName, // e.g. "ollama"
      promptVersion: PROMPT_VERSION,
      inputJson,
      outputJson: inferenceResult.rawText,
      suggestedPriority,
      suggestedCategory: parsedOutput.suggestedCategory ?? null,
      suggestedOutcome: parsedOutput.suggestedOutcome ?? null,
      rationale: parsedOutput.rationale ?? null,
      confidence:
        typeof parsedOutput.confidence === "number" ? parsedOutput.confidence : null,
      citations: parsedOutput.citations
        ? JSON.stringify(parsedOutput.citations)
        : null,
      concordantWithRule: parsedOutput.concordantWithRule ?? null,
      generatedByUserId: userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "AI_RECOMMEND",
      entity: "ReferralCase",
      entityId: id,
      newValue: JSON.stringify({
        aiRecommendationId: aiRec.id,
        priority: suggestedPriority,
        provider: inferenceResult.providerName,
        model: inferenceResult.modelName,
        stub: aiProvider.isStub,
      }),
    },
  });

  return NextResponse.json({
    id: aiRec.id,
    suggestedPriority,
    suggestedCategory: parsedOutput.suggestedCategory,
    suggestedOutcome: parsedOutput.suggestedOutcome,
    rationale: parsedOutput.rationale,
    confidence: parsedOutput.confidence,
    citations: parsedOutput.citations,
    concordantWithRule: parsedOutput.concordantWithRule,
    reasoning: parsedOutput.reasoning,
    // Provider metadata for UI display
    provider: inferenceResult.providerName,
    model: inferenceResult.modelName,
    isStub: aiProvider.isStub,
  });
}
