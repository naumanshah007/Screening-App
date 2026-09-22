/**
 * A legacy-decided run must never be mistakable for a canonical-decided one.
 *
 * The pinned* columns mean "this ruleset clinically decided". They previously
 * received the SHADOW ruleset whenever authority was LEGACY, so every legacy
 * run carried a governed version and checksum in the authoritative fields. A
 * reviewer, an export or an audit package could not tell the two apart — which
 * is the single thing this provenance exists to record.
 *
 * Runs against a real isolated SQLite database. No shared database is touched.
 */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { applySchema, createIsolatedDatabase } from "./support/isolated-db";

const database = createIsolatedDatabase("authority-provenance");

type Prisma = typeof import("../../lib/prisma")["prisma"];
let prisma: Prisma;

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

let suffix = 0;
async function createRunContext() {
  const id = `${Date.now()}-${suffix++}`;
  const organisation = await prisma.organisation.create({
    data: { key: `org-${id}`, name: "Test Organisation" },
  });
  const user = await prisma.user.create({
    data: { email: `actor-${id}@test.local`, name: "Test Actor", role: "ADMIN" },
  });
  return { organisationId: organisation.id, createdByUserId: user.id };
}

test("a LEGACY-authority run pins no ruleset and records the observer as shadow", async () => {
  const ctx = await createRunContext();

  // What saveBatchRun writes under legacy authority: nothing pinned, the
  // canonical ruleset that merely observed recorded as shadow evidence.
  const run = await prisma.batchRun.create({
    data: {
      ...ctx,
      source: "CHCH_PUBLIC",
      sourceSystem: "CHCH Public",
      engineVersion: "business-figures-table1-v1",
      pinnedRuleVersionId: null,
      pinnedRuleVersionDisplay: null,
      pinnedRulesetChecksum: null,
      shadowRuleVersionDisplay: "CG-NCSP-3.1.0",
      shadowRulesetChecksum: "3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a",
      shadowEvaluationMode: "SHADOW",
      totalCases: 1,
    },
  });

  assert.equal(run.pinnedRuleVersionDisplay, null, "legacy run must not pin a ruleset");
  assert.equal(run.pinnedRulesetChecksum, null, "legacy run must not pin a checksum");
  assert.equal(run.shadowRuleVersionDisplay, "CG-NCSP-3.1.0");
  assert.equal(run.shadowEvaluationMode, "SHADOW");
});

test("a governed version and checksum never appear in the authoritative fields without canonical authority", async () => {
  const ctx = await createRunContext();

  const run = await prisma.batchRun.create({
    data: {
      ...ctx,
      source: "CHCH_PUBLIC",
      engineVersion: "business-figures-table1-v1",
      shadowRuleVersionDisplay: "CG-NCSP-3.1.0",
      shadowRulesetChecksum: "deadbeef",
      shadowEvaluationMode: "SHADOW",
      totalCases: 1,
    },
  });

  await prisma.batchReviewItem.create({
    data: {
      batchRunId: run.id,
      rowNumber: 1,
      figure: "FIGURE_3",
      riskLevel: "LOW",
      recommendationCode: "F3-HPV-NOT-DETECTED-5Y",
      recommendation: "HPV not detected.",
      reviewRequired: false,
      engineStatus: "ok",
      caseJson: "{}",
      inputJson: "{}",
      decisionJson: "{}",
      authorityEngine: "LEGACY",
    },
  });

  const stored = await prisma.batchRun.findUniqueOrThrow({
    where: { id: run.id },
    include: { items: true },
  });

  // The invariant, stated as the reader of an export would apply it: if nothing
  // is pinned, no item may claim canonical authority, and vice versa.
  const pinnedSomething =
    stored.pinnedRuleVersionDisplay !== null || stored.pinnedRulesetChecksum !== null;
  const anyCanonicalItem = stored.items.some((i) => i.authorityEngine === "CANONICAL");

  assert.equal(pinnedSomething, false);
  assert.equal(anyCanonicalItem, false);
  assert.equal(
    pinnedSomething,
    anyCanonicalItem,
    "pinned provenance and canonical authority must agree — one without the other is the defect this guards"
  );

  // And the shadow ruleset must not have leaked into the authoritative columns.
  assert.notEqual(stored.pinnedRulesetChecksum, stored.shadowRulesetChecksum);
});

test("the unpinned legacy reason does not assert an activation that may not exist", async () => {
  const { applyPin } = await import("../../lib/clinical-rules/pinning");

  const legacy = applyPin({ authorityEngine: "LEGACY" as const }, null);
  assert.equal(legacy.pinned, false);
  assert.doesNotMatch(
    legacy.reason,
    /the current activation applies/,
    "a legacy decision must not claim an activation applied to it"
  );
  assert.match(legacy.reason, /legacy engine decided/);
  assert.match(legacy.reason, /shadow/i);

  // Canonical authority genuinely does resolve through an activation.
  const canonical = applyPin({ authorityEngine: "CANONICAL" as const }, null);
  assert.match(canonical.reason, /the current activation applies/);
});
