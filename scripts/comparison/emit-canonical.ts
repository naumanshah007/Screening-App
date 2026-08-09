/**
 * Three-way comparison harness — canonical (System C) emitter.
 *
 * Evaluates CG-NCSP-3.1.0 in SIMULATION over the 179-case CanonicalClinicalFactsV2
 * corpus and emits a JSON record per case, keyed on the same oracle case IDs used
 * by the legacy emitter.
 *
 * SIMULATION ONLY. This script builds the successor snapshot in memory from the
 * external v2.1 source package and evaluates it directly. It does not touch the
 * database, does not publish, does not activate, does not create a
 * RuleSetActivation, and does not write a RuleEvaluation row. Legacy remains
 * authoritative.
 *
 * Run: npx tsx scripts/comparison/emit-canonical.ts <outFile>
 */

import { writeFileSync } from "node:fs";

import { calculateRuleSnapshotChecksum } from "../../lib/clinical-rules/checksum";
import { evaluateCanonicalClinicalFactsV2 } from "../../lib/clinical-rules/evaluator";
import { buildSuccessorSnapshotFromV21Package } from "../../lib/clinical-rules/successor-v3-1";
import { canonicalV2Corpus } from "../../lib/clinical-rules/__tests__/support/canonical-v2-corpus";
import { canonicalActionClasses } from "../rule-studio/run-canonical-differential";

const outFile = process.argv[2] ?? "canonical-emission.json";

async function main() {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const checksum = calculateRuleSnapshotChecksum(snapshot);

  const emissions = canonicalV2Corpus.map((fixture) => {
    try {
      const evaluated = evaluateCanonicalClinicalFactsV2(snapshot, fixture.canonicalFacts);
      const r = evaluated.result;
      return {
        caseId: fixture.caseId,
        wasLegacyInputGap: fixture.wasLegacyInputGap,
        executable: true,
        error: null as string | null,
        actionClasses: [
          ...canonicalActionClasses(
            r.provisionalRecommendation,
            r.repeatInterval ?? "",
            r.referralDestination ?? ""
          ),
        ],
        actual: {
          provisionalRecommendation: r.provisionalRecommendation,
          repeatInterval: r.repeatInterval ?? null,
          referralDestination: r.referralDestination ?? null,
          urgency: (r as { urgency?: string }).urgency ?? null,
          riskLevel: (r as { riskLevel?: string }).riskLevel ?? null,
          reviewerRequirement: r.reviewerRequirement ?? null,
          mandatoryReviewerConfirmation: Boolean(r.mandatoryReviewerConfirmation),
          clinicianOnly: Boolean(r.clinicianOnly),
          missingInformation: r.missingInformation ?? [],
          matchedRuleIds: r.matchedRuleIds ?? [],
          branchPath: (r as unknown as { branchPath?: string[] }).branchPath ?? [],
          sourceReferences:
            (r as unknown as { sourceReferences?: string[] }).sourceReferences ?? [],
        },
      };
    } catch (error) {
      return {
        caseId: fixture.caseId,
        wasLegacyInputGap: fixture.wasLegacyInputGap,
        executable: false,
        error: error instanceof Error ? error.message : String(error),
        actionClasses: [] as string[],
        actual: null,
      };
    }
  });

  const executable = emissions.filter((e) => e.executable).length;

  writeFileSync(
    outFile,
    JSON.stringify(
      {
        system: "C_CANONICAL_CG-NCSP-3.1.0_SIMULATION",
        evaluationMode: "SIMULATION",
        authority: "NON_AUTHORITATIVE — legacy engine remains authoritative",
        rulesetChecksum: checksum,
        generatedAt: new Date().toISOString(),
        total: emissions.length,
        executable,
        emissions,
      },
      null,
      2
    )
  );

  console.log(
    `[C_CANONICAL_CG-NCSP-3.1.0] cases=${emissions.length} executable=${executable} checksum=${checksum.slice(0, 16)}… -> ${outFile}`
  );
}

void main();
