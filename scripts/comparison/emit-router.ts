/**
 * Router-level (age-gate) three-way probe.
 *
 * The 179-case corpus exercises the FIGURE EVALUATORS directly. The R1 age-gate
 * safety fix (ea4e7e3) lives in the ROUTER — evaluateClinicalDecision — which the
 * corpus never reaches. This emitter closes that blind spot by driving the router
 * with the R1 boundary states.
 *
 * The probe inputs are derived from the guideline age-eligibility boundaries, not
 * copied from either engine's expectations.
 *
 * Run: npx tsx scripts/comparison/emit-router.ts <systemLabel> <outFile>
 */

import { writeFileSync } from "node:fs";

import { evaluateClinicalDecision } from "../../lib/engine/decision-engine";
import type { ClinicalInput } from "../../lib/engine/types";

const systemLabel = process.argv[2] ?? "UNKNOWN";
const outFile = process.argv[3] ?? "router-emission.json";

const base = (over: Partial<ClinicalInput>): ClinicalInput =>
  ({ patientAge: 30, currentFigure: "FIGURE_3", ...over } as ClinicalInput);

const PROBES: { id: string; clinicalConcern: string; input: ClinicalInput }[] = [
  { id: "AGE-U25-HSIL-HPVOTHER", clinicalConcern: "under 25 with HSIL must not be reassured", input: base({ patientAge: 23, cytologyResult: "HSIL", hpvResult: "HPV_OTHER" } as Partial<ClinicalInput>) },
  { id: "AGE-U25-AG3", clinicalConcern: "under 25 glandular AG3 must reach specialist review", input: base({ patientAge: 23, cytologyResult: "AG3" } as Partial<ClinicalInput>) },
  { id: "AGE-U25-CANCER-SYMPTOMS", clinicalConcern: "under 25 with cancer symptoms must not be reassured", input: base({ patientAge: 22, hasCancerSymptoms: true } as Partial<ClinicalInput>) },
  { id: "AGE-U25-ASYMPTOMATIC", clinicalConcern: "under 25 asymptomatic — reassurance is correct here", input: base({ patientAge: 24 }) },
  { id: "AGE-25-HPV-NEG", clinicalConcern: "age 25 HPV negative routine recall", input: base({ patientAge: 25, hpvResult: "NOT_DETECTED" } as Partial<ClinicalInput>) },
  { id: "AGE-70-HPV-NEG", clinicalConcern: "age 70 HPV negative exit", input: base({ patientAge: 70, hpvResult: "NOT_DETECTED" } as Partial<ClinicalInput>) },
  { id: "AGE-72-HPV-1618", clinicalConcern: "age 72 HPV 16/18 must reach colposcopy, not a final-screen offer", input: base({ patientAge: 72, hpvResult: "HPV_16_18" } as Partial<ClinicalInput>) },
  { id: "AGE-72-HPV-OTHER", clinicalConcern: "age 72 HPV other must reach colposcopy", input: base({ patientAge: 72, hpvResult: "HPV_OTHER" } as Partial<ClinicalInput>) },
  { id: "AGE-72-NO-HPV", clinicalConcern: "age 72 with no HPV result must request information", input: base({ patientAge: 72 }) },
  { id: "AGE-75-ASYMPTOMATIC", clinicalConcern: "age 75 asymptomatic discharge", input: base({ patientAge: 75 }) },
  { id: "AGE-76-AG1", clinicalConcern: "age 76 glandular AG1 must not be discharged", input: base({ patientAge: 76, cytologyResult: "AG1" } as Partial<ClinicalInput>) },
  { id: "AGE-76-HPV-1618", clinicalConcern: "age 76 HPV 16/18 must not be discharged", input: base({ patientAge: 76, hpvResult: "HPV_16_18" } as Partial<ClinicalInput>) },
];

const emissions = PROBES.map((p) => {
  try {
    const d = evaluateClinicalDecision(p.input);
    return {
      id: p.id,
      clinicalConcern: p.clinicalConcern,
      error: null as string | null,
      recommendationCode: d.recommendationCode,
      riskLevel: String(d.riskLevel),
      figure: String(d.figure),
      referralRequired: Boolean(d.referralRequired),
      referralType: d.referralType ? String(d.referralType) : null,
      safetyOutcome: d.safetyOutcome ? String(d.safetyOutcome) : null,
      recommendation: d.recommendation,
    };
  } catch (error) {
    return {
      id: p.id,
      clinicalConcern: p.clinicalConcern,
      error: error instanceof Error ? error.message : String(error),
      recommendationCode: null, riskLevel: null, figure: null,
      referralRequired: false, referralType: null, safetyOutcome: null, recommendation: null,
    };
  }
});

writeFileSync(outFile, JSON.stringify({ system: systemLabel, generatedAt: new Date().toISOString(), emissions }, null, 2));
console.log(`[${systemLabel}] router probes=${emissions.length} -> ${outFile}`);
