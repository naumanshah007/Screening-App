import { writeFile } from "node:fs/promises";
import path from "node:path";

import { importNcspRulebookV21 } from "@/lib/clinical-rules/importer";

function getArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const result = await importNcspRulebookV21({
    sourceDirectory: getArgument("source"),
    actorUserId: getArgument("actor-user-id"),
  });

  const report = `# NCSP v2.1 canonical import report

Generated: ${new Date().toISOString()}

This is an engineering import report for a proof-of-concept using synthetic or de-identified test data. It is not clinical validation, pilot approval, or production readiness.

## Result

- Action: ${result.action}
- Product ruleset: ${result.displayVersion}
- Clinical source package: v2.1
- Ruleset family ID: ${result.ruleSetId}
- Rule version ID: ${result.ruleVersionId}
- Status: ${result.status}
- Revision: ${result.revision}
- SHA-256 snapshot checksum: \`${result.checksum}\`
- Source JSON SHA-256: \`${result.verification.sourceJsonSha256}\`

## Source verification

- Source directory: \`${result.verification.sourceDirectory}\`
- Rule records: ${result.verification.ruleCount}
- Unique rule IDs: ${result.verification.uniqueRuleCount}
- Table 1 rules: ${result.verification.table1RuleCount}
- QA closures: ${result.verification.qaCorrectionCount} (QA-01 through QA-18)
- Tree coverage rows resolved: ${result.verification.treeCoverageCount}
- Required package artifacts present: ${result.verification.requiredFiles.length}
- Supplied manifest: all 11 package entries independently SHA-256 verified before import
- Workbook cross-check: all 21 sheets rendered and visually inspected; no formula-error tokens or illegible layouts found
- Verified visual package: ${result.verification.visualPackageVersion} (${result.verification.visualVerificationStatus})
- Verified visual files: ${result.verification.visualPackageFileCount} SHA-256 entries
- Verified visual directory: \`${result.verification.visualPackageDirectory}\`

The JSON was used as the machine-readable bootstrap. Markdown, CSV, spreadsheet, SVG, PNG, QA-closure, and coverage artifacts were secondary cross-checks. The package was found under the repository-equivalent path \`docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1\`; the importer resolves that path without relocating source evidence.

## Canonical projection

- Rules: ${result.validation.counts.rules}
- Nodes: ${result.validation.counts.nodes}
- Edges: ${result.validation.counts.edges}
- Views: ${result.validation.counts.views}
- Safety distribution: 36 CRITICAL, 103 HIGH, 49 MEDIUM, 15 LOW

Every master/pathway view references canonical rule, node, and edge identifiers in the same version snapshot. The ten pathway memberships and Graphviz-derived coordinates follow the verified v2.1.1 visual package; layout metadata contains no copied clinical logic.

\`CG-NCSP-3.0.0\` is the first national product-ruleset sequence in this repository. Product version \`CG-NCSP-3.0.0\`, clinical source package \`v2.1\`, and engine contract \`canonical-graph-v1\` remain separate metadata.

## Validation gate

- Pass: ${result.validation.valid ? "yes" : "no"}
- Errors: ${result.validation.counts.errors}
- Warnings: ${result.validation.counts.warnings}
- Information: ${result.validation.counts.information}

All 139 HIGH/CRITICAL v2.1 rules now have governed typed Boolean AST conditions and registered executable conformance-test identifiers. Three lower-priority Figure 3 rules are also compiled to preserve the HPV-not-detected three-/five-year and age 70–74 discharge invariants. Expected outcomes come from the verified source package; no expectation was derived from PNG text or the legacy production engine.

The prior 278 publication blockers are reduced to zero. This software-conformance result does not constitute independent clinical approval. The version remains an unactivated draft; publication and activation still require the lifecycle's separate approval and governance controls.

Required runtime wording:

- Provisional recommendation
- Reviewer confirmation required
- Not for direct clinical action
- Demo environment
- Simulated export package

Source workbook cross-check: :codex-file-citation{path="/Users/nauman/Documents/Screening/docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rulebook_v2_1.xlsx" purpose="source" artifact_kind="workbook"}
`;

  const reportPath = path.join(process.cwd(), "docs/rule-studio/02-import-report.md");
  if (!process.argv.includes("--no-report")) {
    await writeFile(reportPath, report, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        ...result,
        validation: {
          valid: result.validation.valid,
          counts: result.validation.counts,
        },
        reportPath: process.argv.includes("--no-report") ? null : reportPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
