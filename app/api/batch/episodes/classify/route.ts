import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { summariseClassifications } from "@/lib/batch/episode-classification";
import { classifyIncomingCases } from "@/lib/batch/episode-registry";
import { processBatch } from "@/lib/batch/processor";
import type { CanonicalBatchCase } from "@/lib/batch/types";
import { requireCurrentOrganisationId } from "@/lib/organisation/current-organisation";
import { safeLogError } from "@/lib/security/safe-logging";

/**
 * Has any of this been seen before?
 *
 * READ-ONLY. Writes nothing, decides nothing clinical, and returns no clinical
 * recommendation — it reports only whether each arriving case matches an
 * episode already on record.
 *
 * WHY IT IS SEPARATE FROM /api/batch/process
 * ------------------------------------------
 * Process runs when the operator commits a selection. This question is asked
 * *before* selecting — "am I about to queue work that is already done?" — so it
 * needs its own call at pull time. Keeping it separate also means a failure here
 * degrades to "everything looks new", which is the behaviour that existed before
 * this feature, rather than blocking intake.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "batch:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    const body = (await req.json()) as { cases?: CanonicalBatchCase[] };
    const cases = body.cases;
    if (!Array.isArray(cases)) {
      return NextResponse.json({ error: "cases[] is required" }, { status: 400 });
    }
    if (cases.length > 500) {
      return NextResponse.json(
        { error: `Too many cases (${cases.length}). Maximum is 500.` },
        { status: 400 }
      );
    }

    // The clinical digest is taken over ClinicalInput, so the cases must go
    // through the same mapping the real path uses. No decision is persisted and
    // none is returned.
    const routed = processBatch(cases, { includeWarnings: true, includeInvalid: true });

    const classified = await classifyIncomingCases({
      organisationId: await requireCurrentOrganisationId(),
      items: routed.results,
    });

    return NextResponse.json({
      summary: summariseClassifications(classified),
      // Keyed by the caller's own case id so the client cannot mis-align rows.
      episodes: classified.map((entry) => ({
        caseId: routed.results[entry.index]?.case.caseId ?? null,
        classification: entry.classification,
        processable: entry.processable,
        explanation: entry.explanation,
        matchedEpisodeId: entry.matchedEpisodeId,
      })),
    });
  } catch (error) {
    safeLogError("batch.episode_classification.failed", error);
    return NextResponse.json(
      { error: "Unable to classify the supplied cases." },
      { status: 400 }
    );
  }
}
