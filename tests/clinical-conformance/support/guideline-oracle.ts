export type SourceArea =
  | "Figure 1"
  | "Figure 2"
  | "Figure 3"
  | "Figure 4"
  | "Figure 5"
  | "Figure 6"
  | "Figure 7"
  | "Figure 8"
  | "Table 1"
  | "Figure 9"
  | "Figure 10";

export interface GuidelineRule {
  ruleId: string;
  sourceDocument: string;
  sourceVersion: string;
  figureOrTable: SourceArea;
  page: number;
  pdfPage: number;
  recommendationNumbers: string[];
  effectiveRuleVersion: string;
  entryCriteria: string[];
  exclusionCriteria: string[];
  requiredInputs: string[];
  conditionalInputs: string[];
  branchConditions: string[];
  expectedAction: string;
  actionClass: string;
  referralRequired: boolean;
  referralDestination: string | null;
  guidelineTimeframe: string | null;
  localBookingPriority: null;
  repeatInterval: string | null;
  mandatoryClinicianReview: boolean;
  clinicianOnly: boolean;
  missingDataBehaviour: string;
  rationale: string;
  supersededRule: string | null;
  sourceAmbiguity: string | null;
}

type RuleSeed = Omit<
  GuidelineRule,
  | "sourceDocument"
  | "sourceVersion"
  | "pdfPage"
  | "effectiveRuleVersion"
  | "exclusionCriteria"
  | "conditionalInputs"
  | "localBookingPriority"
  | "missingDataBehaviour"
  | "supersededRule"
  | "sourceAmbiguity"
> &
  Partial<
    Pick<
      GuidelineRule,
      | "sourceDocument"
      | "sourceVersion"
      | "pdfPage"
      | "effectiveRuleVersion"
      | "exclusionCriteria"
      | "conditionalInputs"
      | "missingDataBehaviour"
      | "supersededRule"
      | "sourceAmbiguity"
    >
  >;

const PRIMARY = "Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand";
const PRIMARY_VERSION = "June 2023 final v1.1";
const ADDENDUM = "Addendum to Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand";
const IMMUNE = "Cervical screening for immune deficient participants";

const sourcePages: Record<SourceArea, { page: number; pdfPage: number; recs: string[] }> = {
  "Figure 1": { page: 18, pdfPage: 20, recs: ["R2.01", "R2.02", "R2.03", "R2.06", "R2.07"] },
  "Figure 2": { page: 19, pdfPage: 21, recs: ["R2.03", "R2.04", "R2.05", "R2.06", "R2.07", "R2.08"] },
  "Figure 3": { page: 24, pdfPage: 26, recs: ["R3.04", "R3.05", "R3.06", "R4.01-R4.15"] },
  "Figure 4": { page: 45, pdfPage: 47, recs: ["R6.03-R6.07"] },
  "Figure 5": { page: 47, pdfPage: 49, recs: ["R6.08-R6.16"] },
  "Figure 6": { page: 56, pdfPage: 58, recs: ["R8.02-R8.08"] },
  "Figure 7": { page: 59, pdfPage: 61, recs: ["R9.04-R9.17"] },
  "Figure 8": { page: 67, pdfPage: 69, recs: ["R10.01-R10.10"] },
  "Table 1": { page: 66, pdfPage: 68, recs: ["R10.01-R10.10"] },
  "Figure 9": { page: 71, pdfPage: 73, recs: ["R11.01-R11.11"] },
  "Figure 10": { page: 83, pdfPage: 85, recs: ["R15.01-R15.06"] },
};

function makeRule(seed: RuleSeed): GuidelineRule {
  const source = sourcePages[seed.figureOrTable];
  return {
    sourceDocument: PRIMARY,
    sourceVersion: PRIMARY_VERSION,
    pdfPage: source.pdfPage,
    effectiveRuleVersion: "2023-v1.1",
    exclusionCriteria: [],
    conditionalInputs: [],
    localBookingPriority: null,
    missingDataBehaviour: "Do not select this terminal action; request the missing source fact and require reviewer confirmation.",
    supersededRule: null,
    sourceAmbiguity: null,
    ...seed,
    recommendationNumbers: seed.recommendationNumbers.length ? seed.recommendationNumbers : source.recs,
  };
}

const rules: GuidelineRule[] = [];
const add = (seed: RuleSeed) => rules.push(makeRule(seed));

// Figure 1: source distinguishes the three invite-now histories and three next-scheduled histories.
for (const [id, condition, rationale] of [
  ["NEVER-SCREENED", "participant has never been screened", "Never-screened participants are invited now."],
  ["UNDER-SCREENED", "participant is under-screened", "Under-screened participants are invited now."],
  ["OVERDUE", "participant is overdue", "Overdue participants are invited now."],
] as const) {
  add({ ruleId: `F1-${id}-INVITE-NOW`, figureOrTable: "Figure 1", page: 18, recommendationNumbers: [], entryCriteria: ["first transition from cytology to HPV primary screening"], requiredInputs: ["transition status", "screening status", "validated abnormality history"], branchConditions: [condition], expectedAction: "Invite now, then perform the HPV screening test and continue through Figure 3.", actionClass: "INVITE_NOW", referralRequired: false, referralDestination: null, guidelineTimeframe: "now", repeatInterval: null, mandatoryClinicianReview: false, clinicianOnly: false, rationale });
}
for (const [id, condition, rationale] of [
  ["REGULAR-NORMAL", "regularly screened with normal results", "A regularly screened participant with normal results is invited at the next scheduled visit."],
  ["LOW-GRADE-RESOLVED", "previous low-grade results and returned to regular screening", "Resolved low-grade history stays on its scheduled transition visit."],
  ["HIGH-GRADE-TOC-COMPLETE", "previous high-grade results with successful Test of Cure", "Only successfully completed Test of Cure permits this low-risk transition branch."],
] as const) {
  add({ ruleId: `F1-${id}-NEXT-SCHEDULED`, figureOrTable: "Figure 1", page: 18, recommendationNumbers: [], entryCriteria: ["first transition from cytology to HPV primary screening"], exclusionCriteria: ["unresolved high-grade/glandular history", "active colposcopy", "symptoms", "pregnancy high-grade pathway", "total hysterectomy"], requiredInputs: ["transition status", "screening history", "resolution/Test of Cure status where relevant"], branchConditions: [condition], expectedAction: "Invite at the next scheduled visit, then perform the HPV screening test and continue through Figure 3.", actionClass: "INVITE_NEXT_SCHEDULED", referralRequired: false, referralDestination: null, guidelineTimeframe: "next scheduled visit", repeatInterval: null, mandatoryClinicianReview: false, clinicianOnly: false, rationale });
}

