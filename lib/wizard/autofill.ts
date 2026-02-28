/**
 * Pathway Wizard — Auto-fill Engine
 *
 * When a patient already has clinical data in the system, this module
 * maps existing database records to wizard answers so the nurse doesn't
 * need to re-enter known data.
 *
 * confidence levels:
 *   'complete' — all required inputs detected → can skip wizard and show result
 *   'partial'  — some inputs detected → wizard pre-fills known answers
 *   'none'     — no existing data → start fresh
 */

import { prisma } from "@/lib/prisma";
import { WIZARD_STEPS } from "@/lib/wizard/steps";

export type AutofillAnswerInput = {
  stepId: string;
  questionText: string;
  answerValue: string;
  answerLabel: string;
  isAutoFilled: boolean;
  stepNumber: number;
};

export type AutofillResult = {
  answers: AutofillAnswerInput[];
  confidence: "complete" | "partial" | "none";
  detectedFigure?: string;
  summary: string[];   // human-readable list of what was detected
};

/**
 * Derive a human-readable label from a raw DB enum value.
 */
function labelForValue(stepId: string, value: string): string {
  const step = WIZARD_STEPS.find((s) => s.id === stepId);
  if (!step?.options) {
    // boolean steps
    return value === "true" ? "Yes" : "No";
  }
  return step.options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Build an AutofillAnswerInput from a known step/value pair.
 */
function makeAnswer(
  stepId: string,
  value: string,
  stepIndex: number
): AutofillAnswerInput {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)!;
  return {
    stepId,
    questionText: step?.question ?? stepId,
    answerValue: value,
    answerLabel: labelForValue(stepId, value),
    isAutoFilled: true,
    stepNumber: stepIndex,
  };
}

/**
 * Given the collected answers map, determine which figure the patient is on.
 */
function detectFigure(ans: Record<string, string>): string | undefined {
  if (ans.is_post_hysterectomy === "true") {
    // Figure 8 (initial) or 10 (follow-up)
    return "FIGURE_8";
  }
  if (ans.is_first_hpv_transition === "true") {
    return ans.atypical_endometrial_history === "true" ? "FIGURE_2" : "FIGURE_1";
  }
  if (ans.is_test_of_cure === "true") return "FIGURE_6";
  if (ans.has_colposcopy_findings === "true") {
    const hi = ans.histology_result;
    if (hi === "CIN2" || hi === "CIN3" || hi === "AIS" || hi === "SCC" || hi === "ADENOCARCINOMA") {
      return "FIGURE_5";
    }
    return "FIGURE_4";
  }
  return "FIGURE_3";
}

/**
 * Main auto-fill function.
 * Loads patient record, medical history, latest test results, and colposcopy findings.
 */
