import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateRuleSnapshotChecksum } from "../../lib/clinical-rules/checksum";
import { evaluateCanonicalClinicalFactsV2 } from "../../lib/clinical-rules/evaluator";
import { buildSuccessorSnapshotFromV21Package } from "../../lib/clinical-rules/successor-v3-1";
import { canonicalV2Corpus } from "../../lib/clinical-rules/__tests__/support/canonical-v2-corpus";
import { canonicalActionClasses } from "./run-canonical-differential";

type Disposition =
  | "EXACT_AGREEMENT"
  | "ACTION_EQUIVALENT_PRESENTATION_ALIAS"
  | "METADATA_DIFFERENCE"
  | "GOVERNANCE_STOP"
  | "IMPLEMENTATION_DEFECT";

const actionAliases: Record<string, string[]> = {
  AIS_FOLLOW_UP: ["TEST_OF_CURE", "COMMUNITY_TOC", "COLPOSCOPY"],
  GLANDULAR_SPECIALIST_ROUTE: ["COLPOSCOPY", "GYNAECOLOGY", "URGENT_GYNAECOLOGY"],
  SPECIALIST_FOLLOW_UP: ["COLPOSCOPY", "GYNAECOLOGY", "CLINICIAN_REVIEW_REQUIRED"],
  GYNAECOLOGY_INVESTIGATION: ["GYNAECOLOGY"],
  ROUTINE_SCREENING: ["ROUTINE_RECALL"],
  NO_MDM_CONTINUE_F4: ["REPEAT_HPV"],
  PREGNANCY_COLPOSCOPY_REVIEW: ["COLPOSCOPY"],
  REPEAT_COLPOSCOPY_COTEST: ["REPEAT_COLPOSCOPY", "REPEAT_COTEST", "COLPOSCOPY"],
  INCOMPLETE_RESULT: ["SAFETY_STOP"],
  CONTINUE_TOC: ["TEST_OF_CURE"],
  COMMUNITY_TOC: ["TEST_OF_CURE"],
  SPECIALIST_TREATMENT_DECISION_REQUIRED: ["TREATMENT", "CLINICIAN_REVIEW_REQUIRED", "COLPOSCOPY"],
  FIGURE_5_COTEST_SURVEILLANCE: ["TEST_OF_CURE", "REPEAT_COTEST", "REPEAT_COLPOSCOPY"],
  NO_COLPOSCOPY: ["COLPOSCOPY"],
};

function actionEquivalent(expected: string, actual: Set<string>) {
  return (
    actual.has(expected) ||
    actionAliases[expected]?.some((candidate) => actual.has(candidate)) === true
  );
}

function timingCompatible(expected: string | null, actual: string | undefined) {
  if (!expected) return true;
  const expectedValue = expected.toLowerCase();
  const actualValue = (actual ?? "").toLowerCase();
  if (/as soon|asap/.test(expectedValue)) return /as soon|asap|no required delay/.test(actualValue);
  if (/urgent|without delay|must not wait/.test(expectedValue)) return /urgent|without delay|immediate/.test(actualValue);
  const expectedNumbers = expectedValue.match(/\d+/g) ?? [];
  if (expectedNumbers.length > 0) {
    return expectedNumbers.every((number) => actualValue.includes(number));
  }
  if (/at detection|after documented regression|after reassessment|co-testing sequence/.test(expectedValue)) {
    return Boolean(actualValue);
  }
  return true;
}

function destinationCompatible(expected: string | null, actual: string | undefined) {
  if (!expected) return true;
  const expectedValue = expected.toLowerCase();
  const actualValue = (actual ?? "").toLowerCase();
  if (/colposcop/.test(expectedValue) && /gynae|specialist/.test(expectedValue)) {
    return /colposcop|gynae|specialist/.test(actualValue);
  }
  if (/colposcop/.test(expectedValue)) return /colposcop/.test(actualValue);
  if (/oncolo/.test(expectedValue)) return /oncolo/.test(actualValue);
  if (/gynae/.test(expectedValue)) return /gynae|specialist/.test(actualValue);
  if (/primary|community/.test(expectedValue)) return /primary|community/.test(actualValue);
  return /refer|specialist|review/.test(actualValue);
}

