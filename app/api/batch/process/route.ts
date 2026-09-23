import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { safeLogError } from "@/lib/security/safe-logging";
import { processBatch } from "@/lib/batch/processor";
import { summariseClassifications } from "@/lib/batch/episode-classification";
import { classifyIncomingCases } from "@/lib/batch/episode-registry";
import { requireCurrentOrganisationId } from "@/lib/organisation/current-organisation";
import type { CanonicalBatchCase } from "@/lib/batch/types";
import { isFeatureEnabled } from "@/lib/features";
import {
  PREVIEW_PENDING_ACTION,
  PREVIEW_PENDING_CODE,
  PREVIEW_PENDING_TEXT,
} from "@/lib/batch/preview-state";

/**
 * POST /api/batch/process — routing and validation preview.
 *
 * Accepts CanonicalBatchCase objects, routes each one, and returns validation
 * and pathway information so a reviewer can choose which rows to add to the
 * Review Queue.
 *
 * IT DOES NOT PRODUCE A CLINICAL RECOMMENDATION.
 *
 * Nothing here is persisted, so no governed evaluation has taken place. The
 * governed recommendation is generated at persistence time by
 * saveBatchRun → evaluateGradedDecision, against the current governed ruleset.
 * Presenting the legacy engine's recommendation here would show an authoritative
 * Legacy decision for a brand-new case while the rest of the application
 * reported CG-NCSP-3.1.0 — the mixed-authority defect this endpoint caused.
 */


export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "batch:manage");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  // Feature flag check
  if (!isFeatureEnabled("batchDemo")) {
    return NextResponse.json(
      { error: "Batch demo feature is not enabled." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    // Validate input is an array
    if (!Array.isArray(body.cases)) {
      return NextResponse.json(
        { error: "Request body must contain a 'cases' array of CanonicalBatchCase objects." },
        { status: 400 }
      );
    }

    const cases: CanonicalBatchCase[] = body.cases;

    // Sanity limit — demo/POC, not for thousands of rows
    if (cases.length > 500) {
      return NextResponse.json(
        { error: `Too many cases (${cases.length}). Maximum is 500 for demo processing.` },
        { status: 400 }
      );
    }

    // Routing and validation only.
    //
    // processBatch runs the legacy engine. That engine still supplies routing —
    // figure selection, age gates, validation — but its RECOMMENDATION is not
    // the clinical authority for a new case, and this endpoint does not persist
    // anything, so no governed evaluation has happened yet.
    //
    // Returning its recommendation made the preview display an authoritative
    // Legacy decision while the rest of the application reported CG-NCSP-3.1.0.
    // The recommendation is therefore redacted here, on the server, so the
    // legacy clinical text never reaches the browser at all. The governed
    // recommendation is produced when the rows are added to the Review Queue,
    // which routes through saveBatchRun → evaluateGradedDecision.
    const result = processBatch(cases, {
      includeWarnings: body.includeWarnings ?? true,
      includeInvalid: body.includeInvalid ?? false,
    });

    // Episode classification, read-only.
    //
    // Runs here so the intake screen can report "already in review" and
    // "updated" BEFORE anything is committed — which is the whole point of a
    // preview. It writes nothing, so this endpoint's contract is unchanged.
    //
    // A failure must not block intake: without classification the operator sees
    // every case as new, which is the behaviour that existed before this
    // feature and is safe. Silently dropping cases would not be.
    let episodes: Awaited<ReturnType<typeof classifyIncomingCases>> = [];
    try {
      episodes = await classifyIncomingCases({
        organisationId: await requireCurrentOrganisationId(),
        items: result.results,
      });
    } catch (error) {
      safeLogError("batch.preview.episode_classification_unavailable", error);
    }

    // ── Allowlist, not object spread ──────────────────────────────────────
    //
    // The response used to spread the legacy decision and then blank a handful
    // of fields. Everything not named survived: recallIntervalMonths,
    // recallRequired, referralRequired, nextScreeningIntervalMonths and
    // riskLevel all reached the browser, and the drawer rendered the recall
    // interval on a row that simultaneously said no recommendation existed.
    //
    // A preview may state ONLY the source facts and the routing outcome. If a
    // field is not on this list it is not in the response, so a new field on
    // ClinicalDecision cannot leak by default.
    const preview = {
      totalTimeMs: result.totalTimeMs,
      processedCount: result.processedCount,
      errorCount: result.errorCount,
      errors: result.errors,
      sourceType: result.sourceType,
      sourceFileName: result.sourceFileName,
      processedAt: result.processedAt,
      engineVersion: result.engineVersion,
      previewOnly: true as const,
      previewGeneratedAt: new Date().toISOString(),
      episodeSummary: summariseClassifications(episodes),
      results: result.results.map((item, index) => ({
        case: item.case,
        input: item.input,
        processingTimeMs: item.processingTimeMs,
        status: item.status,
        error: item.error,
        episode: episodes[index]
          ? {
              classification: episodes[index].classification,
              processable: episodes[index].processable,
              explanation: episodes[index].explanation,
              matchedEpisodeId: episodes[index].matchedEpisodeId,
            }
          : null,
        decision: {
          // Routing state only. The pathway is what the reviewer needs in
          // order to choose rows, and it is the one thing that has actually
          // been determined at this point.
          figure: item.decision.figure,
          recommendation: PREVIEW_PENDING_TEXT,
          recommendationCode: PREVIEW_PENDING_CODE,
          nextAction: PREVIEW_PENDING_ACTION,
          // Safety stops are routing outcomes and are retained: they tell the
          // reviewer this row cannot be graded, which is not a clinical action.
          safetyOutcome: item.decision.safetyOutcome ?? null,
          // Everything clinical is absent, not blanked: no risk level, no
          // referral, no recall, no timing, no intervals.
        },
      })),
    };

    return NextResponse.json(preview);
  } catch (e) {
    safeLogError("batch.preview.failed", e);
    return NextResponse.json(
      { error: "Batch processing failed. The request was not persisted." },
      { status: 500 }
    );
  }
}
