import type { ServiceLine, TriagePriority } from "@prisma/client";

type RuleFixtureFact = {
  label: string;
  valueText: string;
  valueNumber?: number;
};

export type CaseRuleFixture = {
  id: string;
  title: string;
  serviceLine: ServiceLine;
  sourceNote: string;
  highSuspicionCancer?: boolean;
  facts: RuleFixtureFact[];
  expected: {
    priority: TriagePriority;
    category: string;
    matchedRuleCode?: string | null;
  };
};

export const CASE_RULE_FIXTURES: CaseRuleFixture[] = [
  {
    id: "colpo-high-suspicion-cancer",
    title: "High suspicion cancer goes urgent",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Colposcopy grading template and triage guide urgent cancer bucket.",
    highSuspicionCancer: true,
    facts: [],
    expected: {
      priority: "P1_HSC",
      category: "High suspicion cancer",
      matchedRuleCode: "COL-001",
    },
  },
  {
    id: "colpo-high-grade-hsil",
    title: "High-grade cytology escalates",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Colposcopy guide booking-priority rows for higher-risk cervical findings.",
    facts: [{ label: "HSIL", valueText: "Detected" }],
    expected: {
      priority: "P2",
      category: "High-grade colposcopy referral",
      matchedRuleCode: "COL-003",
    },
  },
  {
    id: "colpo-hpv-other-immune-deficient",
    title: "HPV other with immune deficiency escalates above routine",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Colposcopy guide row: HPV Other immune deficient direct referral.",
    facts: [
      { label: "HPV Other", valueText: "Positive" },
      { label: "Immune deficient", valueText: "Present" },
    ],
    expected: {
      priority: "P2",
      category: "Higher-risk HPV other referral",
      matchedRuleCode: "COL-005",
    },
  },
  {
    id: "colpo-abnormal-appearance",
    title: "Abnormal appearance escalates",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Colposcopy guide row: abnormal appearance sample/referral.",
    facts: [{ label: "Abnormal appearance", valueText: "Present" }],
    expected: {
      priority: "P2",
      category: "Abnormal appearance referral",
      matchedRuleCode: "COL-006",
    },
  },
  {
    id: "colpo-routine-hpv-other",
    title: "HPV other alone stays routine",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Colposcopy guide rows for HPV other primary screening.",
    facts: [{ label: "HPV Other", valueText: "Positive" }],
    expected: {
      priority: "P3",
      category: "Routine colposcopy referral",
      matchedRuleCode: "COL-007",
    },
  },
  {
    id: "gyn-pmb-no-ultrasound",
    title: "PMB without ultrasound is rejected back for imaging",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 4: PMB with no USS -> reject and re-refer with USS.",
    facts: [{ label: "Postmenopausal bleeding", valueText: "Present" }],
    expected: {
      priority: "REJECT",
      category: "Postmenopausal bleeding",
      matchedRuleCode: "GYN-002",
    },
  },
  {
    id: "gyn-pmb-thickened-endometrium",
    title: "PMB with ET >= 5 mm is high suspicion",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 4: PMB ET >= 5 mm -> HSC P1.",
    facts: [
      { label: "Postmenopausal bleeding", valueText: "Present" },
      { label: "Endometrial thickness", valueText: "6 mm", valueNumber: 6 },
    ],
    expected: {
      priority: "P1_HSC",
      category: "Postmenopausal bleeding",
      matchedRuleCode: "GYN-003",
    },
  },
  {
    id: "gyn-recurrent-pmb-low-et",
    title: "Recurrent PMB with ET below 5 mm still stays HSC",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 4: multiple episodes of PMB but ET < 5 mm -> HSC P1.",
    facts: [
      { label: "Postmenopausal bleeding", valueText: "Present" },
      { label: "Multiple PMB episodes", valueText: "Present" },
      { label: "Endometrial thickness", valueText: "3 mm", valueNumber: 3 },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "P1_HSC",
      category: "Postmenopausal bleeding",
      matchedRuleCode: "GYN-004",
    },
  },
  {
    id: "gyn-ovarian-concern-ca125",
    title: "Ovarian concern with elevated CA-125 becomes P2-HSC",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Guideline pages 3 and 5: concerning adnexal mass examples in HSC P2.",
    facts: [
      { label: "Ovarian cyst", valueText: "Referenced" },
      { label: "CA-125", valueText: "82", valueNumber: 82 },
    ],
    expected: {
      priority: "P2_HSC",
      category: "Concerning ovarian/adnexal mass",
      matchedRuleCode: "GYN-005",
    },
  },
  {
    id: "gyn-pelvic-pain-no-ultrasound",
    title: "Pelvic pain without USS is rejected",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 5: pelvic pain without USS -> reject and re-refer with USS.",
    facts: [{ label: "Pelvic pain", valueText: "Present" }],
    expected: {
      priority: "REJECT",
      category: "Pelvic pain",
      matchedRuleCode: "GYN-006",
    },
  },
  {
    id: "gyn-large-fibroids-mass-symptoms",
    title: "Fibroids >= 3 cm with mass symptoms are P2",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 3: fibroids >3 cm with mass symptoms -> P2.",
    facts: [
      { label: "Fibroids", valueText: "Referenced" },
      { label: "Mass symptoms", valueText: "Present" },
      { label: "Fibroid size", valueText: "4 cm", valueNumber: 4 },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "P2",
      category: "Fibroids with mass symptoms",
      matchedRuleCode: "GYN-007",
    },
  },
  {
    id: "gyn-small-fibroids-mass-symptoms",
    title: "Fibroids under 3 cm with mass symptoms stay P3",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 3: fibroids <3 cm with mass symptoms -> P3.",
    facts: [
      { label: "Fibroids", valueText: "Referenced" },
      { label: "Mass symptoms", valueText: "Present" },
      { label: "Fibroid size", valueText: "2 cm", valueNumber: 2 },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "P3",
      category: "Fibroids with mass symptoms",
      matchedRuleCode: "GYN-008",
    },
  },
  {
    id: "gyn-pcos-virtual",
    title: "PCOS routes to virtual clinic",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 7: PCOS virtual only.",
    facts: [{ label: "PCOS", valueText: "Referenced" }],
    expected: {
      priority: "P5",
      category: "PCOS virtual review",
      matchedRuleCode: "GYN-009",
    },
  },
  {
    id: "gyn-fertility-decline",
    title: "Fertility referrals decline to NRFS pathway",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 7: fertility decline to NRFS.",
    facts: [{ label: "Fertility", valueText: "Referenced" }],
    expected: {
      priority: "DECLINE",
      category: "Fertility referral",
      matchedRuleCode: "GYN-010",
    },
  },
  {
    id: "gyn-tubal-ligation-routine",
    title: "Tubal ligation counselling is routine P3",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 7: T/L counselling P3.",
    facts: [{ label: "Tubal ligation", valueText: "Requested" }],
    expected: {
      priority: "P3",
      category: "Tubal ligation counselling",
      matchedRuleCode: "GYN-011",
    },
  },
  {
    id: "gyn-routine-pelvic-pain",
    title: "Routine pelvic pain remains P3 absent higher-risk features",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 5: general pelvic pain can be P3.",
    facts: [
      { label: "Pelvic pain", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "P3",
      category: "Routine gynaecology referral",
      matchedRuleCode: "GYN-012",
    },
  },
  {
    id: "gyn-aub-no-ultrasound",
    title: "AUB without ultrasound is rejected",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 2: AUB with no pelvic USS within 12 months -> reject and request scan.",
    facts: [{ label: "Abnormal uterine bleeding", valueText: "Present" }],
    expected: {
      priority: "REJECT",
      category: "Abnormal uterine bleeding",
      matchedRuleCode: "GYN-013",
    },
  },
  {
    id: "gyn-aub-thick-endometrium",
    title: "AUB with ET >= 15 mm becomes P2",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 2: AUB with ET > 15 mm -> P2 menorrhagia.",
    facts: [
      { label: "Abnormal uterine bleeding", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
      { label: "Endometrial thickness", valueText: "16 mm", valueNumber: 16 },
    ],
    expected: {
      priority: "P2",
      category: "Menorrhagia",
      matchedRuleCode: "GYN-014",
    },
  },
  {
    id: "gyn-aub-persistent-after-medical-management",
    title: "Persistent treated AUB with ET under 15 mm stays P3",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 2: persistent bleeding >3/12 after medical management -> P3 menorrhagia.",
    facts: [
      { label: "Abnormal uterine bleeding", valueText: "Present" },
      { label: "Persistent bleeding >3 months", valueText: "Present" },
      { label: "Medical management trialled", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
      { label: "Endometrial thickness", valueText: "10 mm", valueNumber: 10 },
    ],
    expected: {
      priority: "P3",
      category: "Menorrhagia",
      matchedRuleCode: "GYN-015",
    },
  },
  {
    id: "gyn-procidentia",
    title: "Procidentia becomes P2 urogynaecology",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 6: procidentia -> P2 urogynae.",
    facts: [{ label: "Procidentia", valueText: "Present" }],
    expected: {
      priority: "P2",
      category: "Urogynaecology procidentia",
      matchedRuleCode: "GYN-016",
    },
  },
  {
    id: "gyn-recurrent-urogynae-symptoms",
    title: "Recurrent urogynae symptoms become P2",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 6: recurrent symptoms -> P2 urogynae.",
    facts: [
      { label: "Urogynaecology", valueText: "Referenced" },
      { label: "Recurrent symptoms", valueText: "Present" },
    ],
    expected: {
      priority: "P2",
      category: "Urogynaecology recurrent symptoms",
      matchedRuleCode: "GYN-017",
    },
  },
  {
    id: "gyn-mesh-related-problem",
    title: "Mesh related problem becomes P2",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 6: mesh related problems -> P2 urogynae.",
    facts: [{ label: "Mesh related problem", valueText: "Present" }],
    expected: {
      priority: "P2",
      category: "Urogynaecology mesh-related problem",
      matchedRuleCode: "GYN-018",
    },
  },
  {
    id: "gyn-asymptomatic-prolapse",
    title: "Asymptomatic prolapse is rejected",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 6: asymptomatic prolapse -> reject.",
    facts: [{ label: "Asymptomatic prolapse", valueText: "Present" }],
    expected: {
      priority: "REJECT",
      category: "Asymptomatic prolapse",
      matchedRuleCode: "GYN-019",
    },
  },
  {
    id: "gyn-cervical-polyp-small-asymptomatic",
    title: "Small asymptomatic cervical polyp is rejected",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 7: asymptomatic cervical polyp <= 2 cm with normal smear -> reject.",
    facts: [
      { label: "Cervical polyp", valueText: "Referenced" },
      { label: "Normal smear", valueText: "Present" },
      { label: "Cervical polyp size", valueText: "1.5 cm", valueNumber: 1.5 },
    ],
    expected: {
      priority: "REJECT",
      category: "Cervical polyp",
      matchedRuleCode: "GYN-020",
    },
  },
  {
    id: "gyn-cervical-polyp-symptomatic",
    title: "Larger symptomatic cervical polyp stays P3",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology grading guideline page 7: cervical polyp >= 2 cm with symptoms -> P3 gynaecology.",
    facts: [
      { label: "Cervical polyp", valueText: "Referenced" },
      { label: "Normal smear", valueText: "Present" },
      { label: "Post-coital bleeding", valueText: "Present" },
      { label: "Cervical polyp size", valueText: "3 cm", valueNumber: 3 },
    ],
    expected: {
      priority: "P3",
      category: "Cervical polyp",
      matchedRuleCode: "GYN-021",
    },
  },

  // ─── New colposcopy fixtures ───────────────────────────────────────────────
  {
    id: "colpo-hpv-not-detected-cancer-suspicion",
    title: "HPV not detected but cancer suspicion cytology goes urgent",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 5: Other reasons — HPV not detected with cancer suspicion → 10 days.",
    facts: [
      { label: "HPV Not Detected", valueText: "Confirmed" },
      { label: "Cancer suspicion cytology", valueText: "Reported" },
    ],
    expected: {
      priority: "P1_HSC",
      category: "Other reasons — urgent",
      matchedRuleCode: "COL-030",
    },
  },
  {
    id: "colpo-hpv-not-detected-high-grade",
    title: "HPV not detected with HSIL cytology escalates to 30 days",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 5: HPV not detected with ASC-H/HSIL/AIS/glandular → 30 days.",
    facts: [
      { label: "HPV Not Detected", valueText: "Confirmed" },
      { label: "HSIL", valueText: "Detected" },
    ],
    expected: {
      priority: "P2",
      category: "Other reasons — high priority",
      matchedRuleCode: "COL-031",
    },
  },
  {
    id: "colpo-immune-deficient-no-cytology-3m",
    title: "HPV Other immune deficient with no cytology routes to 3 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 3: Immune deficient no cytology → 3 months.",
    facts: [
      { label: "HPV Other", valueText: "Positive" },
      { label: "Immune deficient", valueText: "Present" },
    ],
    expected: {
      priority: "P3",
      category: "Immune-deficient HPV Other — 3 months",
      matchedRuleCode: "COL-027",
    },
  },
  {
    id: "colpo-immune-deficient-normal-cytology-6m",
    title: "HPV Other immune deficient with normal cytology routes to 6 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 3: Immune deficient with cytology normal/ASC-US/LSIL → 6 months.",
    facts: [
      { label: "HPV Other", valueText: "Positive" },
      { label: "Immune deficient", valueText: "Present" },
      { label: "Normal cytology", valueText: "Reported" },
    ],
    expected: {
      priority: "P3",
      category: "Immune-deficient HPV Other — 6 months",
      matchedRuleCode: "COL-028",
    },
  },
  {
    id: "colpo-toc-hpv-low-risk-3m",
    title: "TOC re-referral with HPV detected and no high-grade cytology routes to 3 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 6: TOC + HPV 16/18 or Other + no cytology → 3 months.",
    facts: [
      { label: "Positive test of cure", valueText: "Confirmed" },
      { label: "HPV 16/18", valueText: "Positive" },
    ],
    expected: {
      priority: "P3",
      category: "Positive test-of-cure re-referral — routine",
      matchedRuleCode: "COL-032",
    },
  },
  {
    id: "colpo-toc-hpv-not-detected-ascus-6m",
    title: "TOC re-referral with HPV not detected and ASCUS routes to 6 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 6: TOC HPV not detected + ASCUS/LSIL x2 → 6 months.",
    facts: [
      { label: "Positive test of cure", valueText: "Confirmed" },
      { label: "HPV Not Detected", valueText: "Confirmed" },
      { label: "ASC-US", valueText: "Reported" },
    ],
    expected: {
      priority: "P3",
      category: "Positive test-of-cure re-referral — extended",
      matchedRuleCode: "COL-033",
    },
  },
  {
    id: "colpo-third-hpv-other-6m",
    title: "Third HPV Other result routes to 6 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 2: Third HPV Other with normal/low-grade cytology < 50 → 6 months.",
    facts: [
      { label: "HPV Other", valueText: "Positive" },
      { label: "Third HPV positive result", valueText: "Confirmed" },
    ],
    expected: {
      priority: "P3",
      category: "Routine HPV Other colposcopy — extended",
      matchedRuleCode: "COL-034",
    },
  },
  {
    id: "colpo-prev-lsil-hpv1618-no-cytology-3m",
    title: "Previous LSIL histology with HPV 16/18 and no cytology routes to 3 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 8: Previous LSIL histology + HPV 16/18 + no cytology → 3 months.",
    facts: [
      { label: "Previous LSIL histology", valueText: "Confirmed" },
      { label: "HPV 16/18", valueText: "Positive" },
    ],
    expected: {
      priority: "P3",
      category: "Previous LSIL histology re-referral — 3 months",
      matchedRuleCode: "COL-040",
    },
  },
  {
    id: "colpo-prev-normal-colp-hpv1618-6m",
    title: "Previous normal colp re-referral with HPV 16/18 and no cytology routes to 6 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 7: Previous normal colp + HPV 16/18 + no cytology → 6 months.",
    facts: [
      { label: "Previous normal colposcopy", valueText: "Confirmed" },
      { label: "HPV 16/18", valueText: "Positive" },
    ],
    expected: {
      priority: "P3",
      category: "Previous normal colposcopy re-referral — 6 months",
      matchedRuleCode: "COL-035",
    },
  },
  {
    id: "colpo-prev-lsil-hpv-other-repeat-ascus-6m",
    title: "Previous LSIL histology with HPV Other and repeat ASCUS routes to 6 months",
    serviceLine: "COLPOSCOPY",
    sourceNote: "Triage guide section 8: Previous LSIL histology + HPV Other + ASCUS/LSIL x2 → 6 months.",
    facts: [
      { label: "Previous LSIL histology", valueText: "Confirmed" },
      { label: "HPV Other", valueText: "Positive" },
      { label: "Repeat ASCUS/LSIL", valueText: "Confirmed" },
    ],
    expected: {
      priority: "P3",
      category: "Previous LSIL histology re-referral — 6 months",
      matchedRuleCode: "COL-043",
    },
  },

  // ─── New gynaecology fixtures ──────────────────────────────────────────────
  {
    id: "gyn-pmb-single-episode-low-et",
    title: "Single episode PMB with ET below 5mm routes to routine review",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "PMB guideline: single episode PMB with ET < 5mm → P3 watchful waiting.",
    facts: [
      { label: "Postmenopausal bleeding", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
      { label: "Endometrial thickness", valueText: "3 mm", valueNumber: 3 },
    ],
    expected: {
      priority: "P3",
      category: "Postmenopausal bleeding",
      matchedRuleCode: "GYN-034",
    },
  },
  {
    id: "gyn-tvt-complication",
    title: "TVT complication escalates to P2 urogynaecology",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology guideline: TVT/sling complications → P2 urogynaecology.",
    facts: [{ label: "TVT complication", valueText: "Present" }],
    expected: {
      priority: "P2",
      category: "Urogynaecology TVT/sling complication",
      matchedRuleCode: "GYN-035",
    },
  },
  {
    id: "gyn-intermenstrual-bleeding-routine",
    title: "Intermenstrual bleeding with reassuring USS stays P3",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology guideline: IMB with reassuring investigations → P3.",
    facts: [
      { label: "Intermenstrual bleeding", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "P3",
      category: "Intermenstrual bleeding",
      matchedRuleCode: "GYN-036",
    },
  },
  {
    id: "gyn-aub-normal-uss-no-management",
    title: "AUB with normal USS and no prior management is returned to GP",
    serviceLine: "GYNAECOLOGY",
    sourceNote: "Gynaecology guideline: AUB with normal USS, no prior medical management → return to GP.",
    facts: [
      { label: "Abnormal uterine bleeding", valueText: "Present" },
      { label: "Ultrasound scan", valueText: "Available" },
    ],
    expected: {
      priority: "REJECT",
      category: "Abnormal uterine bleeding",
      matchedRuleCode: "GYN-037",
    },
  },
];

export function getCaseRuleFixturesForService(serviceLine: ServiceLine) {
  return CASE_RULE_FIXTURES.filter((fixture) => fixture.serviceLine === serviceLine);
}