export async function autofillFromPatient(
  patientId: string
): Promise<AutofillResult> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      medicalHistory: true,
      screeningSessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          testResults: {
            orderBy: { testDate: "desc" },
            take: 1,
          },
          colposcopyFindings: {
            orderBy: { colposcopyDate: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!patient) {
    return { answers: [], confidence: "none", summary: ["Patient not found"] };
  }

  const rawAnswers: Record<string, string> = {};
  const summary: string[] = [];

  // ── Map patient flags ─────────────────────────────────────────────────────
  if (patient.isPostHysterectomy) {
    rawAnswers.is_post_hysterectomy = "true";
    summary.push("Post-hysterectomy flag detected (vault screening pathway)");
  } else {
    rawAnswers.is_post_hysterectomy = "false";
  }

  if (!patient.isPostHysterectomy) {
    if (patient.isFirstTimeHPVTransition) {
      rawAnswers.is_first_hpv_transition = "true";
      summary.push("First-time HPV transition flag detected (Module A pathway)");
    } else {
      rawAnswers.is_first_hpv_transition = "false";
    }
  }

  // ── Map medical history ───────────────────────────────────────────────────
  if (patient.medicalHistory) {
    if (patient.medicalHistory.atypicalEndometrialHistory) {
      rawAnswers.atypical_endometrial_history = "true";
      summary.push("Atypical endometrial history (AG2) on record");
    } else if (rawAnswers.is_first_hpv_transition === "true") {
      rawAnswers.atypical_endometrial_history = "false";
    }
  }

  // ── Map latest test result ────────────────────────────────────────────────
  const latestSession = patient.screeningSessions[0];
  const latestTest = latestSession?.testResults?.[0];

  if (latestTest) {
    if (latestTest.sampleType) {
      rawAnswers.sample_type = latestTest.sampleType;
      summary.push(`Sample type on record: ${latestTest.sampleType}`);
    }
    if (latestTest.hpvResult) {
      rawAnswers.hpv_result = latestTest.hpvResult;
      summary.push(`HPV result on record: ${latestTest.hpvResult}`);
    }
    if (latestTest.cytologyResult) {
      rawAnswers.cytology_result = latestTest.cytologyResult;
      summary.push(`Cytology result on record: ${latestTest.cytologyResult}`);
    }
    if (latestTest.histologyResult) {
      rawAnswers.histology_result = latestTest.histologyResult;
      summary.push(`Histology result on record: ${latestTest.histologyResult}`);
    }
    if (latestTest.tzType) {
      rawAnswers.tz_type = latestTest.tzType;
      summary.push(`TZ type on record: ${latestTest.tzType}`);
    }
  }

  // ── Map colposcopy findings ───────────────────────────────────────────────
  const latestColpo = latestSession?.colposcopyFindings?.[0];
  if (latestColpo) {
    rawAnswers.has_colposcopy_findings = "true";
    summary.push("Colposcopy findings on record");

    if (latestColpo.tzType) {
      rawAnswers.tz_type = latestColpo.tzType;
    }
    if (latestColpo.colposcopicImpression) {
      rawAnswers.colposcopic_impression = latestColpo.colposcopicImpression;
      summary.push(`Colposcopic impression on record: ${latestColpo.colposcopicImpression}`);
    }
    if (latestColpo.biopsyTaken) {
      rawAnswers.biopsy_taken = "true";
    }
    if (latestColpo.biopsyResult) {
      rawAnswers.histology_result = latestColpo.biopsyResult;
      summary.push(`Biopsy histology on record: ${latestColpo.biopsyResult}`);
    }
    if (latestColpo.mdmOutcome) {
      rawAnswers.mdm_outcome = latestColpo.mdmOutcome;
    }
  }

  // ── Check test of cure ────────────────────────────────────────────────────
  if (latestSession) {
    const hadTreatment = patient.medicalHistory?.previousHighGradeLesion ?? false;
    if (hadTreatment) {
      rawAnswers.is_test_of_cure = "true";
      summary.push("Previous high-grade lesion treatment on record — Test of Cure pathway");
    } else if (!rawAnswers.is_test_of_cure) {
      rawAnswers.is_test_of_cure = "false";
    }
  }

  // ── Determine figure ──────────────────────────────────────────────────────
  const detectedFigure = detectFigure(rawAnswers);

  // ── Build ordered answer objects ──────────────────────────────────────────
  const answers: AutofillAnswerInput[] = [];
  let stepIdx = 0;
  for (const step of WIZARD_STEPS) {
    if (step.type === "info") continue;
    const value = rawAnswers[step.id];
    if (value !== undefined) {
      answers.push(makeAnswer(step.id, value, stepIdx++));
    }
  }

  // ── Determine confidence ──────────────────────────────────────────────────
  // Get visible steps given the answers and check which ones are unanswered
  const visibleActionSteps = WIZARD_STEPS.filter(
    (s) => s.type !== "info" && s.isVisible(rawAnswers)
  );
  const unanswered = visibleActionSteps.filter((s) => !(s.id in rawAnswers));

  let confidence: "complete" | "partial" | "none";
  if (answers.length === 0) {
    confidence = "none";
  } else if (unanswered.length === 0) {
    confidence = "complete";
  } else {
    confidence = "partial";
  }

  if (summary.length === 0) {
    summary.push("No existing clinical data found for this patient");
  }

  return {
    answers,
    confidence,
    detectedFigure,
    summary,
  };
}
