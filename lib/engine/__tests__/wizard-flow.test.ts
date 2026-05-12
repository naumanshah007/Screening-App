import test from "node:test";
import assert from "node:assert/strict";
import { getInvalidatedAnswerStepIds, getVisibleAnswerMap } from "@/lib/wizard/steps";

test("wizard keeps later answers when the same answer is submitted again", () => {
  const answers = {
    consent_confirmed: "true",
    is_post_hysterectomy: "false",
    immunocompromised: "false",
    is_first_hpv_transition: "false",
    has_abnormal_vaginal_bleeding: "false",
    sample_type: "LBC",
    hpv_result: "HPV_OTHER",
    cytology_result: "NEGATIVE",
  };

  assert.deepEqual(
    getInvalidatedAnswerStepIds(answers, "hpv_result", "HPV_OTHER"),
    []
  );
});

test("wizard invalidates later answers when an earlier answer changes even if they remain visible", () => {
  const answers = {
    consent_confirmed: "true",
    is_post_hysterectomy: "false",
    immunocompromised: "false",
    is_first_hpv_transition: "false",
    has_abnormal_vaginal_bleeding: "false",
    sample_type: "LBC",
    hpv_result: "HPV_OTHER",
    cytology_result: "NEGATIVE",
  };

  assert.deepEqual(
    getInvalidatedAnswerStepIds(answers, "hpv_result", "HPV_16_18"),
    ["cytology_result"]
  );
});

test("wizard invalidates answers from branches that become hidden", () => {
  const answers = {
    consent_confirmed: "true",
    is_post_hysterectomy: "false",
    immunocompromised: "false",
    is_first_hpv_transition: "false",
    has_abnormal_vaginal_bleeding: "true",
    abnormal_bleeding_stage: "INITIAL_ASSESSMENT",
    has_cancer_symptoms: "false",
    figure10_initial_workup_completed: "true",
    figure10_cotest_result_available: "false",
    abnormal_cervix: "false",
    suspect_ocp_problem: "true",
  };

  assert.deepEqual(
    getInvalidatedAnswerStepIds(answers, "has_abnormal_vaginal_bleeding", "false"),
    [
      "abnormal_bleeding_stage",
      "has_cancer_symptoms",
      "figure10_initial_workup_completed",
      "figure10_cotest_result_available",
      "abnormal_cervix",
      "suspect_ocp_problem",
    ]
  );
});

test("wizard finalization ignores hidden stale branch answers", () => {
  const answers = {
    consent_confirmed: "true",
    is_post_hysterectomy: "false",
    immunocompromised: "false",
    is_first_hpv_transition: "false",
    has_abnormal_vaginal_bleeding: "false",
    abnormal_bleeding_stage: "INITIAL_ASSESSMENT",
    has_cancer_symptoms: "true",
    sample_type: "LBC",
    hpv_result: "NOT_DETECTED",
  };

  assert.deepEqual(getVisibleAnswerMap(answers), {
    consent_confirmed: "true",
    is_post_hysterectomy: "false",
    immunocompromised: "false",
    is_first_hpv_transition: "false",
    has_abnormal_vaginal_bleeding: "false",
    sample_type: "LBC",
    hpv_result: "NOT_DETECTED",
  });
});
