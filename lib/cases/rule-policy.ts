import type { ServiceLine, TriagePriority } from "@prisma/client";

type RuleRecommendation = {
  priority: TriagePriority;
  category: string;
  outcome: string;
  rationale: string;
  requiresSmoReview?: boolean;
  /** Precise target days override — takes precedence over priority-based SLA when set */
  targetDays?: number;
};

type RuleDefinitionCaseFlag = {
  code: string;
  title: string;
  impact: string;
  kind: "case_flag";
  flagName: "highSuspicionCancer";
  flagLabel: string;
  recommendation: RuleRecommendation;
};

type RuleDefinitionFactAny = {
  code: string;
  title: string;
  impact: string;
  kind: "fact_any";
  factLabels: string[];
  recommendation: RuleRecommendation;
};

type RuleDefinitionFactAll = {
  code: string;
  title: string;
  impact: string;
  kind: "fact_all";
  factLabels: string[];
  recommendation: RuleRecommendation;
};

type RuleDefinitionCompound = {
  code: string;
  title: string;
  impact: string;
  kind: "compound";
  allFactLabels?: string[];
  anyFactLabels?: string[];
  absentFactLabels?: string[];
  thresholdLabel?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  recommendation: RuleRecommendation;
};

type RuleDefinitionFactThreshold = {
  code: string;
  title: string;
  impact: string;
  kind: "fact_threshold";
  signalLabels: string[];
  thresholdLabel: string;
  thresholdMin: number;
  recommendation: RuleRecommendation;
};

export type CaseRuleDefinition =
  | RuleDefinitionCaseFlag
  | RuleDefinitionFactAny
  | RuleDefinitionFactAll
  | RuleDefinitionCompound
  | RuleDefinitionFactThreshold;

export type CaseRuleReleaseDefinition = {
  releaseKind: "coded-enterprise-v2";
  serviceLine: ServiceLine;
  sourceOfTruth: string[];
  notes: string[];
  defaultRecommendation: RuleRecommendation;
  rules: CaseRuleDefinition[];
};

