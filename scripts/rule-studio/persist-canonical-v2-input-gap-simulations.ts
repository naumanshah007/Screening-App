import assert from "node:assert/strict";

import { prisma } from "../../lib/prisma";
import { deterministicJson } from "../../lib/clinical-rules/checksum";
import { normalizedCanonicalFactsV2Snapshot } from "../../lib/clinical-rules/canonical-facts-v2";
import { evaluateClinicalCase } from "../../lib/clinical-rules/evaluator";
import { importNcspRulebookV21Successor } from "../../lib/clinical-rules/importer";
import { canonicalV2Corpus } from "../../lib/clinical-rules/__tests__/support/canonical-v2-corpus";

async function main() {
  const imported = await importNcspRulebookV21Successor({
    reason:
      "Persist synthetic CanonicalClinicalFactsV2 input-gap simulations; no publication or activation.",
  });
  const fixtures = canonicalV2Corpus.filter((fixture) => fixture.wasLegacyInputGap);
  assert.equal(fixtures.length, 18);

  let created = 0;
  let reused = 0;
  for (const fixture of fixtures) {
    const canonicalInputSnapshot = deterministicJson(
      normalizedCanonicalFactsV2Snapshot(fixture.canonicalFacts)
    );
    const existing = await prisma.ruleEvaluation.findFirst({
      where: {
        ruleVersionId: imported.ruleVersionId,
        evaluationMode: "SIMULATION",
        canonicalInputSnapshot,
      },
    });
    if (existing) {
      reused += 1;
      continue;
    }
    const evaluated = await evaluateClinicalCase({
      canonicalFactsV2: fixture.canonicalFacts,
      ruleVersionId: imported.ruleVersionId,
      evaluationMode: "SIMULATION",
    });
    assert.equal(evaluated.result.ruleVersionDisplay, "CG-NCSP-3.1.0");
    assert.equal(evaluated.result.ruleSetChecksum, imported.checksum);
    assert.ok(evaluated.result.branchPath.length >= 2);
    assert.ok(evaluated.result.sourceReferences.length > 0);
    created += 1;
  }

  const version = await prisma.clinicalRuleVersion.findUniqueOrThrow({
    where: { id: imported.ruleVersionId },
    include: { _count: { select: { evaluations: true, activations: true } } },
  });
  assert.equal(version.status, "DRAFT");
  assert.equal(version.publishedAt, null);
  assert.equal(version._count.activations, 0);

  console.log(
    JSON.stringify(
      {
        version: version.displayVersion,
        checksum: version.checksum,
        status: version.status,
        created,
        reused,
        verifiedCases: fixtures.length,
        totalVersionEvaluations: version._count.evaluations,
        liveActivations: version._count.activations,
        publication: version.publishedAt,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