// Figure 2: distinct source exits from unresolved high-grade/glandular transition history.
[
  ["F2-HIGH-GRADE-OUTSTANDING-COLPOSCOPY", ["previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells", "last cytology recommended colposcopy and it has not occurred"], "Refer to colposcopy.", "COLPOSCOPY", true, "colposcopy", "as recommended in last cytology"],
  ["F2-HIGH-GRADE-INCOMPLETE-TOC", ["previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells", "no outstanding recommended colposcopy", "Test of Cure is incomplete"], "Complete Test of Cure before regular screening.", "TEST_OF_CURE", false, null, "per Test of Cure pathway"],
  ["F2-HIGH-GRADE-TOC-COMPLETE-F3", ["previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells", "Test of Cure successfully completed"], "Return to regular interval screening through Figure 3.", "ROUTE_FIGURE_3", false, null, "next scheduled screening"],
  ["F2-AIS-NO-TOTAL-HYSTERECTOMY-R208", ["previous AIS", "no total hysterectomy"], "Use the controlling post-treatment AIS follow-up rule.", "AIS_FOLLOW_UP", true, "colposcopy or primary/community care according to current R9.14", "6 and 18 months when HPV-detected AIS has clear margins"],
  ["F2-ATYPICAL-ENDOMETRIAL-OLDER-3Y-F3", ["previous atypical endometrial cells", "report more than three years previously"], "Primary HPV screening at the next scheduled visit; then Figure 3.", "ROUTE_FIGURE_3", false, null, "next scheduled visit"],
  ["F2-ATYPICAL-ENDOMETRIAL-DISCHARGED-F3", ["previous atypical endometrial cells", "investigated by specialist services and discharged to primary care"], "Primary HPV screening at the next scheduled visit; then Figure 3.", "ROUTE_FIGURE_3", false, null, "next scheduled visit"],
  ["F2-ATYPICAL-ENDOMETRIAL-OTHERWISE-GYNAECOLOGY", ["previous atypical endometrial cells", "not more than three years previously", "not discharged by specialist services"], "Refer to specialist gynaecology; Test of Cure is not appropriate.", "GYNAECOLOGY", true, "specialist gynaecology", "as soon as practicable"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, referralRequired, referralDestination, timeframe]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 2", page: 19, recommendationNumbers: [], entryCriteria: ["first transition from cytology to HPV primary screening", "not returned to regular screening"], exclusionCriteria: ["already established in HPV primary pathway", "symptomatic pathway takes precedence"], requiredInputs: ["prior abnormality category", "outstanding colposcopy status", "Test of Cure status", "relevant dates/specialist discharge"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: referralRequired as boolean, referralDestination: referralDestination as string | null, guidelineTimeframe: timeframe as string, repeatInterval: actionClass === "TEST_OF_CURE" ? "per Test of Cure sequence" : null, mandatoryClinicianReview: ["AIS_FOLLOW_UP", "GYNAECOLOGY"].includes(actionClass as string), clinicianOnly: actionClass === "GYNAECOLOGY", rationale: "Figure 2 prevents unresolved high-grade or glandular history from being silently returned to routine screening.", sourceAmbiguity: ruleId === "F2-AIS-NO-TOTAL-HYSTERECTOMY-R208" ? "The figure points to R2.08; the 2026 R9.14 addendum controls the clear-margin HPV-detected AIS care setting." : null }));

const lowCytology = [
  ["NEGATIVE", "negative cytology"],
  ["ASC-US", "ASC-US cytology"],
  ["LSIL", "LSIL cytology"],
] as const;
const highCytology = [
  ["ASC-H", "ASC-H cytology"],
  ["HSIL", "HSIL cytology"],
  ["SCC", "squamous cell carcinoma cytology"],
  ["ATYPICAL-GLANDULAR", "atypical glandular cells"],
  ["AIS", "adenocarcinoma in situ cytology"],
  ["ADENOCARCINOMA", "adenocarcinoma cytology"],
] as const;

// Figure 3: the condition vector is intentionally not collapsed across sample, repeat, age, cytology, or immune status.
for (const sample of ["SWAB", "LBC"] as const) {
  for (const immune of [false, true]) {
    add({ ruleId: `F3-BASELINE-${sample}-HPV-NOT-DETECTED-${immune ? "IMMUNE-3Y" : "5Y"}`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.01"], entryCriteria: ["asymptomatic primary HPV screening", `${sample} sample`], requiredInputs: ["HPV result", "sample type", "immune-deficiency classification"], branchConditions: ["baseline HPV not detected", immune ? "immune deficient under v1.0.1 guidance" : "not immune deficient under v1.0.1 guidance"], expectedAction: immune ? "Return for HPV screening in three years." : "Return for HPV screening in five years.", actionClass: "ROUTINE_RECALL", referralRequired: false, referralDestination: null, guidelineTimeframe: immune ? "3 years" : "5 years", repeatInterval: immune ? "36 months" : "60 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "Figure 3 sends HPV-not-detected participants to regular interval screening; current immune guidance determines the three-year exception.", sourceDocument: immune ? `${PRIMARY}; ${IMMUNE}` : PRIMARY, sourceVersion: immune ? `${PRIMARY_VERSION}; v1.0.1 (12/03/2026)` : PRIMARY_VERSION, effectiveRuleVersion: immune ? "2026-immune-v1.0.1" : "2023-v1.1" });
  }
}
for (const immune of [false, true]) {
  for (const stage of ["FIRST-REPEAT", "SECOND-REPEAT"] as const) {
    add({ ruleId: `F3-${stage}-HPV-NOT-DETECTED-${immune ? "IMMUNE-3Y" : "5Y"}`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.01-R4.03"], entryCriteria: ["asymptomatic primary HPV screening follow-up", `${stage.toLowerCase().replaceAll("-", " ")}`], requiredInputs: ["HPV result", "repeat stage", "immune-deficiency classification"], branchConditions: ["HPV not detected", immune ? "immune deficient" : "immune competent"], expectedAction: immune ? "Return for HPV screening in three years." : "Return for HPV screening in five years.", actionClass: "ROUTINE_RECALL", referralRequired: false, referralDestination: null, guidelineTimeframe: immune ? "3 years" : "5 years", repeatInterval: immune ? "36 months" : "60 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "A repeat HPV-not-detected result exits to the current regular screening interval.", sourceDocument: immune ? `${PRIMARY}; ${IMMUNE}` : PRIMARY, sourceVersion: immune ? `${PRIMARY_VERSION}; v1.0.1 (12/03/2026)` : PRIMARY_VERSION, effectiveRuleVersion: immune ? "2026-immune-v1.0.1" : "2023-v1.1" });
  }
}
for (const sample of ["SWAB", "LBC"] as const) {
  add({ ruleId: `F3-HPV16-18-${sample}-COLPOSCOPY`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.07-R4.12"], entryCriteria: ["asymptomatic primary HPV screening", `${sample} sample`], requiredInputs: ["HPV genotype", "sample type"], conditionalInputs: ["cytology if an LBC sample exists"], branchConditions: ["HPV 16 or 18 detected"], expectedAction: sample === "SWAB" ? "Refer directly to colposcopy; take LBC cytology at colposcopy." : "Report reflex cytology and refer to colposcopy regardless of cytology result.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: false, rationale: "HPV 16/18 bypasses low-grade repeat testing and proceeds to colposcopy." });
}
add({ ruleId: "F3-HPV-OTHER-SWAB-RETURN-FOR-LBC", figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.02-R4.04"], entryCriteria: ["asymptomatic primary HPV screening", "swab sample"], requiredInputs: ["HPV genotype", "sample type"], branchConditions: ["HPV Other detected", "cytology unavailable from swab"], expectedAction: "Return for clinical examination and an LBC cytology sample before the cytology-dependent branch is selected.", actionClass: "RETURN_FOR_LBC", referralRequired: false, referralDestination: null, guidelineTimeframe: "without avoidable delay", repeatInterval: null, mandatoryClinicianReview: false, clinicianOnly: false, rationale: "Cytology cannot be performed on the screening swab." });
for (const [code, label] of lowCytology) {
  add({ ruleId: `F3-BASELINE-HPV-OTHER-${code}-REPEAT-12M`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.04-R4.06"], entryCriteria: ["asymptomatic primary HPV screening", "cytology available"], requiredInputs: ["HPV genotype", "cytology result", "repeat stage"], branchConditions: ["baseline HPV Other", label], expectedAction: "Repeat HPV testing in 12 months; LBC is recommended.", actionClass: "REPEAT_HPV", referralRequired: false, referralDestination: null, guidelineTimeframe: "12 months", repeatInterval: "12 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "Baseline HPV Other with negative/low-grade cytology receives one-year surveillance." });
}
for (const [code, label] of highCytology) {
  add({ ruleId: `F3-BASELINE-HPV-OTHER-${code}-COLPOSCOPY`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.05", "R4.08-R4.12"], entryCriteria: ["asymptomatic primary HPV screening", "cytology available"], requiredInputs: ["HPV genotype", "cytology result"], branchConditions: ["HPV Other", label], expectedAction: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "Refer according to the glandular/specialist pathway; colposcopy applies except the endometrial exception." : "Refer to colposcopy.", actionClass: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "GLANDULAR_SPECIALIST_ROUTE" : "COLPOSCOPY", referralRequired: true, referralDestination: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "colposcopy or specialist gynaecology according to subtype" : "colposcopy", guidelineTimeframe: code === "SCC" || code === "ADENOCARCINOMA" ? "urgent assessment where invasive disease is suspected" : null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA", rationale: "Possible/definite high-grade cytology does not remain in the low-grade repeat branch." });
}
for (const [code, label] of lowCytology) {
  for (const over50 of [false, true]) {
    add({ ruleId: `F3-FIRST-REPEAT-HPV-OTHER-${code}-${over50 ? "AGE50PLUS-COLPOSCOPY" : "UNDER50-SECOND-REPEAT"}`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.04-R4.06"], entryCriteria: ["first 12-month repeat after HPV Other with negative/low-grade cytology"], requiredInputs: ["HPV genotype", "cytology result", "repeat stage", "age/date of birth"], branchConditions: ["HPV Other persists", label, over50 ? "age 50 years or older" : "age below 50 years"], expectedAction: over50 ? "Refer to colposcopy." : "Schedule the second repeat HPV test in 12 months; LBC is recommended.", actionClass: over50 ? "COLPOSCOPY" : "SECOND_REPEAT_HPV", referralRequired: over50, referralDestination: over50 ? "colposcopy" : null, guidelineTimeframe: over50 ? null : "12 months", repeatInterval: over50 ? null : "12 months", mandatoryClinicianReview: over50, clinicianOnly: false, rationale: "Figure 3 uses an inclusive age ≥50 threshold at the first repeat." });
  }
}
for (const [code, label] of highCytology) {
  add({ ruleId: `F3-FIRST-REPEAT-HPV-OTHER-${code}-COLPOSCOPY`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.05", "R4.08-R4.12"], entryCriteria: ["first 12-month repeat"], requiredInputs: ["HPV genotype", "cytology result", "repeat stage"], branchConditions: ["HPV Other persists", label], expectedAction: "Refer to colposcopy or the controlling glandular specialist pathway.", actionClass: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "GLANDULAR_SPECIALIST_ROUTE" : "COLPOSCOPY", referralRequired: true, referralDestination: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "colposcopy or specialist gynaecology according to subtype" : "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA", rationale: "High-grade cytology overrides another low-grade repeat." });
}
for (const genotype of ["HPV16-18", "HPV-OTHER"] as const) {
  add({ ruleId: `F3-SECOND-REPEAT-${genotype}-COLPOSCOPY`, figureOrTable: "Figure 3", page: 24, recommendationNumbers: ["R4.04-R4.12"], entryCriteria: ["second 12-month repeat"], requiredInputs: ["HPV genotype", "repeat stage", "cytology result if available"], branchConditions: [`${genotype} detected at second repeat`], expectedAction: "Report cytology and refer to colposcopy; use the glandular specialist exception where applicable.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: false, rationale: "Any HPV detection at the second repeat proceeds to colposcopy." });
}
[
  ["F3-INVALID-HPV-REPEAT-ASAP", ["HPV result invalid"], "Repeat the HPV test as soon as practicable without a mandatory delay.", "REPEAT_ASAP"],
  ["F3-UNSUITABLE-HPV-REPEAT-ASAP", ["sample unsuitable for analysis, including leakage"], "Repeat the HPV test as soon as practicable without a mandatory delay.", "REPEAT_ASAP"],
  ["F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT", ["HPV Other", "first unsatisfactory cytology"], "Repeat LBC cytology within three months.", "REPEAT_CYTOLOGY"],
  ["F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY", ["HPV Other", "two consecutive unsatisfactory cytology results"], "Refer to colposcopy.", "COLPOSCOPY"],
  ["F3-CYTOLOGY-PENDING-INCOMPLETE", ["HPV Other", "cytology pending"], "Keep the result incomplete; do not issue a terminal recommendation.", "INCOMPLETE_RESULT"],
  ["F3-MISSING-GENOTYPE-SAFETY-STOP", ["HPV detected but genotype missing"], "Request the genotype/result category before routing.", "SAFETY_STOP"],
  ["F3-MISSING-SAMPLE-TYPE-SAFETY-STOP", ["sample type missing"], "Request sample type before deciding whether cytology is available or a return visit is required.", "SAFETY_STOP"],
  ["F3-FIRST-REPEAT-MISSING-AGE-SAFETY-STOP", ["persistent HPV Other with negative/low-grade cytology", "age missing"], "Request age/date of birth before applying the ≥50 branch.", "SAFETY_STOP"],
  ["F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP", ["HPV not detected", "immune-deficiency status unknown"], "Resolve immune-deficiency classification before selecting three- versus five-year recall.", "SAFETY_STOP"],
] .forEach(([ruleId, conditions, expectedAction, actionClass]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 3", page: 24, recommendationNumbers: (ruleId as string).includes("INVALID") || (ruleId as string).includes("UNSUITABLE") || (ruleId as string).includes("UNSAT") ? ["R3.04-R3.06"] : ["R4.01-R4.15"], entryCriteria: ["Figure 3 result handling"], requiredInputs: ["complete validated laboratory result", "sample type", "repeat stage", "age and immune status where outcome depends on them"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: actionClass === "COLPOSCOPY", referralDestination: actionClass === "COLPOSCOPY" ? "colposcopy" : null, guidelineTimeframe: actionClass === "REPEAT_CYTOLOGY" ? "within 3 months" : actionClass === "REPEAT_ASAP" ? "as soon as practicable" : null, repeatInterval: actionClass === "REPEAT_CYTOLOGY" ? "within 3 months" : null, mandatoryClinicianReview: actionClass === "SAFETY_STOP" || actionClass === "INCOMPLETE_RESULT", clinicianOnly: false, missingDataBehaviour: "Remain incomplete or stop; never default to a routine recall.", rationale: "Invalid, unsuitable, pending, and missing critical states cannot safely become routine screening." }));

// Figure 4: normal-colposcopy low-grade follow-up and the current R6.05 addendum.
add({ ruleId: "F4-NORMAL-COLPOSCOPY-INITIAL-REPEAT-12M", figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["HPV detected any type", "negative/ASC-US/LSIL cytology", "normal colposcopy"], requiredInputs: ["colposcopy result", "cytology category"], branchConditions: ["enter Figure 4"], expectedAction: "Repeat HPV test in community care in 12 months; use LBC.", actionClass: "REPEAT_HPV", referralRequired: false, referralDestination: null, guidelineTimeframe: "12 months", repeatInterval: "12 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "The figure begins post-colposcopy surveillance at 12 months." });
for (const immune of [false, true]) {
  add({ ruleId: `F4-REPEAT-HPV-NOT-DETECTED-${immune ? "IMMUNE-3Y" : "REGULAR-5Y"}`, figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 12-month follow-up"], requiredInputs: ["HPV result", "immune-deficiency status"], branchConditions: ["HPV not detected", immune ? "immune deficient" : "immune competent"], expectedAction: immune ? "Return to three-year screening." : "Return to five-year regular screening.", actionClass: "ROUTINE_RECALL", referralRequired: false, referralDestination: null, guidelineTimeframe: immune ? "3 years" : "5 years", repeatInterval: immune ? "36 months" : "60 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "HPV not detected returns to the current regular interval.", sourceDocument: immune ? `${PRIMARY}; ${IMMUNE}` : PRIMARY, sourceVersion: immune ? `${PRIMARY_VERSION}; v1.0.1` : PRIMARY_VERSION, effectiveRuleVersion: immune ? "2026-immune-v1.0.1" : "2023-v1.1" });
}
add({ ruleId: "F4-REPEAT-HPV16-18-COLPOSCOPY", figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 12-month follow-up"], requiredInputs: ["HPV genotype"], branchConditions: ["HPV 16 or 18 detected"], expectedAction: "Refer to colposcopy.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: false, rationale: "HPV 16/18 proceeds directly to colposcopy." });
for (const [code, label] of highCytology) {
  add({ ruleId: `F4-HPV-OTHER-${code}-COLPOSCOPY`, figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 12-month follow-up"], requiredInputs: ["HPV genotype", "cytology result"], branchConditions: ["HPV Other", label], expectedAction: "Refer to colposcopy or the controlling glandular specialist route.", actionClass: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "GLANDULAR_SPECIALIST_ROUTE" : "COLPOSCOPY", referralRequired: true, referralDestination: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA" ? "colposcopy or specialist gynaecology" : "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: code === "ATYPICAL-GLANDULAR" || code === "ADENOCARCINOMA", rationale: "Cytology ≥ASC-H exits low-grade surveillance." });
}
for (const [code, label] of lowCytology) {
  for (const immune of [false, true]) {
    add({ ruleId: `F4-HPV-OTHER-${code}-${immune ? "IMMUNE-COLPOSCOPY" : "SECOND-REPEAT-12M"}`, figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 12-month follow-up"], requiredInputs: ["HPV genotype", "cytology result", "immune-deficiency status"], branchConditions: ["HPV Other", label, immune ? "immune deficient" : "immune competent"], expectedAction: immune ? "Refer to colposcopy." : "Repeat HPV test in community care in 12 months; use LBC.", actionClass: immune ? "COLPOSCOPY" : "SECOND_REPEAT_HPV", referralRequired: immune, referralDestination: immune ? "colposcopy" : null, guidelineTimeframe: immune ? null : "12 months", repeatInterval: immune ? null : "12 months", mandatoryClinicianReview: immune, clinicianOnly: false, rationale: "Immune deficiency changes persistent low-grade follow-up from another repeat to colposcopy." });
  }
}
for (const genotype of ["HPV16-18", "HPV-OTHER"] as const) {
  add({ ruleId: `F4-SECOND-REPEAT-${genotype}-COLPOSCOPY`, figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 second repeat"], requiredInputs: ["HPV genotype", "repeat stage"], branchConditions: [`${genotype} detected`], expectedAction: "Refer to colposcopy.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: false, rationale: "Any HPV detection at the second repeat returns to colposcopy." });
}
for (const immune of [false, true]) {
  add({ ruleId: `F4-SECOND-REPEAT-NOT-DETECTED-${immune ? "IMMUNE-3Y" : "REGULAR-5Y"}`, figureOrTable: "Figure 4", page: 45, recommendationNumbers: ["R6.03-R6.07"], entryCriteria: ["Figure 4 second repeat"], requiredInputs: ["HPV result", "immune-deficiency status"], branchConditions: ["HPV not detected", immune ? "immune deficient" : "immune competent"], expectedAction: immune ? "Return to three-year screening." : "Return to regular five-year screening.", actionClass: "ROUTINE_RECALL", referralRequired: false, referralDestination: null, guidelineTimeframe: immune ? "3 years" : "5 years", repeatInterval: immune ? "36 months" : "60 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "HPV not detected exits Figure 4 surveillance." });
}
add({ ruleId: "F4-TYPE3-LOW-GRADE-NORMAL-COLPOSCOPY-NO-MDM", figureOrTable: "Figure 4", page: 45, pdfPage: 47, recommendationNumbers: ["R6.05"], entryCriteria: ["Type 3 transformation zone", "HPV positive", "low-grade cytology", "normal colposcopy"], requiredInputs: ["transformation-zone type", "HPV result", "cytology result", "colposcopy impression"], branchConditions: ["updated R6.05 applies"], expectedAction: "Continue the Figure 4 observation pathway without MDM cytological review.", actionClass: "NO_MDM_CONTINUE_F4", referralRequired: false, referralDestination: null, guidelineTimeframe: "12-month repeat per Figure 4", repeatInterval: "12 months", mandatoryClinicianReview: false, clinicianOnly: false, rationale: "The addendum expressly removes the 2023 MDM requirement for this scenario.", sourceDocument: ADDENDUM, sourceVersion: "Doc ID 18519 v1.0, 02/02/2026", effectiveRuleVersion: "2026-addendum-v1.0", supersededRule: "2023 R6.05 required MDM cytological review before observation." });

// Figure 5: all downstream exits remain clinician-led because they depend on MDM/colposcopy decisions.
[
  ["F5-MDM-PENDING-REVIEW", ["MDM outcome pending"], "Stop for MDM case review.", "MDM_REVIEW", null],
  ["F5-MDM-DOWNGRADED-LSIL-PATHWAY", ["MDM downgrades cytology to LSIL"], "Follow the LSIL pathway.", "ROUTE_LSIL", null],
  ["F5-MDM-UPGRADED-HSIL-PATHWAY", ["MDM upgrades cytology to HSIL"], "Follow the HSIL pathway; specialist treatment decision required.", "ROUTE_HSIL", null],
  ["F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED", ["ASC-H confirmed", "Type 1 or 2 transformation zone", "no visible lesion"], "Require a specialist decision between diagnostic excision and documented observation; do not record treatment as performed.", "SPECIALIST_TREATMENT_DECISION_REQUIRED", null],
  ["F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT", ["treatment deferred", "abnormal cytology, HPV detected, or visible lesion"], "Treatment is recommended; consider Type 2 transformation-zone excision.", "TREATMENT", null],
  ["F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC", ["treatment deferred after an informed specialist decision", "HPV not detected", "negative cytology", "no visible lesion", "unchanged colposcopic impression"], "Continue the Figure 5 specialist co-testing surveillance sequence; do not infer prior HSIL treatment or ordinary Figure 6 Test of Cure eligibility.", "FIGURE_5_COTEST_SURVEILLANCE", "12 months after the first reassuring six-month co-test"],
  ["F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M", ["treatment deferred", "HPV detected", "normal colposcopy", "negative cytology"], "Repeat colposcopy, HPV, and cytology in 12 months.", "REPEAT_COLPOSCOPY_COTEST", "12 months"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 5", page: 47, recommendationNumbers: [], entryCriteria: ["HPV detected", "cytology ≥ASC-H", "normal colposcopy"], requiredInputs: ["MDM outcome", "treatment decision", "HPV/cytology/visible-lesion follow-up facts"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: ["TREATMENT", "SPECIALIST_TREATMENT_DECISION_REQUIRED"].includes(actionClass as string), referralDestination: actionClass === "TREATMENT" ? "colposcopy/specialist treatment service" : actionClass === "SPECIALIST_TREATMENT_DECISION_REQUIRED" ? "colposcopy/specialist decision service" : null, guidelineTimeframe: interval as string | null, repeatInterval: interval as string | null, mandatoryClinicianReview: true, clinicianOnly: true, missingDataBehaviour: "CLINICIAN_REVIEW_REQUIRED; do not infer MDM, lesion, biopsy, treatment, or Test of Cure eligibility.", rationale: "Figure 5 is a specialist decision and observation pathway. Primary recommendations R6.08-R6.09 control the visually abbreviated figure labels and do not establish that treatment occurred." }));

// Figure 6: each distinct co-test sequence exit is retained.
[
  ["F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE", ["biopsy-confirmed CIN2", "age below 30 at diagnosis", "Type 1 or 2 transformation zone", "CIN3 and invasion excluded", "MDM histology review complete", "participant agrees"], "Begin active surveillance with colposcopy, cytology, and biopsy of visible lesions every six months.", "CIN2_ACTIVE_SURVEILLANCE", "6-monthly for no more than 24 months"],
  ["F6-CIN2-SURVEILLANCE-CIN3-TREAT", ["active surveillance", "CIN3 develops at any review"], "Stop surveillance and proceed to specialist treatment.", "TREATMENT", "at detection"],
  ["F6-CIN2-PERSISTS-24M-TREAT", ["active surveillance", "CIN2 persists at 24 months"], "Proceed to specialist treatment.", "TREATMENT", "24 months"],
  ["F6-CIN2-REGRESSION-TOC", ["active surveillance", "CIN2 regresses and no CIN3/invasion"], "Discharge from surveillance into Test of Cure.", "TEST_OF_CURE", "after documented regression"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 6", page: 4, pdfPage: 4, recommendationNumbers: ["R8.03"], entryCriteria: ["CIN2 active-surveillance pathway in the 2026 addendum"], exclusionCriteria: ["age 30 or older at diagnosis", "Type 3 transformation zone", "CIN3 or invasion", "MDM review absent", "participant does not agree"], requiredInputs: ["date of birth/age at diagnosis", "transformation-zone type", "biopsy-confirmed CIN2", "CIN3/invasion exclusion", "MDM review", "participant agreement", "surveillance start and review dates", "review cytology/biopsy"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: actionClass === "TREATMENT", referralDestination: actionClass === "TREATMENT" ? "specialist treatment service" : null, guidelineTimeframe: interval as string, repeatInterval: actionClass === "CIN2_ACTIVE_SURVEILLANCE" ? "6 months" : null, mandatoryClinicianReview: true, clinicianOnly: true, missingDataBehaviour: "CLINICIAN_REVIEW_REQUIRED; eligibility, MDM histology confirmation, consent, and surveillance findings cannot be inferred.", rationale: "Updated R8.03 supplies explicit eligibility, six-monthly surveillance, a 24-month ceiling, and treatment/regression exits.", sourceDocument: ADDENDUM, sourceVersion: "Doc ID 18519 v1.0", effectiveRuleVersion: "2026-addendum-v1.0", supersededRule: "The 2023 R8.03 statement allowed observation but did not define this complete eligibility/surveillance algorithm." }));
[
  ["F6-6M-HPV-DETECTED-COLPOSCOPY", ["six-month post-treatment co-test", "HPV detected any type"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-6M-HPV-NOT-DETECTED-HIGH-GRADE-COLPOSCOPY", ["six-month HPV not detected", "possible/definite high-grade cytology"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-6M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT-12M", ["six-month HPV not detected", "low-grade cytology"], "Repeat HPV and cytology in 12 months.", "REPEAT_COTEST", "12 months"],
  ["F6-6M-FIRST-NEGATIVE-REPEAT-12M", ["six-month HPV not detected", "negative cytology", "first negative co-test"], "Repeat HPV and cytology in 12 months.", "REPEAT_COTEST", "12 months"],
  ["F6-18M-SECOND-NEGATIVE-COMPLETE", ["two consecutive HPV-not-detected and negative-cytology co-tests 12 months apart"], "Successfully complete Test of Cure and return to regular screening.", "TOC_COMPLETE", null],
  ["F6-18M-HPV-DETECTED-COLPOSCOPY", ["repeat co-test after first negative", "HPV detected any type"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-18M-HPV-NOT-DETECTED-HIGH-GRADE-COLPOSCOPY", ["repeat HPV not detected", "possible/definite high-grade cytology"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT", ["repeat HPV not detected", "low-grade cytology after prior negative co-test"], "Repeat HPV and cytology in 12 months.", "REPEAT_COTEST", "12 months"],
  ["F6-AFTER-LOW-GRADE-HPV-DETECTED-COLPOSCOPY", ["co-test after a low-grade cytology event", "HPV detected any type"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-AFTER-LOW-GRADE-HPV-NOT-DETECTED-ABNORMAL-COLPOSCOPY", ["co-test after a low-grade cytology event", "HPV not detected", "cytology remains abnormal"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F6-AFTER-LOW-GRADE-NEGATIVE-CONTINUE-TOC", ["co-test after a low-grade cytology event", "HPV not detected", "negative cytology"], "Continue Test of Cure until the required negative sequence is complete.", "CONTINUE_TOC", "12 months between qualifying co-tests"],
  ["F6-MISSING-TREATMENT-DATE-SAFETY-STOP", ["Test of Cure requested", "treatment date missing"], "Stop and obtain the treatment date before calculating the six- or eighteen-month event.", "SAFETY_STOP", null],
  ["F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC", ["positive HSIL excision margins", "age below 50"], "Test of Cure follow-up may occur in primary/community care.", "COMMUNITY_TOC", "6 and 18 months post-treatment"],
  ["F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST", ["positive HSIL excision margins", "age 50 or older"], "Follow the specialist/colposcopy positive-margin pathway.", "SPECIALIST_FOLLOW_UP", null],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 6", page: 56, recommendationNumbers: (ruleId as string).includes("POSITIVE-MARGINS") ? ["R8.06"] : ["R8.04-R8.08"], entryCriteria: ["documented treatment for HSIL (CIN2/3)"], exclusionCriteria: ["AIS-only follow-up unless the controlling AIS rule explicitly applies"], requiredInputs: ["treatment diagnosis", "treatment date", "co-test stage", "HPV result", "cytology result", "prior qualifying co-test sequence"], conditionalInputs: [(ruleId as string).includes("MARGINS") ? "excision margin status and age" : ""].filter(Boolean), branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: ["COLPOSCOPY", "SPECIALIST_FOLLOW_UP"].includes(actionClass as string), referralDestination: actionClass === "COLPOSCOPY" ? "colposcopy" : actionClass === "SPECIALIST_FOLLOW_UP" ? "colposcopy/specialist service" : null, guidelineTimeframe: interval as string | null, repeatInterval: interval as string | null, mandatoryClinicianReview: ["COLPOSCOPY", "SPECIALIST_FOLLOW_UP", "SAFETY_STOP"].includes(actionClass as string), clinicianOnly: actionClass === "SPECIALIST_FOLLOW_UP", missingDataBehaviour: "Do not calculate or complete Test of Cure without its treatment anchor and longitudinal sequence.", rationale: "Test of Cure requires two qualifying negative co-tests and escalates HPV detection/high-grade abnormalities.", sourceDocument: (ruleId as string).includes("POSITIVE-MARGINS") ? `${PRIMARY}; ${ADDENDUM}` : PRIMARY, sourceVersion: (ruleId as string).includes("POSITIVE-MARGINS") ? `${PRIMARY_VERSION}; addendum v1.0` : PRIMARY_VERSION, effectiveRuleVersion: (ruleId as string).includes("POSITIVE-MARGINS") ? "2026-addendum-v1.0" : "2023-v1.1", supersededRule: ruleId === "F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC" ? "2023 R8.06 required colposcopy follow-up for positive margins." : null }));

// Figure 7: individual cytology-code routing plus downstream MDM/biopsy exits.
for (const code of ["AG2", "AC2"] as const) {
  add({ ruleId: `F7-${code}-GYNAECOLOGY`, figureOrTable: "Figure 7", page: 59, recommendationNumbers: ["R9.04-R9.10"], entryCriteria: ["glandular abnormality"], requiredInputs: ["exact cytology code"], branchConditions: [code], expectedAction: "Refer to gynaecology.", actionClass: "GYNAECOLOGY", referralRequired: true, referralDestination: "gynaecology", guidelineTimeframe: code === "AC2" ? "urgent" : null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: true, rationale: "Endometrial categories follow gynaecology rather than the cervical colposcopy branch." });
}
for (const code of ["AG1", "AG3", "AG4", "AG5", "AC1", "AC3", "AC4"] as const) {
  add({ ruleId: `F7-${code}-COLPOSCOPY`, figureOrTable: "Figure 7", page: 59, recommendationNumbers: ["R9.04-R9.10"], entryCriteria: ["glandular abnormality"], requiredInputs: ["exact cytology code"], branchConditions: [code], expectedAction: "Refer to colposcopy for specialist assessment.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: code.startsWith("AC") ? "urgent" : null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: true, rationale: "The source routes these non-endometrial glandular categories to colposcopy." });
}
[
  ["F7-NO-LESION-CYTOLOGY-CONFIRMED-TYPE3-EXCISION", ["no visible lesion", "MDM confirms cytology, not AG2"], "Specialist Type 3 excision.", "TYPE3_EXCISION", null],
  ["F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE", ["no visible lesion", "MDM confirms AG2"], "Investigate further for other gynaecological malignancies.", "GYNAECOLOGY_INVESTIGATION", null],
  ["F7-NO-LESION-CYTOLOGY-NOT-CONFIRMED-6M", ["no visible lesion", "MDM does not confirm cytology"], "Repeat colposcopy in six months.", "REPEAT_COLPOSCOPY", "6 months"],
  ["F7-VISIBLE-LESION-BIOPSY-AIS-TYPE3", ["visible lesion", "biopsy shows AIS"], "Specialist Type 3 excision.", "TYPE3_EXCISION", null],
  ["F7-VISIBLE-LESION-BIOPSY-CANCER-ONCOLOGY", ["visible lesion", "biopsy consistent with cancer"], "Refer to gynaecological oncology.", "ONCOLOGY", "urgent"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 7", page: 59, recommendationNumbers: ["R9.04-R9.13"], entryCriteria: ["colposcopy completed for a non-endometrial glandular abnormality"], requiredInputs: ["visible-lesion status", "MDM result when no lesion", "biopsy result when lesion"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: ["GYNAECOLOGY_INVESTIGATION", "ONCOLOGY", "TYPE3_EXCISION"].includes(actionClass as string), referralDestination: actionClass === "ONCOLOGY" ? "gynaecological oncologist" : actionClass === "GYNAECOLOGY_INVESTIGATION" ? "gynaecology" : actionClass === "TYPE3_EXCISION" ? "specialist excision service" : null, guidelineTimeframe: interval as string | null, repeatInterval: interval as string | null, mandatoryClinicianReview: true, clinicianOnly: true, missingDataBehaviour: "CLINICIAN_REVIEW_REQUIRED; do not infer MDM, biopsy, lesion, or cancer status.", rationale: "Every downstream Figure 7 outcome requires specialist evidence." }));
add({ ruleId: "F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M", figureOrTable: "Figure 7", page: 59, pdfPage: 61, recommendationNumbers: ["R9.14"], entryCriteria: ["HPV-detected AIS treated by excision", "clear margins"], requiredInputs: ["pre-treatment HPV status", "AIS histology", "margin status", "treatment date"], branchConditions: ["clear margins"], expectedAction: "Follow in primary/community care with co-tests at 6 and 18 months.", actionClass: "COMMUNITY_TOC", referralRequired: false, referralDestination: "primary/community care", guidelineTimeframe: "6 and 18 months post-treatment", repeatInterval: "6 months then 12 months", mandatoryClinicianReview: true, clinicianOnly: false, rationale: "Updated R9.14 changes the care setting while retaining the two co-test sequence.", sourceDocument: ADDENDUM, sourceVersion: "Doc ID 18519 v1.0", effectiveRuleVersion: "2026-addendum-v1.0", supersededRule: "The 2023 pathway placed the first post-treatment co-test at colposcopy." });

// Figure 8 summary combinations. Table 1 remains the controlling detailed matrix.
[
  ["F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR", ["stage 1a1 cervical cancer treated by local excision", "treatment and Test of Cure successful"], "Return to regular NCSP screening.", "ROUTINE_SCREENING", null],
  ["F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY", ["stage 1a1 cervical cancer local excision", "HPV detected or abnormal cytology during Test of Cure"], "Refer to colposcopy.", "COLPOSCOPY", null],
  ["F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3", ["stage 1a1 cervical cancer local excision", "Test of Cure complete", "subsequent HPV detected"], "Follow the HPV primary screening pathway.", "ROUTE_FIGURE_3", null],
  ["F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE", ["stage 1a1 cervical cancer", "total hysterectomy", "Test of Cure complete"], "Cease NCSP screening.", "NO_FURTHER_SCREENING", null],
  ["F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP", ["other gynaecological cancer history", "not enrolled in an NCSP pathway"], "No deterministic NCSP recommendation; clinician and participant determine follow-up.", "CLINICIAN_REVIEW_REQUIRED", null],
  ["F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC", ["total hysterectomy for non-cervical gynaecological cancer", "HSIL history without completed Test of Cure"], "Complete Test of Cure and obtain two negative co-tests 12 months apart before cessation.", "CONTINUE_TOC", "two negative co-tests 12 months apart"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 8", page: 5, pdfPage: 5, recommendationNumbers: ["Screening after gynaecological cancer update"], entryCriteria: ["screening after gynaecological cancer"], exclusionCriteria: ["subtotal hysterectomy continues cervical screening"], requiredInputs: ["cancer type/stage", "treatment type/date", "hysterectomy type", "Test of Cure sequence", "current HPV/cytology", "NCSP enrolment status"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: actionClass === "COLPOSCOPY", referralDestination: actionClass === "COLPOSCOPY" ? "colposcopy" : null, guidelineTimeframe: interval as string | null, repeatInterval: actionClass === "CONTINUE_TOC" ? "12 months between two negative co-tests" : null, mandatoryClinicianReview: true, clinicianOnly: actionClass === "CLINICIAN_REVIEW_REQUIRED", missingDataBehaviour: "CLINICIAN_REVIEW_REQUIRED; cancer stage, treatment, enrolment, hysterectomy type, and Test of Cure cannot be inferred.", rationale: "The addendum supersedes affected screening-after-gynaecological-cancer scenarios while leaving other participants outside a deterministic NCSP rule.", sourceDocument: ADDENDUM, sourceVersion: "Doc ID 18519 v1.0", effectiveRuleVersion: "2026-addendum-v1.0", supersededRule: "Affected 2023 cancer-history/hysterectomy follow-up is replaced by the addendum." }));
[
  ["F8-LOW-RISK-NO-PATHOLOGY-NO-FURTHER", ["negative/returned-regular history", "no cervical pathology"], "No further screening.", "NO_FURTHER_SCREENING"],
  ["F8-LOW-RISK-LSIL-HPV", ["negative/returned-regular history", "unexpected LSIL/CIN1"], "Perform HPV test; if detected follow Figure 3, if not detected cease.", "POST_HYSTERECTOMY_HPV"],
  ["F8-LOW-RISK-COMPLETE-HSIL-AIS-TOC", ["negative/returned-regular history", "unexpected HSIL/AIS completely excised"], "Complete Test of Cure.", "TEST_OF_CURE"],
  ["F8-LOW-RISK-INCOMPLETE-HSIL-AIS-COLPOSCOPY", ["negative/returned-regular history", "unexpected HSIL/AIS incompletely excised"], "Refer to colposcopy.", "COLPOSCOPY"],
  ["F8-NO-KNOWN-HISTORY-NO-LOW-PATHOLOGY-HPV6M", ["no known screening history", "no pathology or LSIL/CIN1"], "HPV test at six months after hysterectomy.", "POST_HYSTERECTOMY_HPV_6M"],
  ["F8-PRIOR-LOW-GRADE-NOT-RETURNED-HPV", ["prior low-grade history not returned to regular screening", "normal or LSIL pathology"], "Perform HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"],
  ["F8-TREATED-HSIL-AIS-TOC-COMPLETE-NO-PATH-NO-FURTHER", ["previous HSIL/AIS treatment", "Test of Cure complete", "no cervical pathology"], "No further screening.", "NO_FURTHER_SCREENING"],
  ["F8-TREATED-HSIL-AIS-TOC-COMPLETE-LSIL-HPV", ["previous HSIL/AIS treatment", "Test of Cure complete", "LSIL/CIN1 pathology"], "Perform HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"],
  ["F8-INCOMPLETE-TOC-NO-LOW-PATH-CONTINUE-TOC", ["previous HSIL/AIS", "Test of Cure incomplete", "no pathology or LSIL/CIN1"], "Continue Test of Cure until successful completion.", "CONTINUE_TOC"],
  ["F8-UNTREATED-HSIL-AIS-NO-LOW-PATH-TOC", ["HSIL/AIS untreated or incompletely treated before hysterectomy", "no pathology or LSIL/CIN1"], "Complete Test of Cure.", "TEST_OF_CURE"],
  ["F8-ANY-HIGH-GRADE-COMPLETE-TOC", ["HSIL/CIN2/3 or AIS in specimen", "complete excision"], "Complete Test of Cure.", "TEST_OF_CURE"],
  ["F8-ANY-HIGH-GRADE-INCOMPLETE-COLPOSCOPY", ["HSIL/CIN2/3 or AIS in specimen", "incomplete excision"], "Refer to colposcopy.", "COLPOSCOPY"],
] .forEach(([ruleId, conditions, expectedAction, actionClass]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 8", page: 67, recommendationNumbers: [], entryCriteria: ["total hysterectomy confirmed", "not a clinician-led cancer follow-up exclusion"], exclusionCriteria: ["subtotal hysterectomy", "active abnormal bleeding", "specialist cancer surveillance outside NCSP"], requiredInputs: ["hysterectomy type", "prior screening/treatment history", "specimen pathology", "excision completeness"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: actionClass === "COLPOSCOPY", referralDestination: actionClass === "COLPOSCOPY" ? "colposcopy" : null, guidelineTimeframe: actionClass === "POST_HYSTERECTOMY_HPV_6M" ? "6 months post-hysterectomy" : null, repeatInterval: actionClass === "POST_HYSTERECTOMY_HPV_6M" ? "6 months" : null, mandatoryClinicianReview: ["COLPOSCOPY", "TEST_OF_CURE", "CONTINUE_TOC"].includes(actionClass as string), clinicianOnly: false, rationale: "Figure 8 is a summary; Table 1 controls exact history/pathology combinations.", sourceAmbiguity: "The source has typographic cross-reference/CIN spelling inconsistencies; the rendered figure and Table 1 determine routing." }));

// Table 1: 21 exact displayed row/cell combinations.
const tableGroups = [
  { id: "NEGATIVE-OR-RETURNED-REGULAR", history: "negative history or previous ASC-US/LSIL returned to regular screening", indication: "benign gynaecological disease", cells: [["NO-PATHOLOGY", "no cervical pathology", "No further screening.", "NO_FURTHER_SCREENING"], ["LSIL-CIN1", "LSIL/CIN1, excised or not", "HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
  { id: "LOW-GRADE-NOT-RETURNED", history: "previous ASC-US/LSIL not returned to regular screening", indication: "benign gynaecological disease", cells: [["NO-PATHOLOGY", "no cervical pathology", "HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"], ["LSIL-CIN1", "LSIL/CIN1, excised or not", "HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
  { id: "TREATED-HSIL-TOC-COMPLETE", history: "treated HSIL/CIN2/3 with completed Test of Cure", indication: "benign gynaecological disease", cells: [["NO-PATHOLOGY", "no cervical pathology", "No further screening.", "NO_FURTHER_SCREENING"], ["LSIL-CIN1", "LSIL/CIN1, excised or not", "HPV test and follow Figure 3.", "POST_HYSTERECTOMY_HPV"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
  { id: "HSIL-AIS-UNTREATED-INCOMPLETE", history: "diagnosed HSIL/CIN2/3 or AIS before hysterectomy, untreated or incompletely treated", indication: "HSIL/CIN2/3 or AIS with or without benign disease", cells: [["NO-OR-LOW-PATHOLOGY", "no cervical pathology or low grade", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
  { id: "PREVIOUS-TREATMENT-INCOMPLETE-TOC", history: "previous treatment for HSIL/CIN2/3 or AIS with incomplete Test of Cure", indication: "benign gynaecological disease", cells: [["NO-OR-LOW-PATHOLOGY", "no cervical pathology or low grade", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
  { id: "NO-KNOWN-HISTORY", history: "no known screening history", indication: "benign gynaecological disease", cells: [["NO-OR-LOW-PATHOLOGY", "no cervical pathology or low grade", "HPV test at six months post-hysterectomy.", "POST_HYSTERECTOMY_HPV_6M"], ["HSIL-AIS-COMPLETE", "HSIL/CIN2/3 or AIS completely excised", "Test of Cure.", "TEST_OF_CURE"], ["HSIL-AIS-INCOMPLETE", "HSIL/CIN2/3 or AIS incompletely excised", "Colposcopy.", "COLPOSCOPY"]] },
] as const;
for (const group of tableGroups) {
  for (const [cellId, pathology, expectedAction, actionClass] of group.cells) {
    add({ ruleId: `T1-${group.id}-${cellId}`, figureOrTable: "Table 1", page: 66, recommendationNumbers: [], entryCriteria: ["total hysterectomy", group.indication], exclusionCriteria: ["subtotal hysterectomy", "cervical/vaginal cancer specialist follow-up"], requiredInputs: ["hysterectomy type", "indication", "prior screening/treatment history", "specimen pathology", "excision completeness when high-grade/AIS"], branchConditions: [group.history, pathology], expectedAction, actionClass, referralRequired: actionClass === "COLPOSCOPY", referralDestination: actionClass === "COLPOSCOPY" ? "colposcopy" : null, guidelineTimeframe: actionClass === "POST_HYSTERECTOMY_HPV_6M" ? "6 months post-hysterectomy" : null, repeatInterval: actionClass === "POST_HYSTERECTOMY_HPV_6M" ? "6 months" : null, mandatoryClinicianReview: actionClass === "COLPOSCOPY" || actionClass === "TEST_OF_CURE", clinicianOnly: false, rationale: "This object preserves one exact displayed Table 1 row/cell outcome." });
  }
}

// Figure 9: initial qualifying categories and all displayed post-colposcopy exits.
for (const [code, label] of [["ASC-H", "ASC-H"], ["HSIL", "HSIL"], ["ATYPICAL-GLANDULAR", "atypical glandular cells"], ["AIS", "AIS"]] as const) {
  add({ ruleId: `F9-PREGNANT-${code}-INITIAL-COLPOSCOPY`, figureOrTable: "Figure 9", page: 71, recommendationNumbers: ["R11.01-R11.06"], entryCriteria: ["pregnant participant"], requiredInputs: ["pregnancy status", "cytology result"], branchConditions: [`${label} cytology`], expectedAction: "Refer for colposcopy by an experienced colposcopist; do not treat autonomously.", actionClass: "COLPOSCOPY", referralRequired: true, referralDestination: "colposcopy", guidelineTimeframe: null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: true, rationale: "Possible/definite high-grade in-situ cytology in pregnancy receives specialist colposcopy." });
}
[
  ["F9-NORMAL-TZ-MDM-DOWNGRADE-NEGATIVE-F3", ["normal transformation zone/no visible lesion", "MDM downgrades to negative"], "Follow Figure 3 HPV primary screening.", "ROUTE_FIGURE_3", null],
  ["F9-NORMAL-TZ-MDM-DOWNGRADE-LOW-GRADE", ["normal transformation zone/no visible lesion", "MDM downgrades to ASC-US/LSIL"], "Follow the LSIL pathway.", "ROUTE_LSIL", null],
  ["F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW", ["normal transformation zone/no visible lesion", "MDM confirms possible/definite high-grade"], "Colposcopy review in six months or 6–12 weeks postpartum.", "PREGNANCY_COLPOSCOPY_REVIEW", "6 months or 6–12 weeks postpartum"],
  ["F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW", ["abnormal transformation zone/visible lesion", "colposcopic impression LSIL, HSIL/CIN2/3, or AIS"], "Colposcopy review in six months or 6–12 weeks postpartum.", "PREGNANCY_COLPOSCOPY_REVIEW", "6 months or 6–12 weeks postpartum"],
  ["F9-INVASION-BIOPSY-POSITIVE-ONCOLOGY", ["colposcopic impression of invasion", "biopsy positive for invasion"], "Refer to gynaecological oncology.", "ONCOLOGY", "urgent"],
  ["F9-INVASION-BIOPSY-NEGATIVE-MDM", ["colposcopic impression of invasion", "biopsy negative for invasion"], "MDM case review.", "MDM_REVIEW", null],
] .forEach(([ruleId, conditions, expectedAction, actionClass, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 9", page: 71, recommendationNumbers: ["R11.01-R11.11"], entryCriteria: ["pregnancy", "qualifying high-grade/glandular cytology", "colposcopy performed"], requiredInputs: ["transformation-zone/visible-lesion assessment", "MDM outcome or biopsy result as applicable", "pregnancy/postpartum timing"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: actionClass === "ONCOLOGY", referralDestination: actionClass === "ONCOLOGY" ? "gynaecological oncologist" : null, guidelineTimeframe: interval as string | null, repeatInterval: actionClass === "PREGNANCY_COLPOSCOPY_REVIEW" ? "6 months or 6–12 weeks postpartum" : null, mandatoryClinicianReview: true, clinicianOnly: true, missingDataBehaviour: "CLINICIAN_REVIEW_REQUIRED; do not infer colposcopic impression, biopsy, MDM, invasion, or postpartum timing.", rationale: "Pregnancy specialist findings and invasion assessment remain clinician-led." }));

// Figure 10: symptoms override routine screening; local-pathway treatment remains clinician-led.
[
  ["F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY", ["single episode of postcoital bleeding", "pre-menopausal", "clinically normal cervix", "HPV not detected", "negative cytology"], "No colposcopy referral is required; continue appropriate screening and clinical follow-up.", "NO_COLPOSCOPY", null, null, "R15.02"],
  ["F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY", ["postcoital bleeding recurs or persists", "negative co-test does not resolve symptom concern"], "Refer to gynaecology for assessment, which may include colposcopy.", "GYNAECOLOGY", "gynaecology", "as appropriate without routine-screening reassurance", "R15.02"],
  ["F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY", ["persistent and/or unexplained inter-menstrual bleeding"], "Refer for specialist gynaecological assessment regardless of test results.", "GYNAECOLOGY", "specialist gynaecology", "without allowing screening results to cancel referral", "R15.05"],
  ["F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY", ["any postmenopausal bleeding, including postcoital bleeding"], "Examine, obtain a co-test, and refer for specialist gynaecological assessment; do not delay for blood or results.", "URGENT_GYNAECOLOGY", "specialist gynaecology", "referral must not wait for co-test results", "R15.06"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, referralDestination, interval, recommendation]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 10", page: 83, recommendationNumbers: [recommendation as string], entryCriteria: ["abnormal vaginal bleeding"], exclusionCriteria: ["routine screening must not replace symptom investigation"], requiredInputs: ["menopausal status/age", "bleeding type and persistence", "cervical examination", "co-test results when relevant"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: Boolean(referralDestination), referralDestination: referralDestination as string | null, guidelineTimeframe: interval as string | null, repeatInterval: null, mandatoryClinicianReview: true, clinicianOnly: Boolean(referralDestination), missingDataBehaviour: "Do not infer resolution, menopausal status, examination, or co-test results; obtain the missing fact while preserving symptom escalation.", rationale: "Adjacent R15 recommendations control bleeding branches that the flowchart abbreviates." }));
[
  ["F10-CANCER-SIGNS-URGENT-GYNAECOLOGY", ["signs or symptoms of cervical cancer"], "Refer for gynaecological assessment without delay; do not wait for co-test results.", "URGENT_GYNAECOLOGY", "gynaecology", "without delay"],
  ["F10-ABNORMAL-CERVIX-CANCER-COTEST-COLPOSCOPY", ["abnormal cervix", "suspicion of cancer"], "Perform co-test and refer to colposcopy; do not delay referral for the co-test.", "COLPOSCOPY", "colposcopy", "without delay"],
  ["F10-ABNORMAL-CERVIX-NO-CANCER-LOCAL-REVIEW", ["abnormal cervix", "no suspicion of cancer"], "Treat according to approved Healthcare Pathways or refer to gynaecology, then review.", "LOCAL_PATHWAY_REVIEW", "gynaecology if indicated", "6–8 weeks"],
  ["F10-NORMAL-CERVIX-OCP-ADJUST-REVIEW", ["normal cervix", "oral-contraceptive problem suspected"], "Adjust oral contraceptive and review bleeding.", "OCP_REVIEW", null, "6–8 weeks"],
  ["F10-NORMAL-CERVIX-STI-TREAT-REVIEW", ["normal cervix", "no OCP problem", "STI identified"], "Treat STI and review bleeding.", "STI_REVIEW", null, "6–8 weeks"],
  ["F10-NORMAL-CERVIX-NO-STI-LOCAL-PATHWAY", ["normal cervix", "no OCP problem", "no STI identified"], "Manage according to an approved Healthcare Pathway or refer to gynaecology.", "LOCAL_PATHWAY_REVIEW", "gynaecology if indicated", "6–8 weeks if treated locally"],
  ["F10-REVIEW-BLEEDING-RESOLVED-AGE25PLUS", ["bleeding resolved at 6–8 week review", "age 25 or older"], "Continue regular cervical screening.", "ROUTINE_SCREENING", null, null],
  ["F10-REVIEW-BLEEDING-RESOLVED-UNDER25", ["bleeding resolved at 6–8 week review", "age below 25"], "Commence routine cervical screening at age 25.", "SCREEN_AT_25", null, "at age 25"],
  ["F10-REVIEW-BLEEDING-PERSISTS-GYNAECOLOGY", ["bleeding persists at 6–8 week review"], "Refer to gynaecology.", "GYNAECOLOGY", "gynaecology", "after 6–8 week review"],
] .forEach(([ruleId, conditions, expectedAction, actionClass, referralDestination, interval]) => add({ ruleId: ruleId as string, figureOrTable: "Figure 10", page: 83, recommendationNumbers: [], entryCriteria: ["abnormal inter-menstrual or post-coital bleeding"], exclusionCriteria: ["do not substitute routine screening for symptom investigation"], requiredInputs: ["bleeding type/history", "speculum and pelvic examination", "cervix appearance", "cancer suspicion", "co-test", "OCP/STI assessment", "resolution at review"], branchConditions: conditions as string[], expectedAction: expectedAction as string, actionClass: actionClass as string, referralRequired: Boolean(referralDestination), referralDestination: referralDestination as string | null, guidelineTimeframe: interval as string | null, repeatInterval: interval && (interval as string).includes("6–8") ? "6–8 weeks" : null, mandatoryClinicianReview: ["URGENT_GYNAECOLOGY", "COLPOSCOPY", "LOCAL_PATHWAY_REVIEW", "GYNAECOLOGY", "OCP_REVIEW", "STI_REVIEW"].includes(actionClass as string), clinicianOnly: ["URGENT_GYNAECOLOGY", "LOCAL_PATHWAY_REVIEW", "GYNAECOLOGY", "OCP_REVIEW", "STI_REVIEW"].includes(actionClass as string), missingDataBehaviour: "Do not invent examination, treatment, or work-up facts. OCP adjustment and STI treatment are clinician-only actions whose completion requires recorded evidence.", rationale: "Figure 10 is a symptom-investigation pathway and takes precedence over routine screening." }));

export const guidelineOracle: readonly GuidelineRule[] = rules;

export const oracleCounts = Object.freeze(
  guidelineOracle.reduce<Record<SourceArea, number>>((counts, rule) => {
    counts[rule.figureOrTable] = (counts[rule.figureOrTable] ?? 0) + 1;
    return counts;
  }, {} as Record<SourceArea, number>)
);

export function rulesFor(source: SourceArea): readonly GuidelineRule[] {
  return guidelineOracle.filter((rule) => rule.figureOrTable === source);
}
