/**
 * Print the CHCH dataset assumptions as a clinician review pack.
 *
 * Generated from CHCH_PUBLIC_ASSUMPTIONS rather than written alongside it, so
 * the pack a clinician signs cannot drift from the values the engine actually
 * receives. Approval is recorded by a clinician's decision being transcribed
 * back into the manifest — never set here, and never set by engineering.
 *
 *   npx tsx scripts/demo/print-chch-assumptions.ts          # markdown
 *   npx tsx scripts/demo/print-chch-assumptions.ts --json   # machine-readable
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  CHCH_PUBLIC_ASSUMPTIONS,
  CHCH_PUBLIC_ASSUMPTIONS_VERSION,
  unapprovedAssumptions,
  type DatasetAssumption,
} from "@/lib/batch/chch-public-assumptions";
import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

function appliesToText(a: DatasetAssumption): string {
  if (a.appliesTo === "all") return `all ${CHCH_PUBLIC_DATASET.length} cases`;
  return a.appliesTo.join(", ");
}

function main() {
  const asJson = process.argv.includes("--json");
  const manifestHash = sha256("lib/batch/chch-public-assumptions.ts");
  const datasetHash = sha256("lib/batch/chch-public-dataset.ts");

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          assumptionsVersion: CHCH_PUBLIC_ASSUMPTIONS_VERSION,
          manifestSha256: manifestHash,
          datasetSha256: datasetHash,
          caseCount: CHCH_PUBLIC_DATASET.length,
          total: CHCH_PUBLIC_ASSUMPTIONS.length,
          unapproved: unapprovedAssumptions().length,
          assumptions: CHCH_PUBLIC_ASSUMPTIONS,
        },
        null,
        2
      )
    );
    return;
  }

  const lines: string[] = [];
  lines.push("# CHCH dataset assumptions — clinician review pack");
  lines.push("");
  lines.push(`Assumptions version: \`${CHCH_PUBLIC_ASSUMPTIONS_VERSION}\``);
  lines.push(`Manifest sha256: \`${manifestHash}\``);
  lines.push(`Dataset sha256: \`${datasetHash}\``);
  lines.push(`Cases: ${CHCH_PUBLIC_DATASET.length} · Assumptions: ${CHCH_PUBLIC_ASSUMPTIONS.length} · Awaiting decision: ${unapprovedAssumptions().length}`);
  lines.push("");
  lines.push(
    "The clinician-supplied workbook does not state these facts, and the engine requires a value for each. " +
      "Every value below is an assumption made to build the dataset, not something the source reports. " +
      "Please mark each APPROVE, REJECT or MODIFY. Nothing here is approved."
  );
  lines.push("");

  CHCH_PUBLIC_ASSUMPTIONS.forEach((a, i) => {
    lines.push(`## ${i + 1}. ${a.field}`);
    lines.push("");
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| **Current value** | \`${a.assumed}\` |`);
    lines.push(`| **Cases affected** | ${appliesToText(a)} |`);
    lines.push(`| **Why introduced** | ${a.basis} |`);
    lines.push(`| **Consequence if wrong** | ${a.consequenceIfWrong} |`);
    lines.push(`| **Rules affected** | ${a.rulesAffected.map((r) => `\`${r}\``).join(", ")} |`);
    lines.push(`| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |`);
    lines.push(`| **Clinician comment** | |`);
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push("**Reviewed by:** ______________________  **Role:** ______________________  **Date:** ____________");
  lines.push("");
  lines.push(
    "Decisions are transcribed back into `lib/batch/chch-public-assumptions.ts`. " +
      "Only explicit clinician decisions are incorporated; the acceptance run is then repeated before the evaluation build is frozen."
  );

  console.log(lines.join("\n"));
}

main();
