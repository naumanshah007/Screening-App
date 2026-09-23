/**
 * Clear synthetic case identifiers out of the NHI column.
 *
 * WHAT WENT WRONG
 * ---------------
 * `saveBatchRun` used to write `nhi: c.nhi ?? c.source.externalPatientId`, so
 * every CHCH row persisted before that fallback was removed holds "chch-001" in
 * the column the rest of the application reads as a National Health Index. The
 * code fix only protects NEW writes; these rows still carry it.
 *
 * WHAT THIS REPAIRS, AND WHAT IT WILL NOT TOUCH
 * ---------------------------------------------
 * It clears `nhi` — and only `nhi` — on rows where that column holds a value
 * identical to the row's own `externalPatientId` AND that identifier is a
 * synthetic case ID. Nothing else is written:
 *
 *   - the clinical decision, its code, priority, risk and safety outcome
 *   - decisionJson, inputJson, caseJson
 *   - the reviewer's disposition, note and override reason
 *   - the rule evaluation, its pin and its checksum
 *   - episode links, usage events and existing audit rows
 *
 * REVERSIBLE
 * ----------
 * The cleared value is `externalPatientId`, which is untouched and still on the
 * row, so the change can be undone exactly. Each repair writes an audit record
 * carrying the previous value.
 *
 * SAFE ON A REAL NHI
 * ------------------
 * A genuine NHI never equals a `chch-NNN` identifier, and the guard requires
 * both the pattern match and equality with the external ID. Run with
 * `--dry-run` first; that is the default.
 *
 *   DATABASE_URL=... npx tsx scripts/demo/repair-synthetic-nhi.ts          # report only
 *   DATABASE_URL=... npx tsx scripts/demo/repair-synthetic-nhi.ts --apply  # write
 */

import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import { prisma } from "@/lib/prisma";

/** Identifiers that are case IDs rather than NHIs. */
const SYNTHETIC_ID = /^chch-\d{3}$/;

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Database : ${getDatabaseRuntimeSummary().displayTarget}`);
  console.log(`Mode     : ${apply ? "APPLY" : "DRY RUN (pass --apply to write)"}`);

  const candidates = await prisma.batchReviewItem.findMany({
    where: { nhi: { not: null } },
    select: { id: true, nhi: true, externalPatientId: true, recommendationCode: true },
  });

  const repairable = candidates.filter(
    (item) =>
      item.nhi !== null &&
      item.nhi === item.externalPatientId &&
      SYNTHETIC_ID.test(item.nhi)
  );
  const leftAlone = candidates.length - repairable.length;

  console.log(`\nRows with an NHI value : ${candidates.length}`);
  console.log(`Synthetic, repairable  : ${repairable.length}`);
  console.log(`Left alone (real NHIs) : ${leftAlone}`);

  if (repairable.length === 0) {
    console.log("\nNothing to repair.");
    await prisma.$disconnect();
    return;
  }

  if (!apply) {
    for (const item of repairable.slice(0, 5)) {
      console.log(`  would clear nhi="${item.nhi}" (externalPatientId stays "${item.externalPatientId}")`);
    }
    console.log("\nDry run only. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  for (const item of repairable) {
    await prisma.batchReviewItem.update({
      where: { id: item.id },
      data: { nhi: null },
    });
    await prisma.auditLog.create({
      data: {
        action: "SYNTHETIC_IDENTITY_REPAIR",
        entity: "BatchReviewItem",
        entityId: item.id,
        severity: "INFO",
        // The previous value, so the change is exactly reversible.
        oldValue: JSON.stringify({ nhi: item.nhi }),
        newValue: JSON.stringify({
          nhi: null,
          externalPatientId: item.externalPatientId,
          reason:
            "A synthetic evaluation case ID was stored in the NHI column by the " +
            "pre-fix externalPatientId fallback. Cleared; no clinical decision, " +
            "disposition, evaluation or audit record was altered.",
        }),
      },
    });
  }

  console.log(`\nRepaired ${repairable.length} rows. Clinical decisions untouched.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
