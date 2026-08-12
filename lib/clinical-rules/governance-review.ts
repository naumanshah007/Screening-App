import { z } from "zod";

import { demoProvenance } from "@/lib/config/demo-mode";
import { prisma } from "@/lib/prisma";

export const ClinicalGovernanceDispositionSchema = z.enum([
  "SOURCE_SUPPORTS_OPTION_A",
  "SOURCE_SUPPORTS_OPTION_B",
  "KEEP_GOVERNANCE_STOP",
  "REQUIRE_EXTERNAL_CLINICAL_ADVICE",
  "RULEBOOK_CORRECTION_REQUIRED",
  "ORACLE_CORRECTION_REQUIRED",
]);

export type ClinicalGovernanceDisposition = z.infer<
  typeof ClinicalGovernanceDispositionSchema
>;

export const ClinicalGovernanceReviewActionSchema = z.object({
  action: z.enum(["PROPOSE", "APPROVE", "REJECT", "REQUEST_CHANGE"]),
  caseId: z.string().trim().min(1).max(160),
  disposition: ClinicalGovernanceDispositionSchema,
  comments: z.string().trim().min(10).max(4_000),
  expectedRevision: z.number().int().positive(),
});

export const CLINICAL_GOVERNANCE_CASES = [
  {
    caseId: "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
    title: "Confirmed ASC-H: excision considered versus observation",
    source: "Figure 5; primary prose p46/PDF 48; figure p47/PDF 49",
    recommendations: ["R6.08", "R6.09"],
    figureBranch: "Confirmed ASC-H → treatment decision",
    affectedRuleIds: ["F5-01", "F5-04"],
    affectedTests: ["CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED"],
    sourceGuidance: "Figure 5 and R6.08–R6.09 preserve specialist choice: diagnostic excision is considered and observation remains available after informed discussion.",
    currentLegacyBehaviour: "The comparison oracle collapses the branch to a deterministic treatment terminal.",
    canonicalBehaviour: "F5-01/F5-04 retain MDM review and the documented specialist choice between diagnostic excision and observation.",
    proposedFinalBehaviour: "Adopt the governed Figure 5 branch and correct the oracle; never auto-finalise treatment.",
    safetyImpact: "Prevents autonomous treatment selection while preserving escalation and specialist review.",
    testEvidence: "CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED; governed snapshot validation and source-verification suites.",
    competingInterpretation:
      "A deterministic treatment terminal versus a specialist decision in which diagnostic excision is considered and observation remains available.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Keeps treatment selection and completion as separately recorded facts and prevents autonomous treatment finalisation.",
  },
  {
    caseId: "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
    title: "Figure 5 observation: co-test surveillance provenance",
    source: "Figure 5; primary prose p46/PDF 48; figure p47/PDF 49",
    recommendations: ["R6.09"],
    figureBranch: "Observation → reassuring six-month result → repeat co-test",
    affectedRuleIds: ["F5-05", "F5-08"],
    affectedTests: ["CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC"],
    sourceGuidance: "Figure 5 and R6.09 define a two-stage co-test surveillance sequence after observation without implying prior treatment.",
    currentLegacyBehaviour: "The comparison oracle routes the reassuring result into ordinary post-treatment Test of Cure.",
    canonicalBehaviour: "F5-05/F5-08 preserve Figure 5 surveillance provenance and require the subsequent reassuring co-test before regular screening.",
    proposedFinalBehaviour: "Adopt the governed Figure 5 surveillance sequence and correct the oracle.",
    safetyImpact: "Avoids fabricating a treatment history and prevents premature return to routine screening.",
    testEvidence: "CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC; longitudinal sequence and source-verification tests.",
    competingInterpretation:
      "Ordinary post-treatment Figure 6 Test of Cure versus Figure 5 specialist co-testing surveillance without inferred prior treatment.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Preserves the two-stage negative sequence and Figure 5 provenance; it does not fabricate treatment or a treatment date.",
  },
  {
    caseId: "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
    title: "Test of Cure: first versus second consecutive low-grade result",
    source: "R8.06–R8.08 p55/PDF 57; Figure 6 p56/PDF 58",
    recommendations: ["R8.06", "R8.07", "R8.08"],
    figureBranch: "HPV not detected → low-grade cytology → sequence count",
    affectedRuleIds: ["F6-07", "F6-09", "F6-14"],
    affectedTests: ["CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT"],
    sourceGuidance: "R8.06–R8.08 and Figure 6 distinguish a first low-grade result from two consecutive low-grade results.",
    currentLegacyBehaviour: "The comparison oracle can collapse the first and second consecutive low-grade states.",
    canonicalBehaviour: "F6-07/F6-09/F6-14 require longitudinal sequence evidence before colposcopy is selected.",
    proposedFinalBehaviour: "Adopt the governed sequence-aware branch and correct the oracle.",
    safetyImpact: "Prevents premature escalation after a first result and under-escalation after a confirmed second consecutive result.",
    testEvidence: "CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT; Figure 6 sequence and conformance tests.",
    competingInterpretation:
      "Repeat after a first low-grade result versus colposcopy once two consecutive low-grade results are recorded.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Requires longitudinal sequence evidence and prevents a first low-grade result from being collapsed into the second-consecutive branch.",
  },
  {
    caseId: "ROUTER-002",
    title: "HPV Other with cytology pending: sample type routing",
    source: "Figure 3; LEGACY-006 evidence register",
    recommendations: ["F3-SAMPLE-TYPE-REQUIRED"],
    figureBranch: "HPV Other → no cytology result → sample type unknown",
    affectedRuleIds: [],
    affectedTests: ["source-router-regression: missing sample type", "figure3 baseline regression"],
    sourceGuidance: "Determine whether the sample was clinician-taken or self-collected before asking for cytology or arranging a return visit.",
    currentLegacyBehaviour: "Previously requested cytology even when an unknown sample could have been self-collected and unable to produce cytology.",
    canonicalBehaviour: "Stops for the missing sample-type fact before selecting the within-pathway recommendation.",
    proposedFinalBehaviour: "Approve the scoped router correction: request sample type only on the HPV Other/cytology-pending branch.",
    safetyImpact: "Neutral-to-safer clarification; never delays a known high-grade result and never changes HPV-not-detected recall.",
    testEvidence: "Three focused router probes plus the complete engine and semantic conformance suites pass.",
    competingInterpretation: "Keep the historical default that assumes cytology is obtainable.",
    sourceSupportedDisposition: "SOURCE_SUPPORTS_OPTION_A" as const,
    effectOnPathways: "Figure 3 routing only; no governed recommendation changes.",
  },
  {
    caseId: "ROUTER-003",
    title: "Pregnancy with malignant squamous cytology routes to Figure 9",
    source: "Figure 9; R11.07–R11.09; malignant-cytology classification",
    recommendations: ["F9-INITIAL-COLPOSCOPY", "F9-14"],
    figureBranch: "Pregnancy + SCC cytology",
    affectedRuleIds: ["F9-14"],
    affectedTests: ["source-router-regression: pregnancy SCC escalation", "PREGNANCY-MALIGNANT-CYTOLOGY"],
    sourceGuidance: "Malignant cytology in pregnancy requires urgent experienced colposcopy and oncology/MDT assessment as appropriate.",
    currentLegacyBehaviour: "Before correction, SCC missed the Figure 9 gate and fell through to an HPV-information request; it now routes to Figure 9 and P1 colposcopy.",
    canonicalBehaviour: "F9-14 adds urgent experienced colposcopy and explicit oncology/MDT assessment as appropriate.",
    proposedFinalBehaviour: "Approve the router correction independently; adjudicate the remaining oncology/MDT action in the separate F9-14 card.",
    safetyImpact: "Strictly more urgent than the historical under-escalation; the remaining MDT element is not silently claimed as closed.",
    testEvidence: "Unconditional SCC router regression passes; the narrowed F9-14 divergence remains explicitly asserted.",
    competingInterpretation: "Treat SCC as outside the pregnancy pathway until HPV is supplied.",
    sourceSupportedDisposition: "SOURCE_SUPPORTS_OPTION_A" as const,
    effectOnPathways: "Legacy pathway selection only; canonical F9-14 remains a distinct approval.",
  },
  {
    caseId: "ROUTER-001",
    title: "Age at Figure 3 baseline is not a routing defect",
    source: "Figure 3 baseline and first-repeat age branch",
    recommendations: ["F3-FIRST-REPEAT-AGE-REQUIRED"],
    figureBranch: "Baseline versus FIRST_REPEAT age dependency",
    affectedRuleIds: [],
    affectedTests: ["source-router-regression: baseline age independence", "source-router-regression: first-repeat age required"],
    sourceGuidance: "The ≥50-year fork applies at FIRST_REPEAT, not at baseline.",
    currentLegacyBehaviour: "Baseline is age-independent; FIRST_REPEAT already stops when age is absent.",
    canonicalBehaviour: "The governed pathway uses age only at the source-defined branch point.",
    proposedFinalBehaviour: "Record ROUTER-001 as NOT A DEFECT; make no clinical engine change.",
    safetyImpact: "Avoids adding an unsupported prompt while pinning the real age-dependent branch.",
    testEvidence: "Separate baseline and FIRST_REPEAT regressions pass with no todo tests.",
    competingInterpretation: "Add an age prompt at baseline despite no source-defined fork.",
    sourceSupportedDisposition: "SOURCE_SUPPORTS_OPTION_A" as const,
    effectOnPathways: "No runtime change.",
  },
  {
    caseId: "F9-14-ONCOLOGY-MDT",
    title: "Pregnancy malignant cytology: oncology/MDT action",
    source: "NCSP June 2023 v1.1 R11.07–R11.09; Figure 9",
    recommendations: ["F9-14"],
    figureBranch: "Pregnancy + cytology suspicious/definite invasive cancer",
    affectedRuleIds: ["F9-14"],
    affectedTests: ["PREGNANCY-MALIGNANT-CYTOLOGY", "F9-14 governed rule validation"],
    sourceGuidance: "Urgent experienced colposcopy and oncology/MDT assessment as appropriate; do not defer to routine postpartum review.",
    currentLegacyBehaviour: "After ROUTER-003, routes urgently to P1 colposcopy but does not encode the oncology/MDT element.",
    canonicalBehaviour: "F9-14 explicitly includes oncology/MDT assessment as appropriate.",
    proposedFinalBehaviour: "Prefer F9-14 as written, subject to a clinician confirming the operational trigger and ownership for oncology/MDT.",
    safetyImpact: "Potentially closes a residual under-specification in a malignant-cytology pathway; requires a genuine clinical signature.",
    testEvidence: "The divergence is intentionally retained and asserted; no adapter invents the MDT action.",
    competingInterpretation: "Colposcopy referral alone is sufficient until diagnosis is confirmed.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Figure 9 within-pathway recommendation and downstream referral workflow.",
  },
  {
    caseId: "LEGACY-005",
    title: "Cytology pending must remain an explicit safety stop",
    source: "Figure 3; legacy defect register LEGACY-005",
    recommendations: ["F3-CYTOLOGY-PENDING-INCOMPLETE"],
    figureBranch: "HPV result present + cytology pending/incomplete",
    affectedRuleIds: [],
    affectedTests: ["legacy-defect-regression LEGACY-005", "missing-information conformance"],
    sourceGuidance: "Do not issue a terminal recommendation until the pathway-defining cytology information is available.",
    currentLegacyBehaviour: "Returns an incomplete-result outcome but historically collapses distinct missing states.",
    canonicalBehaviour: "Produces an explicit fail-safe safety stop with missing-information provenance.",
    proposedFinalBehaviour: "Adopt the canonical safety stop for new cases; separately decide whether the historic cohort needs review.",
    safetyImpact: "More conservative; prevents a recommendation from incomplete evidence.",
    testEvidence: "Registered high-severity defect and missing-fact safety-stop tests pass.",
    competingInterpretation: "Preserve the less explicit incomplete-result handling.",
    sourceSupportedDisposition: "SOURCE_SUPPORTS_OPTION_A" as const,
    effectOnPathways: "Figure 3 only; no retrospective regrade without policy approval.",
  },
  {
    caseId: "LEGACY-014",
    title: "Figure 5 treatment-deferred HPV-detected surveillance",
    source: "Figure 5; R6.09; legacy defect register LEGACY-014",
    recommendations: ["F5-07"],
    figureBranch: "Treatment deferred + HPV detected + normal cytology/colposcopy",
    affectedRuleIds: ["F5-07"],
    affectedTests: ["legacy-defect-regression LEGACY-014", "Figure 5 conformance"],
    sourceGuidance: "Continue specialist Figure 5 surveillance with repeat colposcopy, HPV and cytology.",
    currentLegacyBehaviour: "Returns a legacy 12-month code that the independent comparison cannot map cleanly.",
    canonicalBehaviour: "F5-07 retains specialist surveillance and does not infer completed treatment.",
    proposedFinalBehaviour: "Prefer F5-07, subject to confirmation that the surveillance interval and service ownership match local clinical practice.",
    safetyImpact: "Prevents pathway provenance loss; timing remains a signed clinical-policy question.",
    testEvidence: "Difference remains classified and cannot silently pass as equivalent.",
    competingInterpretation: "Retain the legacy coded 12-month outcome as clinically equivalent.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Figure 5 surveillance and timing.",
  },
  {
    caseId: "LEGACY-017",
    title: "Confirmed AG2 with no visible lesion: specialist investigation",
    source: "Figure 7 glandular pathway; legacy defect register LEGACY-017",
    recommendations: ["F7-05"],
    figureBranch: "No lesion + confirmed AG2",
    affectedRuleIds: ["F7-05"],
    affectedTests: ["legacy-defect-regression LEGACY-017", "Figure 7 conformance"],
    sourceGuidance: "Investigate other gynaecological malignancies under specialist direction.",
    currentLegacyBehaviour: "Routes to a generic gynaecology investigation outcome.",
    canonicalBehaviour: "F7-05 makes the malignancy-investigation intent explicit.",
    proposedFinalBehaviour: "Prefer the governed F7-05 wording; clinician to confirm the receiving service and operational referral action.",
    safetyImpact: "Clarifies cancer investigation intent without autonomously diagnosing or selecting treatment.",
    testEvidence: "Difference is registered; Figure 7 source and semantic tests remain green.",
    competingInterpretation: "Treat the generic legacy destination as fully sufficient.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Figure 7 specialist destination.",
  },
  {
    caseId: "LEGACY-026",
    title: "Pregnancy normal TZ with MDM-confirmed high grade",
    source: "Figure 9; legacy defect register LEGACY-026",
    recommendations: ["F9 MDM review"],
    figureBranch: "Pregnancy + normal TZ + MDM confirms high-grade disease",
    affectedRuleIds: [],
    affectedTests: ["legacy-defect-regression LEGACY-026", "Figure 9 conformance"],
    sourceGuidance: "Pregnancy management remains specialist/MDM-led with high-grade disease explicitly carried forward.",
    currentLegacyBehaviour: "Returns an MDM review destination.",
    canonicalBehaviour: "Also preserves specialist review but the comparison outcome is not yet mapped as a proven equivalence.",
    proposedFinalBehaviour: "Keep a governance stop until a clinician confirms the exact post-MDM action and timing; do not infer equivalence from labels.",
    safetyImpact: "Fail-safe; prevents an ambiguous pregnancy high-grade branch from being auto-finalised.",
    testEvidence: "The unmapped difference remains explicit and blocks affected-pathway activation.",
    competingInterpretation: "Treat both MDM labels as equivalent without independent validation.",
    sourceSupportedDisposition: "KEEP_GOVERNANCE_STOP" as const,
    effectOnPathways: "Figure 9 high-grade pregnancy branch.",
  },
  {
    caseId: "INPUT-GAP-STAGE-1A1",
    title: "Stage 1A1 cervical cancer history input gap",
    source: "NCSP cancer-history applicability guidance; input compatibility IN-01",
    recommendations: ["SAFETY_STOP"],
    figureBranch: "Cancer history where stage/treatment/applicability cannot be represented by the deployed intake contract",
    affectedRuleIds: [],
    affectedTests: ["canonical facts v2 input representation", "missing-information safety stop"],
    sourceGuidance: "Cancer stage, treatment and follow-up context determine whether NCSP screening guidance applies.",
    currentLegacyBehaviour: "The legacy input contract lacks the required cancer stage and treatment facts.",
    canonicalBehaviour: "Stops safely rather than fabricating stage, treatment or NCSP applicability.",
    proposedFinalBehaviour: "Keep the safety stop until a clinician approves the required intake facts and routing destination.",
    safetyImpact: "Fail-safe but creates manual workload; guessing could misroute cancer follow-up.",
    testEvidence: "18/18 states represented; this is one of two explicitly unresolved states and cannot silently evaluate.",
    competingInterpretation: "Infer applicability from the available generic cancer flags.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Cancer-history cases only; can remain scoped out of activation.",
  },
  {
    caseId: "INPUT-GAP-NON-CERVICAL-HYSTERECTOMY",
    title: "Non-cervical-cancer hysterectomy overlay input gap",
    source: "Figure 8/Table 1 and cancer-history applicability guidance; input compatibility IN-01",
    recommendations: ["SAFETY_STOP"],
    figureBranch: "Post-hysterectomy + non-cervical gynaecological cancer history",
    affectedRuleIds: [],
    affectedTests: ["canonical facts v2 input representation", "Table 1 21-cell coverage"],
    sourceGuidance: "Vault follow-up depends on hysterectomy indication, cervix status, cancer type and specialist follow-up context.",
    currentLegacyBehaviour: "The deployed input contract cannot distinguish the full non-cervical-cancer overlay.",
    canonicalBehaviour: "Stops for missing cancer-type/applicability facts and never fabricates an overlay.",
    proposedFinalBehaviour: "Keep the safety stop until the fact contract and specialist routing are clinically approved.",
    safetyImpact: "Fail-safe; avoids inappropriate routine recall or cessation after cancer treatment.",
    testEvidence: "Table 1 is 21/21 covered; this cross-pathway overlay remains deliberately unresolved.",
    competingInterpretation: "Derive the overlay from hysterectomy indication alone.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Figure 8/Table 1 plus cancer follow-up.",
  },
  {
    caseId: "TIMING-POLICY",
    title: "Canonical timing and clinician-determined dates",
    source: "Governed timing census; activation readiness GOV-04 evidence",
    recommendations: ["20/203 auto-schedulable", "183/203 clinician/external anchor"],
    figureBranch: "All recall-producing pathways",
    affectedRuleIds: [],
    affectedTests: ["timing classification report", "adapter interval safety tests", "null-recall monitoring"],
    sourceGuidance: "Use an exact machine date only where the governed source provides an unambiguous interval and anchor; otherwise require clinician determination.",
    currentLegacyBehaviour: "Often supplies a recall interval through legacy recommendation codes and local workflow assumptions.",
    canonicalBehaviour: "Only 20 of 203 rules permit machine scheduling; the remainder stop for clinician or external-anchor determination.",
    proposedFinalBehaviour: "Approve explicit clinician-determined timing as the default and numeric monitoring thresholds before activation; never silently coerce prose into dates.",
    safetyImpact: "Fail-safe but materially increases clinical workload and can delay recall if capacity is insufficient.",
    testEvidence: "Timing census: 18 exact + 2 range = 20/203; adapter parse failures and null recall are monitored rollback signals.",
    competingInterpretation: "Infer dates from narrative or preserve every legacy interval automatically.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "Recall generation, notifications, overdue analytics and reviewer workload.",
  },
  {
    caseId: "REGRADE-POLICY",
    title: "Historical cohort and regrade policy",
    source: "Historical decision policy HIST-03; 26-defect register",
    recommendations: ["NEW CASES ONLY", "NO AUTOMATIC RETROSPECTIVE REGRADE"],
    figureBranch: "Existing evaluated cases across affected legacy pathways",
    affectedRuleIds: [],
    affectedTests: ["authority pinning", "append-only evaluation", "explicit regrade provenance"],
    sourceGuidance: "Clinical history and the originally applied engine/ruleset must remain immutable; any look-back is a separate governed safety action.",
    currentLegacyBehaviour: "Existing cases retain their recorded decision; 22 of 26 classified differences are corrected prospectively by canonical.",
    canonicalBehaviour: "New cases can use canonical authority while existing evaluated cases remain pinned; explicit regrade creates a new immutable evaluation.",
    proposedFinalBehaviour: "Activate for new cases only, with no automatic retrospective regrade; require a signed cohort/look-back and safety-netting policy for any historical review.",
    safetyImpact: "Preserves provenance but requires a deliberate decision about participants affected by more-urgent canonical corrections.",
    testEvidence: "DB-backed pinning, rollback and append-only history suites pass; zero historical overwrite paths are permitted.",
    competingInterpretation: "Bulk regrade all historical cases or silently replace prior decisions.",
    sourceSupportedDisposition: "SOURCE_SUPPORTS_OPTION_A" as const,
    effectOnPathways: "All existing evaluated cases and any future safety-netting cohort.",
  },
  {
    caseId: "GOV-04",
    title: "Canonical operating point and reviewer capacity",
    source: "179-case semantic corpus and 203-rule timing census",
    recommendations: ["152/179 clinicianOnly", "20/203 auto-schedulable"],
    figureBranch: "All governed within-pathway recommendations",
    affectedRuleIds: [],
    affectedTests: ["179-case conformance corpus", "monitoring aggregate tests", "timing census"],
    sourceGuidance: "Ambiguous, missing, externally anchored or specialist-only decisions remain under clinician control.",
    currentLegacyBehaviour: "Provides higher automation through legacy codes and assumptions not always present in the governed source.",
    canonicalBehaviour: "Requires clinician-only handling in 152/179 corpus cases, with 99 over-restrictions and 0 under-restrictions against the source oracle.",
    proposedFinalBehaviour: "Risk owner must sign the acceptable clinician-only/safety-stop operating point, staffing capacity and numeric rollback thresholds before activation.",
    safetyImpact: "Fail-safe direction with a substantial workload and timeliness risk if the operating point exceeds reviewer capacity.",
    testEvidence: "152/179 clinician-only; oracle 53/179; 99 over-restrictions; 0 under-restrictions; 20/203 machine-schedulable rules.",
    competingInterpretation: "Activate without a numeric capacity threshold because the direction is conservative.",
    sourceSupportedDisposition: "REQUIRE_EXTERNAL_CLINICAL_ADVICE" as const,
    effectOnPathways: "All canonical-authoritative cases and post-activation monitoring.",
  },
] as const;

function parseAfterJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function assertSeparateGovernanceActors(
  proposerUserId: string | null,
  approverUserId: string
) {
  if (proposerUserId === approverUserId) {
    throw new Error(
      "The proposer cannot finally approve the same clinical interpretation."
    );
  }
}

export async function recordClinicalGovernanceReview(args: {
  versionId: string;
  actorUserId: string;
  action: "PROPOSE" | "APPROVE" | "REJECT" | "REQUEST_CHANGE";
  caseId: string;
  disposition: ClinicalGovernanceDisposition;
  comments: string;
  expectedRevision: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!CLINICAL_GOVERNANCE_CASES.some((item) => item.caseId === args.caseId)) {
    throw new Error("Unknown clinical governance case.");
  }

  return prisma.$transaction(async (tx) => {
    const version = await tx.clinicalRuleVersion.findUnique({
      where: { id: args.versionId },
    });
    if (!version) throw new Error("Clinical rule version not found.");
    if (version.status !== "DRAFT") {
      throw new Error("Governance interpretation may only revise a draft successor.");
    }
    if (version.revision !== args.expectedRevision) {
      throw new Error(
        `Revision conflict: expected ${args.expectedRevision}, found ${version.revision}. Refresh before continuing.`
      );
    }

    if (args.action === "REJECT" || args.action === "REQUEST_CHANGE") {
      const requestedChange = args.action === "REQUEST_CHANGE";
      await tx.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: version.ruleSetId,
          ruleVersionId: version.id,
          actorUserId: args.actorUserId,
          isDemo: demoProvenance().isDemo,
          eventType: requestedChange
            ? "GOVERNANCE_INTERPRETATION_CHANGE_REQUESTED"
            : "GOVERNANCE_INTERPRETATION_REJECTED",
          reason: args.comments,
          afterJson: JSON.stringify({
            caseId: args.caseId,
            disposition: args.disposition,
            approvalStatus: requestedChange
              ? "CHANGES_REQUESTED"
              : "REJECTED_REQUIRES_REVISION",
            versionRevision: version.revision,
            checksum: version.checksum,
            publicationPermitted: false,
          }),
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
        },
      });
      return {
        action: requestedChange ? ("CHANGES_REQUESTED" as const) : ("REJECTED" as const),
        revision: version.revision,
      };
    }

    if (args.action === "PROPOSE") {
      await tx.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: version.ruleSetId,
          ruleVersionId: version.id,
          actorUserId: args.actorUserId,
          isDemo: demoProvenance().isDemo,
          eventType: "GOVERNANCE_INTERPRETATION_PROPOSED",
          reason: args.comments,
          afterJson: JSON.stringify({
            caseId: args.caseId,
            disposition: args.disposition,
            approvalStatus: "PROPOSED",
            versionRevision: version.revision,
            checksum: version.checksum,
          }),
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
        },
      });
      return { action: "PROPOSED" as const, revision: version.revision };
    }

    const events = await tx.ruleVersionAuditEvent.findMany({
      where: {
        ruleVersionId: version.id,
        eventType: "GOVERNANCE_INTERPRETATION_PROPOSED",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const proposal = events.find((event) => {
      const details = parseAfterJson(event.afterJson);
      return details?.caseId === args.caseId &&
        details.disposition === args.disposition &&
        details.checksum === version.checksum;
    });
    if (!proposal) {
      throw new Error("A matching proposal is required before approval.");
    }
    assertSeparateGovernanceActors(proposal.actorUserId, args.actorUserId);

    const priorValidation = version.validationJson
      ? parseAfterJson(version.validationJson) ?? {}
      : {};
    const priorReviews =
      priorValidation.governanceReviews &&
      typeof priorValidation.governanceReviews === "object"
        ? priorValidation.governanceReviews as Record<string, unknown>
        : {};
    const nextRevision = version.revision + 1;
    await tx.clinicalRuleVersion.update({
      where: { id: version.id, revision: version.revision },
      data: {
        revision: { increment: 1 },
        validationJson: JSON.stringify({
          ...priorValidation,
          releaseSubStatus:
            "ENGINEERING_VALIDATION_PASSED_CLINICAL_GOVERNANCE_PENDING",
          publicationPermitted: false,
          governanceReviews: {
            ...priorReviews,
            [args.caseId]: {
              disposition: args.disposition,
              approvalStatus: "APPROVED_IN_DRAFT_REVISION",
              proposerUserId: proposal.actorUserId,
              approverUserId: args.actorUserId,
              approvedRevision: nextRevision,
            },
          },
        }),
      },
    });
    await tx.ruleVersionAuditEvent.create({
      data: {
        ruleSetId: version.ruleSetId,
        ruleVersionId: version.id,
        actorUserId: args.actorUserId,
        isDemo: demoProvenance().isDemo,
        eventType: "GOVERNANCE_INTERPRETATION_APPROVED",
        reason: args.comments,
        beforeJson: JSON.stringify({
          caseId: args.caseId,
          proposalEventId: proposal.id,
          revision: version.revision,
        }),
        afterJson: JSON.stringify({
          caseId: args.caseId,
          disposition: args.disposition,
          approvalStatus: "APPROVED_IN_DRAFT_REVISION",
          revision: nextRevision,
          checksum: version.checksum,
          publicationPermitted: false,
        }),
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "GOVERNANCE_INTERPRETATION_APPROVED",
        entity: "ClinicalRuleVersion",
        entityId: version.id,
        oldValue: JSON.stringify({ revision: version.revision }),
        newValue: JSON.stringify({
          revision: nextRevision,
          caseId: args.caseId,
          disposition: args.disposition,
          publicationPermitted: false,
        }),
      },
    });
    return { action: "APPROVED" as const, revision: nextRevision };
  });
}
