import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processBatch } from "@/lib/batch/processor";
import type { CanonicalBatchCase } from "@/lib/batch/types";
import { isFeatureEnabled } from "@/lib/features";

/**
 * POST /api/batch/process
 *
 * Accepts an array of CanonicalBatchCase objects,
 * processes each through the decision engine, and returns results.
 *
 * This is the batch equivalent of POST /api/rules/evaluate.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
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

    // Process batch
    const result = processBatch(cases, {
      includeWarnings: body.includeWarnings ?? true,
      includeInvalid: body.includeInvalid ?? false,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Batch processing failed: ${message}` },
      { status: 500 }
    );
  }
}