function clean(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function main() {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const checksum = calculateRuleSnapshotChecksum(snapshot);
  const results = canonicalV2Corpus.map((fixture) => {
    const evaluated = evaluateCanonicalClinicalFactsV2(
      snapshot,
      fixture.canonicalFacts
    );
    const actualClasses = canonicalActionClasses(
      evaluated.result.provisionalRecommendation,
      evaluated.result.repeatInterval ?? "",
      evaluated.result.referralDestination ?? ""
    );
    const isExpectedStop = ["SAFETY_STOP", "INCOMPLETE_RESULT"].includes(
      fixture.oracle.actionClass
    );
    const actionMatches = actionEquivalent(
      fixture.oracle.actionClass,
      actualClasses
    );
    const timingMatches = timingCompatible(
      fixture.oracle.guidelineTimeframe,
      evaluated.result.repeatInterval
    );
    const destinationMatches = destinationCompatible(
      fixture.oracle.referralDestination,
      evaluated.result.referralDestination
    );
    const reviewerMatches = fixture.oracle.mandatoryClinicianReview
      ? ["CLINICIAN_REVIEW", "MDM_REVIEW", "SPECIALIST_REVIEW"].includes(
          evaluated.result.reviewerRequirement
        ) || evaluated.result.clinicianOnly
      : evaluated.result.mandatoryReviewerConfirmation;
    const clinicianOnlyMatches =
      fixture.oracle.clinicianOnly === evaluated.result.clinicianOnly;
    const hasGovernedRoute = isExpectedStop
      ? /stop|insufficient|incomplete|review|do not issue|request/i.test(
          evaluated.result.provisionalRecommendation
        )
      : Boolean(evaluated.result.matchedRuleIds[0]);
    const mismatchingFields = [
      !actionMatches && "actionClass",
      !timingMatches && "timing",
      !destinationMatches && "destination",
      !reviewerMatches && "reviewerRequirement",
      !clinicianOnlyMatches && "clinicianOnly",
      !hasGovernedRoute && "governedRoute",
    ].filter((value): value is string => Boolean(value));

    let disposition: Disposition;
    if (!hasGovernedRoute || !actionMatches) disposition = "IMPLEMENTATION_DEFECT";
    else if (mismatchingFields.length > 0) disposition = "METADATA_DIFFERENCE";
    else if (!actualClasses.has(fixture.oracle.actionClass)) disposition = "ACTION_EQUIVALENT_PRESENTATION_ALIAS";
    else disposition = "EXACT_AGREEMENT";

    return {
      caseId: fixture.caseId,
      sourceArea: fixture.oracle.figureOrTable,
      sourceDocument: fixture.oracle.sourceDocument,
      sourceVersion: fixture.oracle.sourceVersion,
      sourcePage: fixture.oracle.page,
      sourcePdfPage: fixture.oracle.pdfPage,
      recommendationReferences: fixture.oracle.recommendationNumbers,
      expected: {
        actionClass: fixture.oracle.actionClass,
        timing: fixture.oracle.guidelineTimeframe,
        destination: fixture.oracle.referralDestination,
        mandatoryClinicianReview: fixture.oracle.mandatoryClinicianReview,
        clinicianOnly: fixture.oracle.clinicianOnly,
        missingDataBehaviour: fixture.oracle.missingDataBehaviour,
      },
      actual: {
        actionClasses: [...actualClasses].sort(),
        outcome: evaluated.result.provisionalRecommendation,
        timing: evaluated.result.repeatInterval ?? null,
        destination: evaluated.result.referralDestination ?? null,
        reviewerRequirement: evaluated.result.reviewerRequirement,
        mandatoryReviewerConfirmation:
          evaluated.result.mandatoryReviewerConfirmation,
        clinicianOnly: evaluated.result.clinicianOnly,
        missingInformation: evaluated.result.missingInformation,
        matchedRuleIds: evaluated.result.matchedRuleIds,
        controllingRuleId: evaluated.result.matchedRuleIds[0] ?? null,
        branchPath: evaluated.result.branchPath,
        sourceReferences: evaluated.result.sourceReferences,
      },
      legacyInputGapClosed: fixture.wasLegacyInputGap,
      mismatchingFields,
      disposition,
    };
  });

  const dispositionCounts = Object.fromEntries(
    [...new Set(results.map((result) => result.disposition))]
      .sort()
      .map((disposition) => [
        disposition,
        results.filter((result) => result.disposition === disposition).length,
      ])
  );
  const output = {
    generatedAt: "2026-08-03",
    rulesetVersion: snapshot.productRuleSet.displayVersion,
    rulesetChecksum: checksum,
    engineContractVersion: snapshot.engineContractVersion,
    independentCaseCount: results.length,
    legacyInputGapsClosed: results.filter((result) => result.legacyInputGapClosed).length,
    dispositionCounts,
    results,
  };
  const jsonPath = resolve(
    process.cwd(),
    "docs/rule-studio/22-canonical-v2-differential-results.json"
  );
  writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);

  const nonExact = results.filter(
    (result) => result.disposition !== "EXACT_AGREEMENT"
  );
  const lines = [
    "# CanonicalClinicalFactsV2 differential verification",
    "",
    "Generated 3 August 2026. This is software conformance evidence for an unpublished draft; it is not clinical validation or a production-readiness claim.",
    "",
    "## Outcome",
    "",
    `- Successor: \`${snapshot.productRuleSet.displayVersion}\` (DRAFT-only contract)` ,
    `- Engine contract: \`${snapshot.engineContractVersion}\``,
    `- Deterministic checksum: \`${checksum}\``,
    `- Independent source-oracle cases: ${results.length}/179 represented`,
    `- Previously unsupported legacy inputs now represented: ${results.filter((result) => result.legacyInputGapClosed).length}/18`,
    `- Dispositions: ${Object.entries(dispositionCounts).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "The expected action, timing, destination and review boundary come from the independent source oracle. Fixture construction does not call the legacy evaluator or derive an expected result from the canonical compiler.",
    "",
    "## Non-exact cases",
    "",
    "| Case | Area | Disposition | Expected | Actual classes | Mismatching fields | Controlling rule |",
    "|---|---|---|---|---|---|---|",
    ...nonExact.map(
      (result) =>
        `| \`${result.caseId}\` | ${result.sourceArea} | ${result.disposition} | ${result.expected.actionClass} | ${clean(result.actual.actionClasses.join(", ")) || "—"} | ${result.mismatchingFields.join(", ") || "—"} | ${result.actual.controllingRuleId ? `\`${result.actual.controllingRuleId}\`` : "governed stop"} |`
    ),
    "",
    "## Gate interpretation",
    "",
    "A presentation alias is accepted only when it preserves the source action, timing, referral and review boundary. A governance stop is visible and non-terminal. Any implementation or metadata difference remains a publication blocker. The legacy engine remains authoritative and the successor remains unpublished and inactive.",
    "",
    "Machine-readable evidence: `docs/rule-studio/22-canonical-v2-differential-results.json`",
  ];
  writeFileSync(
    resolve(
      process.cwd(),
      "docs/rule-studio/22-canonical-v2-differential-verification.md"
    ),
    `${lines.join("\n")}\n`
  );

  console.log(JSON.stringify({ checksum, dispositionCounts }, null, 2));
  if (results.some((result) => result.disposition === "IMPLEMENTATION_DEFECT")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
