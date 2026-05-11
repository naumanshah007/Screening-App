import type { ClinicalInput } from "../types";

export function baseInput(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return {
    patientId: "test-patient",
    patientAge: 35,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    atypicalEndometrialHistory: false,
    immunocompromised: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    ...overrides,
  };
}
