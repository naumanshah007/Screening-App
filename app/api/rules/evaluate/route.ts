import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import type { ClinicalInput } from "@/lib/engine/types";

// POST /api/rules/evaluate - Test rule evaluation without saving
// Phase 1 enhancement: Missing endpoint from report
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  const input: ClinicalInput = {
    ...body,
    patientId: body.patientId ?? "preview",
    isFirstTimeHPVTransition: body.isFirstTimeHPVTransition ?? false,
    isPostHysterectomy: body.isPostHysterectomy ?? false,
    atypicalEndometrialHistory: body.atypicalEndometrialHistory ?? false,
    immunocompromised: body.immunocompromised ?? false,
    consecutiveNegativeCoTestCount: body.consecutiveNegativeCoTestCount ?? 0,
    consecutiveLowGradeCount: body.consecutiveLowGradeCount ?? 0,
    unsatisfactoryCytologyCount: body.unsatisfactoryCytologyCount ?? 0,
  };

  const decision = evaluateClinicalDecision(input);

  return NextResponse.json({ decision, input });
}