const BASELINE_CASE_RULE_DEFINITIONS: Record<ServiceLine, CaseRuleReleaseDefinition> = {
  COLPOSCOPY: {
    releaseKind: "coded-enterprise-v2",
    serviceLine: "COLPOSCOPY",
    sourceOfTruth: [
      "COLP Grading Guide — Health NZ Counties Manukau",
      "Colposcopy Referral Triage booking priorities",
    ],
    notes: [
      "Implements all 34 clinical scenarios from the Colposcopy Referral Triage booking-priority guide plus supplementary pathway rules.",
      "targetDays on recommendations gives precise timeframe routing: 10, 30, 90, or 180 days.",
      "Rules are evaluated in order; first match wins. Higher-urgency rules are listed first.",
      "COL-027/028: Immune-deficient HPV Other refinements (3m/6m) must appear before COL-017 (30d fallback).",
      "COL-032/033: TOC 3m/6m rules must appear before COL-002 (30d fallback) so low-risk TOC is not over-escalated.",
      "Ambiguous 'Other clinical assessment' rows (30d/3m) from the source guide are unresolved pending clinical confirmation — COL-026 defaults to 6 months.",
      "Repeat-count rules (Third HPV, Repeat ASCUS/LSIL, Repeat no cytology) require the fact-extraction layer to detect and emit these labels from referral letters.",
    ],
    defaultRecommendation: {
      priority: "INFO_REQUIRED",
      category: "Insufficient evidence",
      outcome: "Request more information before final grading",
      rationale:
        "No HPV, cytology, or histology evidence was strong enough to assign a deterministic colposcopy priority.",
    },
    rules: [
      // ─── Tier 1: Urgent 10-day rules ──────────────────────────────────────
      {
        code: "COL-001",
        title: "High suspicion cancer (case flag)",
        impact: "Escalate immediately to urgent 10-day colposcopy pathway",
        kind: "case_flag",
        flagName: "highSuspicionCancer",
        flagLabel: "Case flag: high suspicion cancer",
        recommendation: {
          priority: "P1_HSC",
          category: "High suspicion cancer",
          outcome: "Urgent colposcopy senior review within 10 days",
          rationale: "The case is flagged as high suspicion cancer and requires urgent senior review.",
          targetDays: 10,
        },
      },
      {
        code: "COL-008",
        title: "HPV 16/18 primary screening with cancer suspicion cytology",
        impact: "Route to 10-day urgent pathway — primary screening",
        kind: "fact_all",
        factLabels: ["HPV 16/18", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "HPV 16/18 primary screening — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "HPV 16/18 detected on primary screening with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-009",
        title: "HPV Other primary screening with cancer suspicion cytology",
        impact: "Route to 10-day urgent pathway — primary screening HPV Other",
        kind: "fact_all",
        factLabels: ["HPV Other", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "HPV Other primary screening — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "HPV Other detected on primary screening with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-010",
        title: "Abnormal cervical appearance with cancer suspicion",
        impact: "Triage referral — 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["Abnormal appearance", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "Abnormal cervical appearance — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "Abnormal cervical appearance with clinical suspicion or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-011",
        title: "Post-treatment HPV 16/18 with cancer suspicion",
        impact: "Post-treatment assessment — 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["Post-treatment assessment", "HPV 16/18", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "Post-treatment assessment — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "Post-treatment assessment: HPV 16/18 with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-012",
        title: "Post-treatment HPV Other with cancer suspicion",
        impact: "Post-treatment assessment HPV Other — 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["Post-treatment assessment", "HPV Other", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "Post-treatment assessment — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "Post-treatment assessment: HPV Other with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-013",
        title: "HPV surveillance 16/18 with cancer suspicion",
        impact: "HPV surveillance — 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["HPV surveillance", "HPV 16/18", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "HPV surveillance — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "HPV 16/18 surveillance with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-014",
        title: "HPV Other surveillance with cancer suspicion",
        impact: "HPV Other surveillance — 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["HPV surveillance", "HPV Other", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "HPV Other surveillance — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale: "HPV Other surveillance with cytology reporting suspicious or definite cancer.",
          targetDays: 10,
        },
      },
      {
        code: "COL-030",
        title: "HPV not detected with cancer suspicion — symptomatic pathway",
        impact: "Route HPV-not-detected cancer-suspicion referrals to 10-day urgent pathway",
        kind: "fact_all",
        factLabels: ["HPV Not Detected", "Cancer suspicion cytology"],
        recommendation: {
          priority: "P1_HSC",
          category: "Other reasons — urgent",
          outcome: "Urgent colposcopy within 10 days",
          rationale:
            "Symptomatic referral: HPV not detected but cytology reports suspicion or definite cancer.",
          targetDays: 10,
        },
      },

      // ─── Tier 2: 30-day high-priority rules ───────────────────────────────
      {
        code: "COL-032",
        title: "Positive test of cure — HPV detected, low-grade or no cytology",
        impact: "Route TOC re-referral with HPV detected but no high-grade cytology to 3-month pathway",
        kind: "compound",
        allFactLabels: ["Positive test of cure"],
        anyFactLabels: ["HPV 16/18", "HPV Other"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Positive test-of-cure re-referral — routine",
          outcome: "Routine colposcopy within 3 months",
          rationale:
            "Positive test-of-cure re-referral with HPV detected but without high-grade cytology follows the 3-month pathway.",
          targetDays: 90,
        },
      },
      {
        code: "COL-033",
        title: "Positive test of cure — HPV not detected, persistent low-grade cytology",
        impact: "Route TOC HPV-not-detected with repeat low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Positive test of cure", "HPV Not Detected"],
        anyFactLabels: ["ASC-US", "LSIL", "Repeat ASCUS/LSIL"],
        recommendation: {
          priority: "P3",
          category: "Positive test-of-cure re-referral — extended",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Positive test-of-cure with HPV not detected and persistent ASCUS/LSIL (x2) follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-002",
        title: "Positive test of cure re-referral",
        impact: "Escalate positive TOC referrals to 30-day pathway",
        kind: "fact_any",
        factLabels: ["Positive test of cure"],
        recommendation: {
          priority: "P2",
          category: "Positive test-of-cure referral",
          outcome: "High-priority colposcopy review within 30 days",
          rationale: "Positive test-of-cure re-referral detected in the referral evidence.",
          targetDays: 30,
        },
      },
      {
        code: "COL-003",
        title: "High-grade cytology or histology (HSIL, ASC-H, CIN2, CIN3)",
        impact: "Escalate to 30-day high-priority colposcopy review",
        kind: "fact_any",
        factLabels: ["HSIL", "ASC-H", "CIN3", "CIN2"],
        recommendation: {
          priority: "P2",
          category: "High-grade colposcopy referral",
          outcome: "High-priority colposcopy review within 30 days",
          rationale: "High-grade cervical findings (HSIL/ASC-H/CIN2/CIN3) extracted from referral evidence.",
          targetDays: 30,
        },
      },
      {
        code: "COL-015",
        title: "HPV 16/18 primary screening — abnormal cytology (non-cancer)",
        impact: "Route HPV 16/18 with abnormal cytology to 30-day pathway",
        kind: "compound",
        allFactLabels: ["HPV 16/18"],
        anyFactLabels: ["ASC-US", "LSIL", "Borderline cytology"],
        recommendation: {
          priority: "P2",
          category: "HPV 16/18 primary screening — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV 16/18 detected with abnormal cytology (ASC-US, LSIL, or borderline).",
          targetDays: 30,
        },
      },
      {
        code: "COL-016",
        title: "HPV Other primary screening — high-grade or glandular cytology",
        impact: "Route HPV Other with high-grade/glandular cytology to 30-day pathway",
        kind: "compound",
        allFactLabels: ["HPV Other"],
        anyFactLabels: ["ASC-H", "HSIL", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "HPV Other primary screening — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV Other detected with high-grade or glandular cytology abnormality.",
          targetDays: 30,
        },
      },
      {
        code: "COL-004",
        title: "HPV 16/18 positive (any cytology, no higher rule matched)",
        impact: "Escalate remaining HPV 16/18 referrals to 30-day pathway",
        kind: "fact_any",
        factLabels: ["HPV 16/18"],
        recommendation: {
          priority: "P2",
          category: "HPV 16/18 positive referral",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV 16/18 positivity detected; no higher-urgency rule applied.",
          targetDays: 30,
        },
      },
      {
        code: "COL-027",
        title: "HPV Other immune deficient — no cytology",
        impact: "Route immune-deficient HPV Other with no cytology to 3-month direct-referral pathway",
        kind: "compound",
        allFactLabels: ["HPV Other", "Immune deficient"],
        absentFactLabels: [
          "Cancer suspicion cytology",
          "HSIL",
          "ASC-H",
          "Glandular abnormality",
          "ASC-US",
          "LSIL",
          "Normal cytology",
        ],
        recommendation: {
          priority: "P3",
          category: "Immune-deficient HPV Other — 3 months",
          outcome: "Colposcopy within 3 months",
          rationale:
            "Immune-deficient patient with HPV Other detected and no cytology result follows the 3-month direct-referral pathway.",
          targetDays: 90,
        },
      },
      {
        code: "COL-028",
        title: "HPV Other immune deficient — normal or low-grade cytology",
        impact: "Route immune-deficient HPV Other with normal/low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["HPV Other", "Immune deficient"],
        anyFactLabels: ["Normal cytology", "ASC-US", "LSIL"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Immune-deficient HPV Other — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Immune-deficient patient with HPV Other detected and normal or low-grade cytology follows the 6-month direct-referral pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-017",
        title: "HPV Other with immune deficiency",
        impact: "Escalate HPV-other immune-deficient referrals to 30-day pathway",
        kind: "fact_all",
        factLabels: ["HPV Other", "Immune deficient"],
        recommendation: {
          priority: "P2",
          category: "Higher-risk HPV Other referral",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV Other positivity paired with immune deficiency raises booking urgency.",
          targetDays: 30,
        },
      },
      {
        code: "COL-006",
        title: "Abnormal cervical appearance — borderline/normal cytology",
        impact: "Route abnormal-appearance referrals to 30-day pathway",
        kind: "fact_any",
        factLabels: ["Abnormal appearance"],
        recommendation: {
          priority: "P2",
          category: "Abnormal appearance referral",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "Abnormal cervical appearance detected without cancer-suspicion cytology.",
          targetDays: 30,
        },
      },
      {
        code: "COL-018",
        title: "Post-treatment HPV 16/18 — abnormal cytology (non-cancer)",
        impact: "Post-treatment assessment — 30-day pathway",
        kind: "compound",
        allFactLabels: ["Post-treatment assessment", "HPV 16/18"],
        anyFactLabels: ["ASC-US", "LSIL", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "Post-treatment assessment — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "Post-treatment: HPV 16/18 with abnormal cytology (ASC-US, LSIL, HSIL, ASC-H, or glandular).",
          targetDays: 30,
        },
      },
      {
        code: "COL-019",
        title: "Post-treatment HPV Other — abnormal cytology",
        impact: "Post-treatment assessment HPV Other — 30-day pathway",
        kind: "compound",
        allFactLabels: ["Post-treatment assessment", "HPV Other"],
        anyFactLabels: ["ASC-US", "LSIL", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "Post-treatment assessment — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "Post-treatment: HPV Other with abnormal cytology.",
          targetDays: 30,
        },
      },
      {
        code: "COL-020",
        title: "HPV surveillance 16/18 — abnormal cytology",
        impact: "HPV surveillance — 30-day pathway",
        kind: "compound",
        allFactLabels: ["HPV surveillance", "HPV 16/18"],
        anyFactLabels: ["ASC-US", "LSIL", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "HPV surveillance — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV 16/18 surveillance with abnormal cytology.",
          targetDays: 30,
        },
      },
      {
        code: "COL-021",
        title: "HPV Other surveillance — abnormal cytology",
        impact: "HPV Other surveillance — 30-day pathway",
        kind: "compound",
        allFactLabels: ["HPV surveillance", "HPV Other"],
        anyFactLabels: ["ASC-H", "HSIL", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "HPV Other surveillance — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale: "HPV Other surveillance with high-grade or glandular cytology.",
          targetDays: 30,
        },
      },
      {
        code: "COL-031",
        title: "HPV not detected with high-grade or glandular cytology — symptomatic",
        impact: "Route HPV-not-detected high-grade cytology referrals to 30-day pathway",
        kind: "compound",
        allFactLabels: ["HPV Not Detected"],
        anyFactLabels: ["ASC-H", "HSIL", "Glandular abnormality"],
        recommendation: {
          priority: "P2",
          category: "Other reasons — high priority",
          outcome: "High-priority colposcopy within 30 days",
          rationale:
            "Symptomatic referral with HPV not detected but high-grade or glandular cytology requires prompt colposcopy review.",
          targetDays: 30,
        },
      },

      // ─── Tier 3: 3-month routine rules ────────────────────────────────────
      {
        code: "COL-005",
        title: "Second HPV Other — no cytology or normal/low-grade",
        impact: "Route second HPV Other to 3-month routine pathway",
        kind: "fact_all",
        factLabels: ["HPV Other", "Second HPV positive result"],
        recommendation: {
          priority: "P3",
          category: "Routine HPV Other colposcopy",
          outcome: "Routine colposcopy within 3 months",
          rationale: "Second HPV Other result with normal or low-grade cytology.",
          targetDays: 90,
        },
      },
      {
        code: "COL-022",
        title: "Endorsed referred on colposcopy",
        impact: "Route endorsed referrals to 3-month routine pathway",
        kind: "fact_any",
        factLabels: ["Endorsed referral on colposcopy"],
        recommendation: {
          priority: "P3",
          category: "Endorsed colposcopy referral",
          outcome: "Routine colposcopy within 3 months",
          rationale: "Referral is endorsed from prior colposcopy assessment.",
          targetDays: 90,
        },
      },
      {
        code: "COL-023",
        title: "Post-treatment HPV 16/18 — normal or low-grade cytology",
        impact: "Post-treatment clear — 3-month routine pathway",
        kind: "compound",
        allFactLabels: ["Post-treatment assessment", "HPV 16/18"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Post-treatment assessment — routine",
          outcome: "Routine colposcopy within 3 months",
          rationale: "Post-treatment: HPV 16/18 with normal or low-grade cytology.",
          targetDays: 90,
        },
      },
      {
        code: "COL-024",
        title: "HPV surveillance — normal or low-grade cytology",
        impact: "Surveillance — 3-month routine pathway",
        kind: "compound",
        allFactLabels: ["HPV surveillance"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "HPV surveillance — routine",
          outcome: "Routine colposcopy within 3 months",
          rationale: "HPV surveillance with normal or low-grade cytology.",
          targetDays: 90,
        },
      },
      {
        code: "COL-007",
        title: "Routine low-grade colposcopy trigger (HPV Other, LSIL)",
        impact: "Use 3-month routine priority if no higher rule matched",
        kind: "fact_any",
        factLabels: ["LSIL", "HPV Other"],
        recommendation: {
          priority: "P3",
          category: "Routine colposcopy referral",
          outcome: "Routine colposcopy within 3 months",
          rationale: "Low-grade cervical findings extracted without a matched urgent escalation rule.",
          targetDays: 90,
        },
      },
      {
        code: "COL-034",
        title: "Third HPV Other — normal or low-grade cytology",
        impact: "Route third consecutive HPV Other result to 6-month pathway",
        kind: "fact_all",
        factLabels: ["HPV Other", "Third HPV positive result"],
        recommendation: {
          priority: "P3",
          category: "Routine HPV Other colposcopy — extended",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Third consecutive HPV Other result with normal or low-grade cytology follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-040",
        title: "Previous LSIL histology re-referral — HPV 16/18, no cytology",
        impact: "Route previous LSIL histology re-referral with HPV 16/18 and no cytology to 3-month pathway",
        kind: "compound",
        allFactLabels: ["Previous LSIL histology", "HPV 16/18"],
        absentFactLabels: [
          "Cancer suspicion cytology",
          "HSIL",
          "ASC-H",
          "Glandular abnormality",
          "ASC-US",
          "LSIL",
          "Normal cytology",
        ],
        recommendation: {
          priority: "P3",
          category: "Previous LSIL histology re-referral — 3 months",
          outcome: "Routine colposcopy within 3 months",
          rationale:
            "Re-referral following previous LSIL histology: HPV 16/18 detected with no cytology result follows the 3-month pathway.",
          targetDays: 90,
        },
      },

      // ─── Tier 4: 6-month pathway ───────────────────────────────────────────
      {
        code: "COL-025",
        title: "HPV Other surveillance — low-grade or normal cytology (long-cycle)",
        impact: "Route HPV Other surveillance to 6-month pathway",
        kind: "compound",
        allFactLabels: ["HPV surveillance", "HPV Other"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "HPV Other surveillance — extended",
          outcome: "Colposcopy within 6 months",
          rationale: "HPV Other surveillance with low-grade or normal cytology follows a 6-month pathway.",
          targetDays: 180,
        },
      },
      // ─── Previous normal colposcopy re-referral pathways (6 months) ─────────
      {
        code: "COL-035",
        title: "Previous normal colposcopy re-referral — HPV 16/18, no cytology",
        impact: "Route previous normal colp re-referral with HPV 16/18 and no cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous normal colposcopy", "HPV 16/18"],
        absentFactLabels: [
          "Cancer suspicion cytology",
          "HSIL",
          "ASC-H",
          "Glandular abnormality",
          "ASC-US",
          "LSIL",
          "Normal cytology",
        ],
        recommendation: {
          priority: "P3",
          category: "Previous normal colposcopy re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous normal colposcopy: HPV 16/18 detected with no cytology result follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-036",
        title: "Previous normal colposcopy re-referral — HPV 16/18, normal or low-grade cytology",
        impact: "Route previous normal colp re-referral with HPV 16/18 and normal/low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous normal colposcopy", "HPV 16/18"],
        anyFactLabels: ["Normal cytology", "ASC-US", "LSIL"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Previous normal colposcopy re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous normal colposcopy: HPV 16/18 detected with normal or low-grade cytology follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-037",
        title: "Previous normal colposcopy re-referral — immune-deficient HPV Other",
        impact: "Route immune-deficient HPV Other previous normal colp re-referral to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous normal colposcopy", "HPV Other", "Immune deficient"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Previous normal colposcopy re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous normal colposcopy: immune-deficient patient with HPV Other detected follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-038",
        title: "Previous normal colposcopy re-referral — HPV Other, repeat normal or low-grade cytology",
        impact: "Route previous normal colp HPV Other repeat low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous normal colposcopy", "HPV Other"],
        anyFactLabels: ["Normal cytology", "ASC-US", "LSIL", "Repeat ASCUS/LSIL"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality", "Immune deficient"],
        recommendation: {
          priority: "P3",
          category: "Previous normal colposcopy re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous normal colposcopy: HPV Other with repeat normal or low-grade cytology (x2) follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-039",
        title: "Previous normal colposcopy re-referral — HPV Other, repeat no cytology",
        impact: "Route previous normal colp HPV Other with no cytology x2 to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous normal colposcopy", "HPV Other"],
        anyFactLabels: ["Repeat no cytology"],
        absentFactLabels: [
          "Cancer suspicion cytology",
          "HSIL",
          "ASC-H",
          "Glandular abnormality",
          "Normal cytology",
          "ASC-US",
          "LSIL",
          "Immune deficient",
        ],
        recommendation: {
          priority: "P3",
          category: "Previous normal colposcopy re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous normal colposcopy: HPV Other with no cytology result on second occasion follows the 6-month pathway.",
          targetDays: 180,
        },
      },

      // ─── Previous LSIL histology re-referral pathways (6 months) ─────────
      {
        code: "COL-041",
        title: "Previous LSIL histology re-referral — HPV 16/18, normal or low-grade cytology",
        impact: "Route previous LSIL histology re-referral with HPV 16/18 and normal/low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous LSIL histology", "HPV 16/18"],
        anyFactLabels: ["Normal cytology", "ASC-US", "LSIL"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Previous LSIL histology re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous LSIL histology: HPV 16/18 detected with normal or low-grade cytology follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-042",
        title: "Previous LSIL histology re-referral — immune-deficient HPV Other",
        impact: "Route immune-deficient HPV Other previous LSIL histology re-referral to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous LSIL histology", "HPV Other", "Immune deficient"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality"],
        recommendation: {
          priority: "P3",
          category: "Previous LSIL histology re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous LSIL histology: immune-deficient patient with HPV Other detected follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-043",
        title: "Previous LSIL histology re-referral — HPV Other, repeat normal or low-grade cytology",
        impact: "Route previous LSIL histology HPV Other repeat low-grade cytology to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous LSIL histology", "HPV Other"],
        anyFactLabels: ["Normal cytology", "ASC-US", "LSIL", "Repeat ASCUS/LSIL"],
        absentFactLabels: ["Cancer suspicion cytology", "HSIL", "ASC-H", "Glandular abnormality", "Immune deficient"],
        recommendation: {
          priority: "P3",
          category: "Previous LSIL histology re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous LSIL histology: HPV Other with repeat normal or low-grade cytology (x2) follows the 6-month pathway.",
          targetDays: 180,
        },
      },
      {
        code: "COL-044",
        title: "Previous LSIL histology re-referral — HPV Other, repeat no cytology",
        impact: "Route previous LSIL histology HPV Other with no cytology x2 to 6-month pathway",
        kind: "compound",
        allFactLabels: ["Previous LSIL histology", "HPV Other"],
        anyFactLabels: ["Repeat no cytology"],
        absentFactLabels: [
          "Cancer suspicion cytology",
          "HSIL",
          "ASC-H",
          "Glandular abnormality",
          "Normal cytology",
          "ASC-US",
          "LSIL",
          "Immune deficient",
        ],
        recommendation: {
          priority: "P3",
          category: "Previous LSIL histology re-referral — 6 months",
          outcome: "Colposcopy within 6 months",
          rationale:
            "Re-referral following previous LSIL histology: HPV Other with no cytology result on second occasion follows the 6-month pathway.",
          targetDays: 180,
        },
      },

      {
        code: "COL-026",
        title: "Other clinical assessment",
        impact: "Route other clinical assessments to 6-month pathway",
        kind: "fact_any",
        factLabels: ["Other clinical assessment"],
        recommendation: {
          priority: "P3",
          category: "Other clinical assessment",
          outcome: "Colposcopy within 6 months",
          rationale: "Other clinical assessment reasons follow the 6-month booking pathway.",
          targetDays: 180,
        },
      },
    ],
  },
  GYNAECOLOGY: {
    releaseKind: "coded-enterprise-v2",
    serviceLine: "GYNAECOLOGY",
    sourceOfTruth: [
      "Attached gynaecology grading guideline",
    ],
    notes: [
      "Implements 38 gynaecology grading rules across AUB, PMB, fibroids, ovarian masses, pelvic pain, urogynaecology, fertility, PCOS, cervical polyp, paediatric, and obstetric tear categories.",
      "Thresholds and labels are release-backed rather than hard-coded in the evaluator.",
      "GYN-034 through GYN-038 added to cover PMB single episode, TVT/sling complications, IMB, AUB return-to-GP, and re-grading scenarios.",
      "Rules are evaluated in order; first match wins. Reject/Decline rules are placed after specific escalation rules to avoid premature short-circuit.",
    ],
    defaultRecommendation: {
      priority: "INFO_REQUIRED",
      category: "Insufficient evidence",
      outcome: "Request more information before final grading",
      rationale:
        "The current evidence set does not support a deterministic priority recommendation yet.",
    },
    rules: [
      {
        code: "GYN-001",
        title: "High suspicion cancer",
        impact: "Escalate to urgent pathway",
        kind: "case_flag",
        flagName: "highSuspicionCancer",
        flagLabel: "Case flag: high suspicion cancer",
        recommendation: {
          priority: "P1_HSC",
          category: "High suspicion cancer",
          outcome: "Urgent gynaecology senior review",
          rationale:
            "The case is flagged as high suspicion cancer, which takes precedence over all other findings.",
          requiresSmoReview: true,
          targetDays: 14,
        },
      },
      {
        code: "GYN-002",
        title: "Postmenopausal bleeding without ultrasound",
        impact: "Reject until ultrasound evidence is available",
        kind: "compound",
        allFactLabels: ["Postmenopausal bleeding"],
        absentFactLabels: ["Ultrasound scan", "Endometrial thickness"],
        recommendation: {
          priority: "REJECT",
          category: "Postmenopausal bleeding",
          outcome: "Reject and ask GP to re-refer with ultrasound scan",
          rationale:
            "Postmenopausal bleeding cannot be graded safely without a recent ultrasound result.",
        },
      },
      {
        code: "GYN-003",
        title: "Postmenopausal bleeding with thickened endometrium",
        impact: "Elevate to high suspicion cancer pathway",
        kind: "fact_threshold",
        signalLabels: ["Postmenopausal bleeding"],
        thresholdLabel: "Endometrial thickness",
        thresholdMin: 5,
        recommendation: {
          priority: "P1_HSC",
          category: "Postmenopausal bleeding",
          outcome: "High suspicion cancer clinic / rapid access review",
          rationale:
            "Postmenopausal bleeding was detected with endometrial thickness at or above 5 mm.",
          targetDays: 14,
        },
      },
      {
        code: "GYN-004",
        title: "Recurrent postmenopausal bleeding despite low endometrial thickness",
        impact: "Escalate recurrent PMB to high suspicion cancer review even when ET remains below 5 mm",
        kind: "compound",
        allFactLabels: ["Postmenopausal bleeding", "Multiple PMB episodes"],
        thresholdLabel: "Endometrial thickness",
        thresholdMax: 4.9,
        recommendation: {
          priority: "P1_HSC",
          category: "Postmenopausal bleeding",
          outcome: "High suspicion cancer clinic / rapid access review",
          rationale:
            "Multiple episodes of postmenopausal bleeding still warrant high suspicion cancer review even when endometrial thickness is below 5 mm.",
          targetDays: 14,
        },
      },
      {
        code: "GYN-005",
        title: "Adnexal/ovarian concern with elevated CA-125",
        impact: "Escalate to HSC-monitored semi-urgent review",
        kind: "fact_threshold",
        signalLabels: ["Ovarian cyst", "Ovarian cyst size"],
        thresholdLabel: "CA-125",
        thresholdMin: 35,
        recommendation: {
          priority: "P2_HSC",
          category: "Concerning ovarian/adnexal mass",
          outcome: "SMO review with HSC-monitored semi-urgent pathway",
          rationale:
            "Ovarian/adnexal concern was detected alongside an elevated CA-125, which warrants closer HSC-tracked review.",
          requiresSmoReview: true,
          targetDays: 30,
        },
      },
      {
        code: "GYN-026",
        title: "Complex adnexal mass — SMO-only pathway",
        impact: "Escalate complex adnexal/suspicious masses to HSC-tracked P1 pathway with SMO grading",
        kind: "fact_any",
        factLabels: ["Complex adnexal mass", "Suspicious ovarian mass", "Adnexal mass with solid component"],
        recommendation: {
          priority: "P1_HSC",
          category: "Complex/suspicious adnexal mass",
          outcome: "SMO-only grading — CT + tumour markers, urgent gynaecology review",
          rationale:
            "Complex or suspicious adnexal masses require SMO-graded P1 assessment with CT imaging and tumour markers.",
          requiresSmoReview: true,
          targetDays: 14,
        },
      },
      {
        code: "GYN-006",
        title: "Pelvic pain without ultrasound",
        impact: "Reject until ultrasound evidence is available",
        kind: "compound",
        allFactLabels: ["Pelvic pain"],
        absentFactLabels: ["Ultrasound scan"],
        recommendation: {
          priority: "REJECT",
          category: "Pelvic pain",
          outcome: "Reject and ask GP to re-refer with ultrasound scan",
          rationale:
            "Pelvic pain referrals should include ultrasound evidence before specialist grading unless another specific pathway overrides it.",
        },
      },
      {
        code: "GYN-007",
        title: "Large fibroids with mass symptoms",
        impact: "Escalate symptomatic larger fibroids to semi-urgent review",
        kind: "compound",
        allFactLabels: ["Fibroids", "Mass symptoms"],
        thresholdLabel: "Fibroid size",
        thresholdMin: 3,
        recommendation: {
          priority: "P2",
          category: "Fibroids with mass symptoms",
          outcome: "Semi-urgent gynaecology review",
          rationale:
            "Fibroids measuring 3 cm or more with mass symptoms should be prioritised for earlier review.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-008",
        title: "Small fibroids with mass symptoms",
        impact: "Keep symptomatic small fibroids routine while prompting broader cause review",
        kind: "compound",
        allFactLabels: ["Fibroids", "Mass symptoms"],
        thresholdLabel: "Fibroid size",
        thresholdMax: 2.9,
        recommendation: {
          priority: "P3",
          category: "Fibroids with mass symptoms",
          outcome: "Routine gynaecology review with GP exploration of other causes",
          rationale:
            "Fibroids below 3 cm with mass symptoms remain routine and should prompt consideration of other causes as well.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-033",
        title: "Asymptomatic fibroids without AUB",
        impact: "Decline low-risk fibroid referrals to reduce unnecessary specialist load",
        kind: "compound",
        allFactLabels: ["Fibroids"],
        absentFactLabels: ["Mass symptoms", "Abnormal uterine bleeding"],
        thresholdLabel: "Fibroid size",
        thresholdMax: 2.9,
        recommendation: {
          priority: "DECLINE",
          category: "Fibroids — no follow-up indicated",
          outcome: "Decline referral — no follow-up scan required",
          rationale:
            "Asymptomatic fibroids under 3 cm without AUB or mass symptoms do not require specialist review under the guideline.",
        },
      },
      {
        code: "GYN-013",
        title: "Abnormal uterine bleeding without ultrasound",
        impact: "Reject until ultrasound evidence is available",
        kind: "compound",
        allFactLabels: ["Abnormal uterine bleeding"],
        absentFactLabels: ["Ultrasound scan", "Endometrial thickness"],
        recommendation: {
          priority: "REJECT",
          category: "Abnormal uterine bleeding",
          outcome: "Reject and ask GP to re-refer with pelvic ultrasound",
          rationale:
            "Abnormal uterine bleeding cannot be graded safely without current ultrasound information.",
        },
      },
      {
        code: "GYN-014",
        title: "Abnormal uterine bleeding with markedly thickened endometrium",
        impact: "Elevate heavy bleeding with ET >= 15 mm",
        kind: "compound",
        allFactLabels: ["Abnormal uterine bleeding", "Ultrasound scan"],
        thresholdLabel: "Endometrial thickness",
        thresholdMin: 15,
        recommendation: {
          priority: "P2",
          category: "Menorrhagia",
          outcome: "Semi-urgent gynaecology review — pipelle biopsy pathway",
          rationale:
            "Abnormal uterine bleeding with endometrial thickness at or above 15 mm warrants earlier specialist review.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-015",
        title: "Persistent abnormal uterine bleeding after medical management",
        impact: "Route persistent treated bleeding to routine hysteroscopy/menorrhagia review",
        kind: "compound",
        allFactLabels: [
          "Abnormal uterine bleeding",
          "Persistent bleeding >3 months",
          "Medical management trialled",
          "Ultrasound scan",
        ],
        thresholdLabel: "Endometrial thickness",
        thresholdMax: 14.9,
        recommendation: {
          priority: "P3",
          category: "Menorrhagia",
          outcome: "Routine gynaecology / hysteroscopy review",
          rationale:
            "Persistent bleeding beyond three months despite medical management remains a routine specialist pathway when the endometrium is not markedly thickened.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-022",
        title: "AUB with USS polyp finding",
        impact: "Route AUB with suspected polyp to routine hysteroscopy",
        kind: "compound",
        allFactLabels: ["Abnormal uterine bleeding", "Ultrasound scan", "Uterine polyp on USS"],
        recommendation: {
          priority: "P3",
          category: "Menorrhagia / hysteroscopy",
          outcome: "Routine hysteroscopy — polypectomy pathway",
          rationale:
            "AUB with USS suggestive of a uterine polyp follows the routine hysteroscopy pathway.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-023",
        title: "Endometrioma >= 5 cm with normal tumour markers",
        impact: "Escalate large endometrioma to semi-urgent review",
        kind: "compound",
        allFactLabels: ["Pelvic pain", "Ultrasound scan"],
        anyFactLabels: ["Endometrioma", "Endometriosis"],
        thresholdLabel: "Endometrioma size",
        thresholdMin: 5,
        recommendation: {
          priority: "P2",
          category: "Endometriosis / endometrioma",
          outcome: "Semi-urgent gynaecology review — endometrioma pathway",
          rationale:
            "Endometriomas measuring 5 cm or more with normal tumour markers warrant semi-urgent specialist review.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-024",
        title: "Deep infiltrating endometriosis on imaging",
        impact: "Escalate confirmed DIE to semi-urgent review",
        kind: "fact_any",
        factLabels: ["Deep infiltrating endometriosis", "DIE confirmed on imaging"],
        recommendation: {
          priority: "P2",
          category: "Endometriosis — deep infiltrating",
          outcome: "Semi-urgent gynaecology review — DIE pathway",
          rationale:
            "Imaging-confirmed deep infiltrating endometriosis requires earlier specialist assessment.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-025",
        title: "Recurrent endometriosis with normal scan",
        impact: "Route recurrent endometriosis with normal imaging to routine review",
        kind: "compound",
        allFactLabels: ["Pelvic pain", "Ultrasound scan"],
        anyFactLabels: ["Previous endometriosis", "Recurrent endometriosis"],
        absentFactLabels: ["Endometrioma", "Deep infiltrating endometriosis"],
        recommendation: {
          priority: "P3",
          category: "Endometriosis — recurrent",
          outcome: "Routine gynaecology review",
          rationale:
            "Previously diagnosed endometriosis recurring with normal scan imaging follows the routine pathway.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-016",
        title: "Procidentia",
        impact: "Escalate procidentia to earlier urogynaecology review",
        kind: "fact_any",
        factLabels: ["Procidentia"],
        recommendation: {
          priority: "P2",
          category: "Urogynaecology procidentia",
          outcome: "Semi-urgent urogynaecology review",
          rationale:
            "Procidentia is prioritised for earlier urogynaecology assessment.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-028",
        title: "Prolapse with urinary retention or hydronephrosis",
        impact: "Escalate prolapse with obstructive urinary complications to semi-urgent review",
        kind: "compound",
        allFactLabels: ["Urogynaecology"],
        anyFactLabels: ["Urinary retention", "Hydronephrosis", "Prolapse with retention"],
        recommendation: {
          priority: "P2",
          category: "Urogynaecology prolapse — obstructive complications",
          outcome: "Semi-urgent urogynaecology review — retention/hydronephrosis pathway",
          rationale:
            "Prolapse associated with urinary retention or hydronephrosis requires earlier specialist assessment.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-027",
        title: "Symptomatic prolapse (non-procidentia)",
        impact: "Route symptomatic stage 1–3 prolapse to routine urogynaecology review",
        kind: "compound",
        allFactLabels: ["Urogynaecology"],
        anyFactLabels: ["Prolapse stage 1", "Prolapse stage 2", "Prolapse stage 3", "Symptomatic prolapse"],
        absentFactLabels: ["Procidentia", "Asymptomatic prolapse"],
        recommendation: {
          priority: "P3",
          category: "Urogynaecology prolapse — symptomatic",
          outcome: "Routine urogynaecology review",
          rationale:
            "Symptomatic non-procidentia prolapse follows the routine urogynaecology pathway.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-029",
        title: "Stress urinary incontinence without prior physiotherapy",
        impact: "Route SUI to routine urogynaecology with conservative management advice",
        kind: "compound",
        allFactLabels: ["Stress urinary incontinence"],
        absentFactLabels: ["Pelvic floor physiotherapy", "Prior conservative management"],
        recommendation: {
          priority: "P3",
          category: "Urogynaecology SUI",
          outcome: "Routine urogynaecology — suggest pelvic floor physiotherapy first",
          rationale:
            "Stress urinary incontinence without prior physiotherapy should follow conservative management before specialist review.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-030",
        title: "Urge incontinence without medication trial",
        impact: "Reject urge incontinence referrals where bladder training or medication has not been tried",
        kind: "compound",
        allFactLabels: ["Urge incontinence"],
        absentFactLabels: ["Bladder training", "Anticholinergic medication", "Prior conservative management"],
        recommendation: {
          priority: "REJECT",
          category: "Urge incontinence",
          outcome: "Reject — advise bladder training and medication trial first",
          rationale:
            "Urge incontinence referrals should only proceed to specialist after bladder training and medication have been trialled.",
        },
      },
      {
        code: "GYN-017",
        title: "Recurrent urogynaecology symptoms",
        impact: "Escalate recurrent symptoms to earlier review",
        kind: "compound",
        allFactLabels: ["Urogynaecology", "Recurrent symptoms"],
        recommendation: {
          priority: "P2",
          category: "Urogynaecology recurrent symptoms",
          outcome: "Semi-urgent urogynaecology review",
          rationale:
            "Recurrent urogynaecology symptoms are prioritised for earlier review.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-018",
        title: "Mesh related problem",
        impact: "Escalate mesh complications",
        kind: "fact_any",
        factLabels: ["Mesh related problem"],
        recommendation: {
          priority: "P2",
          category: "Urogynaecology mesh-related problem",
          outcome: "Semi-urgent urogynaecology review",
          rationale:
            "Mesh-related complications should be prioritised for earlier specialist assessment.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-019",
        title: "Asymptomatic prolapse",
        impact: "Reject asymptomatic prolapse referrals",
        kind: "fact_any",
        factLabels: ["Asymptomatic prolapse"],
        recommendation: {
          priority: "REJECT",
          category: "Asymptomatic prolapse",
          outcome: "Reject asymptomatic prolapse referral",
          rationale:
            "Asymptomatic prolapse does not require specialist clinic review under the guideline.",
        },
      },
      {
        code: "GYN-031",
        title: "Paediatric gynaecology referral",
        impact: "Escalate paediatric referrals to SMO-reviewed semi-urgent pathway",
        kind: "fact_any",
        factLabels: ["Paediatric gynaecology", "Patient under 16"],
        recommendation: {
          priority: "P2",
          category: "Paediatric gynaecology",
          outcome: "Semi-urgent SMO-reviewed gynaecology assessment",
          rationale:
            "Paediatric gynaecology referrals require SMO-graded semi-urgent assessment.",
          requiresSmoReview: true,
          targetDays: 30,
        },
      },
      {
        code: "GYN-032",
        title: "Obstetric pelvic tear grade 3B, 3C, or 4th degree",
        impact: "Route significant obstetric perineal trauma to routine specialist review",
        kind: "fact_any",
        factLabels: [
          "Perineal tear 3B",
          "Perineal tear 3C",
          "Perineal tear 4th degree",
          "Obstetric anal sphincter injury",
        ],
        recommendation: {
          priority: "P3",
          category: "Obstetric perineal trauma",
          outcome: "Routine urogynaecology / pelvic floor review",
          rationale:
            "Grade 3B, 3C, and 4th degree obstetric tears require routine specialist follow-up for pelvic floor assessment.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-020",
        title: "Small asymptomatic cervical polyp with normal smear",
        impact: "Reject low-risk cervical polyps",
        kind: "compound",
        allFactLabels: ["Cervical polyp", "Normal smear"],
        absentFactLabels: ["Post-coital bleeding", "Intermenstrual bleeding"],
        thresholdLabel: "Cervical polyp size",
        thresholdMax: 2,
        recommendation: {
          priority: "REJECT",
          category: "Cervical polyp",
          outcome: "Reject and advise GP monitoring",
          rationale:
            "Small asymptomatic cervical polyps with a normal smear do not need specialist review.",
        },
      },
      {
        code: "GYN-021",
        title: "Symptomatic larger cervical polyp with normal smear",
        impact: "Route symptomatic cervical polyps to routine review",
        kind: "compound",
        allFactLabels: ["Cervical polyp", "Normal smear"],
        anyFactLabels: ["Post-coital bleeding", "Intermenstrual bleeding"],
        thresholdLabel: "Cervical polyp size",
        thresholdMin: 2,
        recommendation: {
          priority: "P3",
          category: "Cervical polyp",
          outcome: "Routine gynaecology review",
          rationale:
            "Larger symptomatic cervical polyps with a normal smear are routed to routine gynaecology review.",
        },
      },
      {
        code: "GYN-009",
        title: "PCOS virtual clinic pathway",
        impact: "Route PCOS referrals to virtual review",
        kind: "fact_any",
        factLabels: ["PCOS"],
        recommendation: {
          priority: "P5",
          category: "PCOS virtual review",
          outcome: "Virtual clinic review / clinician advice only",
          rationale:
            "PCOS referrals are handled through the virtual clinic pathway unless another higher-priority rule applies.",
        },
      },
      {
        code: "GYN-010",
        title: "Fertility referral diversion",
        impact: "Decline and redirect fertility referrals to the dedicated fertility pathway",
        kind: "fact_any",
        factLabels: ["Fertility"],
        recommendation: {
          priority: "DECLINE",
          category: "Fertility referral",
          outcome: "Decline and advise GP to refer directly to NRFS",
          rationale:
            "Fertility referrals should be redirected to the dedicated Northern Region Fertility Service pathway.",
        },
      },
      {
        code: "GYN-011",
        title: "Tubal ligation counselling",
        impact: "Treat tubal ligation counselling as routine P3 work",
        kind: "fact_any",
        factLabels: ["Tubal ligation"],
        recommendation: {
          priority: "P3",
          category: "Tubal ligation counselling",
          outcome: "Routine gynaecology review",
          rationale:
            "Tubal ligation counselling is graded as a routine P3 referral.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-034",
        title: "Postmenopausal bleeding — single episode, endometrial thickness below 5mm",
        impact: "Route single-episode PMB with reassuring USS to routine watchful waiting pathway",
        kind: "compound",
        allFactLabels: ["Postmenopausal bleeding", "Ultrasound scan"],
        absentFactLabels: ["Multiple PMB episodes"],
        thresholdLabel: "Endometrial thickness",
        thresholdMax: 4.9,
        recommendation: {
          priority: "P3",
          category: "Postmenopausal bleeding",
          outcome: "Routine gynaecology review — watchful waiting with GP follow-up",
          rationale:
            "Single episode of postmenopausal bleeding with endometrial thickness below 5mm does not meet the HSC threshold but warrants routine specialist review.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-035",
        title: "TVT or sling complication",
        impact: "Escalate TVT and sling complications to semi-urgent urogynaecology review",
        kind: "fact_any",
        factLabels: ["TVT complication", "Sling complication", "Mesh-tape complication"],
        recommendation: {
          priority: "P2",
          category: "Urogynaecology TVT/sling complication",
          outcome: "Semi-urgent urogynaecology review — mesh/tape pathway",
          rationale:
            "TVT or sling complications require earlier specialist assessment and are managed on the mesh/tape pathway.",
          targetDays: 30,
        },
      },
      {
        code: "GYN-036",
        title: "Intermenstrual bleeding with reassuring investigations",
        impact: "Route IMB with reassuring USS and smear to routine gynaecology review",
        kind: "compound",
        allFactLabels: ["Intermenstrual bleeding", "Ultrasound scan"],
        absentFactLabels: ["Cancer suspicion cytology", "Abnormal smear"],
        recommendation: {
          priority: "P3",
          category: "Intermenstrual bleeding",
          outcome: "Routine gynaecology review",
          rationale:
            "Intermenstrual bleeding with reassuring ultrasound and smear follows the routine gynaecology pathway.",
          targetDays: 120,
        },
      },
      {
        code: "GYN-037",
        title: "AUB — normal USS, no prior medical management",
        impact: "Return AUB with normal USS and no prior management to GP for conservative treatment first",
        kind: "compound",
        allFactLabels: ["Abnormal uterine bleeding", "Ultrasound scan"],
        absentFactLabels: [
          "Endometrial thickness",
          "Medical management trialled",
          "Persistent bleeding >3 months",
          "Uterine polyp on USS",
        ],
        recommendation: {
          priority: "REJECT",
          category: "Abnormal uterine bleeding",
          outcome: "Return to GP — advise medical management first (e.g. Mirena, norethisterone, tranexamic acid)",
          rationale:
            "AUB with normal USS and no prior medical management should be managed in primary care before specialist referral.",
        },
      },
      {
        code: "GYN-038",
        title: "Re-grading required — new clinical information received",
        impact: "Trigger SMO review when new clinical information requires the case to be re-graded",
        kind: "fact_any",
        factLabels: ["New clinical information", "Re-grading requested", "Upgraded urgency"],
        recommendation: {
          priority: "INFO_REQUIRED",
          category: "Re-grading required",
          outcome: "SMO review — re-grade based on new clinical information",
          rationale:
            "New clinical information has been received that changes the risk profile and requires the case to be re-graded.",
          requiresSmoReview: true,
        },
      },
      {
        code: "GYN-012",
        title: "Routine gynaecology symptom bundle",
        impact: "Use routine priority if no higher rule matched",
        kind: "fact_any",
        factLabels: [
          "Abnormal uterine bleeding",
          "Pelvic pain",
          "Fibroids",
          "Fibroid size",
          "PCOS",
          "Cervical polyp",
          "Urogynaecology",
          "Ovarian cyst",
          "Endometriosis",
        ],
        recommendation: {
          priority: "P3",
          category: "Routine gynaecology referral",
          outcome: "Routine gynaecology review",
          rationale:
            "The evidence indicates routine gynaecology symptoms without a currently matched urgent escalation rule.",
          targetDays: 120,
        },
      },
    ],
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPriority(value: unknown): value is TriagePriority {
  return (
    typeof value === "string" &&
    [
      "P1",
      "P1_HSC",
      "P2",
      "P2_HSC",
      "P3",
      "P5",
      "REJECT",
      "DECLINE",
      "INFO_REQUIRED",
    ].includes(value)
  );
}

function isRecommendation(value: unknown): value is RuleRecommendation {
  return (
    isObject(value) &&
    isPriority(value.priority) &&
    typeof value.category === "string" &&
    typeof value.outcome === "string" &&
    typeof value.rationale === "string" &&
    (value.requiresSmoReview === undefined ||
      typeof value.requiresSmoReview === "boolean")
  );
}

function isCaseRuleDefinition(value: unknown): value is CaseRuleDefinition {
  if (!isObject(value) || typeof value.code !== "string" || typeof value.title !== "string" || typeof value.impact !== "string") {
    return false;
  }

  if (value.kind === "case_flag") {
    return (
      value.flagName === "highSuspicionCancer" &&
      typeof value.flagLabel === "string" &&
      isRecommendation(value.recommendation)
    );
  }

  if (value.kind === "fact_any") {
    return (
      Array.isArray(value.factLabels) &&
      value.factLabels.every((label) => typeof label === "string") &&
      isRecommendation(value.recommendation)
    );
  }

  if (value.kind === "fact_all") {
    return (
      Array.isArray(value.factLabels) &&
      value.factLabels.every((label) => typeof label === "string") &&
      isRecommendation(value.recommendation)
    );
  }

  if (value.kind === "compound") {
    const allFactLabelsValid =
      value.allFactLabels === undefined ||
      (Array.isArray(value.allFactLabels) &&
        value.allFactLabels.every((label) => typeof label === "string"));
    const anyFactLabelsValid =
      value.anyFactLabels === undefined ||
      (Array.isArray(value.anyFactLabels) &&
        value.anyFactLabels.every((label) => typeof label === "string"));
    const absentFactLabelsValid =
      value.absentFactLabels === undefined ||
      (Array.isArray(value.absentFactLabels) &&
        value.absentFactLabels.every((label) => typeof label === "string"));
    const thresholdLabelValid =
      value.thresholdLabel === undefined || typeof value.thresholdLabel === "string";
    const thresholdMinValid =
      value.thresholdMin === undefined || typeof value.thresholdMin === "number";
    const thresholdMaxValid =
      value.thresholdMax === undefined || typeof value.thresholdMax === "number";

    return (
      allFactLabelsValid &&
      anyFactLabelsValid &&
      absentFactLabelsValid &&
      thresholdLabelValid &&
      thresholdMinValid &&
      thresholdMaxValid &&
      isRecommendation(value.recommendation)
    );
  }

  if (value.kind === "fact_threshold") {
    return (
      Array.isArray(value.signalLabels) &&
      value.signalLabels.every((label) => typeof label === "string") &&
      typeof value.thresholdLabel === "string" &&
      typeof value.thresholdMin === "number" &&
      isRecommendation(value.recommendation)
    );
  }

  return false;
}

function isCaseRuleReleaseDefinition(
  value: unknown,
  serviceLine: ServiceLine
): value is CaseRuleReleaseDefinition {
  return (
    isObject(value) &&
    value.releaseKind === "coded-enterprise-v2" &&
    value.serviceLine === serviceLine &&
    Array.isArray(value.sourceOfTruth) &&
    value.sourceOfTruth.every((item) => typeof item === "string") &&
    Array.isArray(value.notes) &&
    value.notes.every((item) => typeof item === "string") &&
    isRecommendation(value.defaultRecommendation) &&
    Array.isArray(value.rules) &&
    value.rules.every((rule) => isCaseRuleDefinition(rule))
  );
}

export function getBaselineCaseRuleReleaseDefinition(serviceLine: ServiceLine) {
  return BASELINE_CASE_RULE_DEFINITIONS[serviceLine];
}

export function describeCaseRuleDefinition(rule: CaseRuleDefinition) {
  if (rule.kind === "case_flag") {
    return `Condition: ${rule.flagName}`;
  }

  if (rule.kind === "fact_threshold") {
    return `Condition: ${rule.signalLabels.join(" or ")} with ${rule.thresholdLabel} >= ${rule.thresholdMin}`;
  }

  if (rule.kind === "fact_any") {
    return `Condition: any of ${rule.factLabels.join(", ")}`;
  }

  if (rule.kind === "fact_all") {
    return `Condition: all of ${rule.factLabels.join(", ")}`;
  }

  const segments: string[] = [];
  if (rule.allFactLabels && rule.allFactLabels.length > 0) {
    segments.push(`all of ${rule.allFactLabels.join(", ")}`);
  }
  if (rule.anyFactLabels && rule.anyFactLabels.length > 0) {
    segments.push(`any of ${rule.anyFactLabels.join(", ")}`);
  }
  if (rule.absentFactLabels && rule.absentFactLabels.length > 0) {
    segments.push(`none of ${rule.absentFactLabels.join(", ")}`);
  }
  if (rule.thresholdLabel) {
    const thresholdParts: string[] = [];
    if (rule.thresholdMin !== undefined) {
      thresholdParts.push(`>= ${rule.thresholdMin}`);
    }
    if (rule.thresholdMax !== undefined) {
      thresholdParts.push(`<= ${rule.thresholdMax}`);
    }
    segments.push(
      `${rule.thresholdLabel} ${thresholdParts.join(" and ")}`
    );
  }
  return `Condition: ${segments.join("; ")}`;
}

export function parseCaseRuleReleaseDefinition(args: {
  serviceLine: ServiceLine;
  definitionJson: string;
}) {
  try {
    const parsed = JSON.parse(args.definitionJson) as unknown;
    if (isCaseRuleReleaseDefinition(parsed, args.serviceLine)) {
      return parsed;
    }
  } catch {
    // Fall back to baseline definition if JSON is malformed or outdated.
  }

  return getBaselineCaseRuleReleaseDefinition(args.serviceLine);
}

export function validateCaseRuleReleaseDefinitionJson(args: {
  serviceLine: ServiceLine;
  definitionJson: string;
}) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(args.definitionJson) as unknown;
  } catch {
    throw new Error("definitionJson must be valid JSON");
  }

  if (!isCaseRuleReleaseDefinition(parsed, args.serviceLine)) {
    throw new Error(
      "definitionJson must match the enterprise case rule schema for this service"
    );
  }

  return parsed;
}

export function formatCaseRuleReleaseDefinitionJson(
  definition: CaseRuleReleaseDefinition
) {
  return JSON.stringify(definition, null, 2);
}
