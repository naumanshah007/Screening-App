// Catalog of guideline-engine branches an admin can override via the overlay
// (lib/engine/overlay.ts). Keyed by the engine's recommendationCode.
//
// IMPORTANT: this catalog is the admin-VISIBLE list of editable branches. The
// overlay mechanism works for ANY recommendationCode at runtime — so correctness
// does not depend on this list being exhaustive. A test asserts every code here
// is a real code the engine can emit (no typos/phantoms); the list can be
// extended over time without any engine change.
//
// Safety-stop codes (…-REQUIRED / …-UNMAPPED / …-UNKNOWN) are intentionally NOT
// listed: admins must not be able to weaken a "needs information" stop.

import type { PathwayFigure } from "./types";

export type GuidelineCatalogEntry = {
  code: string;
  figure: PathwayFigure | "AGE_GATE";
  title: string;
};

export const GUIDELINE_RULE_CATALOG: GuidelineCatalogEntry[] = [
  // ── Age eligibility gates ──────────────────────────────────────────────
  { code: "AGE-UNDER-25", figure: "AGE_GATE", title: "Under 25, asymptomatic — no routine screening" },
  { code: "AGE-70-74-HPV-NOT-DETECTED-DISCHARGE", figure: "AGE_GATE", title: "Age 70–74, HPV not detected — discharge" },
  { code: "AGE-70-74-HPV-DETECTED-COLP", figure: "AGE_GATE", title: "Age 70–74, HPV detected — colposcopy" },
  { code: "AGE-75-DISCHARGE", figure: "AGE_GATE", title: "Age 75+ , asymptomatic — discharge" },

  // ── Figure 1: transition (low risk) ────────────────────────────────────
  { code: "F1-INVITE-NOW", figure: "FIGURE_1", title: "Transition — invite now" },
  { code: "F1-INVITE-NEXT-SCHEDULED", figure: "FIGURE_1", title: "Transition — invite at next scheduled visit" },

  // ── Figure 2: transition (prior high-grade / glandular) ─────────────────
  { code: "F2-PRIOR-HG-COLP", figure: "FIGURE_2", title: "Prior high-grade, colposcopy outstanding — colposcopy" },
  { code: "F2-PRIOR-HG-COMPLETE-TOC", figure: "FIGURE_2", title: "Prior high-grade — complete Test of Cure" },
  { code: "F2-AG2-SPECIALIST-GYN", figure: "FIGURE_2", title: "Prior atypical endometrial — specialist gynaecology" },

  // ── Figure 3: primary HPV screening ─────────────────────────────────────
  { code: "F3-HPV-NOT-DETECTED-5Y", figure: "FIGURE_3", title: "HPV not detected — recall 5 years" },
  { code: "F3-HPV-NOT-DETECTED-IC-3Y", figure: "FIGURE_3", title: "HPV not detected, immune deficient — recall 3 years" },
  { code: "F3-1618-COLP", figure: "FIGURE_3", title: "HPV 16/18 — colposcopy" },
  { code: "F3-1618-HIGH-GRADE-COLP", figure: "FIGURE_3", title: "HPV 16/18 + high-grade cytology — colposcopy" },
  { code: "F3-HPV-OTHER-HIGH-GRADE-COLP", figure: "FIGURE_3", title: "HPV Other + high-grade cytology — colposcopy" },
  { code: "F3-HPV-OTHER-NEG-ASCUS-LSIL-12M", figure: "FIGURE_3", title: "HPV Other + neg/ASC-US/LSIL — repeat 12 months" },
  { code: "F3-FIRST-REPEAT-AGE50-COLP", figure: "FIGURE_3", title: "First repeat HPV Other, age ≥50 — colposcopy" },
  { code: "F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT", figure: "FIGURE_3", title: "First repeat HPV Other, age <50 — second repeat 12 months" },
  { code: "F3-SECOND-REPEAT-HPV-DETECTED-COLP", figure: "FIGURE_3", title: "Second repeat HPV detected — colposcopy" },
  { code: "F3-INAD-3M", figure: "FIGURE_3", title: "Inadequate HPV — repeat 3 months" },

  // ── Figure 4: post-normal-colposcopy, low-grade ─────────────────────────
  { code: "F4-NORMAL-COLP-REPEAT-HPV-12M", figure: "FIGURE_4", title: "Normal colposcopy — repeat HPV 12 months" },
  { code: "F4-REPEAT-1618-COLP", figure: "FIGURE_4", title: "Repeat HPV 16/18 — colposcopy" },
  { code: "F4-HPV-OTHER-HIGH-GRADE-COLP", figure: "FIGURE_4", title: "HPV Other + ≥ASC-H — colposcopy" },
  { code: "F4-HPV-OTHER-LOW-GRADE-IC-COLP", figure: "FIGURE_4", title: "HPV Other low-grade, immune deficient — colposcopy" },
  { code: "F4-HPV-OTHER-LOW-GRADE-SECOND-REPEAT", figure: "FIGURE_4", title: "HPV Other low-grade — repeat 12 months" },

  // ── Figure 6: Test of Cure ──────────────────────────────────────────────
  { code: "F6-FIRST-NEGATIVE-REPEAT-12M", figure: "FIGURE_6", title: "First negative co-test — repeat 12 months" },
  { code: "F6-SECOND-NEGATIVE-RETURN-REGULAR", figure: "FIGURE_6", title: "Second negative co-test — return to regular screening" },
  { code: "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP", figure: "FIGURE_6", title: "HPV detected, any cytology — colposcopy" },
  { code: "F6-HPV-NEG-HIGH-GRADE-COLP", figure: "FIGURE_6", title: "HPV neg + high-grade cytology — colposcopy" },
  { code: "F6-HPV-NEG-LOW-GRADE-REPEAT-12M", figure: "FIGURE_6", title: "HPV neg + low-grade cytology — repeat 12 months" },

  // ── Figure 7: glandular abnormalities (specialist) ──────────────────────
  { code: "F7-AG2-GYNAECOLOGY", figure: "FIGURE_7", title: "AG2 — refer to gynaecology" },
  { code: "F7-AC2-GYNAECOLOGY", figure: "FIGURE_7", title: "AC2 — refer to gynaecology" },
  { code: "F7-GLANDULAR-COLPOSCOPY", figure: "FIGURE_7", title: "Glandular abnormality — colposcopy" },
  { code: "F7-BIOPSY-CANCER-ONCOLOGY", figure: "FIGURE_7", title: "Biopsy consistent with cancer — gynae-oncology" },

  // ── Figure 9: pregnancy (specialist) ────────────────────────────────────
  { code: "F9-INITIAL-COLPOSCOPY", figure: "FIGURE_9", title: "Pregnant + high-grade cytology — colposcopy" },
  { code: "F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY", figure: "FIGURE_9", title: "Biopsy positive for invasion — gynae-oncology" },

  // ── Figure 10: abnormal bleeding ────────────────────────────────────────
  { code: "F10-CANCER-SYMPTOMS-URGENT-GYN", figure: "FIGURE_10", title: "Cancer symptoms — urgent gynaecology" },
  { code: "F10-ABNORMAL-CERVIX-CANCER-COTEST-COLP", figure: "FIGURE_10", title: "Abnormal cervix + cancer suspicion — co-test + colposcopy" },
  { code: "F10-REVIEW-UNRESOLVED-GYNAECOLOGY", figure: "FIGURE_10", title: "Bleeding unresolved at review — gynaecology" },
];

export function getCatalogEntry(code: string): GuidelineCatalogEntry | undefined {
  return GUIDELINE_RULE_CATALOG.find((entry) => entry.code === code);
}
