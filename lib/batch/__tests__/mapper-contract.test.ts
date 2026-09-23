/**
 * The canonical batch case → ClinicalInput contract.
 *
 * A field that exists on both models but is not forwarded is invisible: the
 * batch pipeline accepts it, stores it, shows it in the UI, and the engine
 * never sees it. `testOfCureStatus` was dropped this way, and the effect was
 * larger than the field — Figure 2 branches on it, so every batch case
 * reaching Figure 2 fell to the same safety stop regardless of its history.
 *
 * Nothing catches that class of defect at runtime and the engine tests cannot
 * see it, because they build ClinicalInput by hand and never call the mapper.
 * So this test reads the field sets directly and fails when they diverge.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { mapCanonicalToClinicalInput } from "../processor";
import type { CanonicalBatchCase } from "../types";

const root = process.cwd();

function interfaceFields(file: string, name: string): string[] {
  const src = readFileSync(path.join(root, file), "utf8");
  const match = src.match(new RegExp(`(?:export )?interface ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `interface ${name} not found in ${file}`);
  return [...match[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*)\??\s*:/gm)].map((m) => m[1]);
}

/**
 * Fields on CanonicalBatchCase that the engine has no concept of. They carry
 * identity, provenance and validation state for the worklist and the audit
 * trail, and must never be forwarded as clinical facts.
 */
const DISPLAY_AND_PROVENANCE_ONLY = new Set([
  "caseId",
  "label",
  "source",
  "patientName",
  "nhi",
  "gpPractice",
  "receivedDate",
  "validationStatus",
  "validationErrors",
  "validationWarnings",
  // Identity semantics, not a clinical fact: it says whether the external
  // identifier is an NHI so storage and display cannot assume it is one.
  "identifierKind",
  // The verbatim source row. The engine-facing facts are DERIVED from it, so
  // forwarding it to ClinicalInput would be forwarding the same information
  // twice in two shapes. It is preserved for display, persistence and audit.
  "sourceEvidence",
]);

test("every field on both models is forwarded to the engine", () => {
  const canonical = new Set(interfaceFields("lib/batch/types.ts", "CanonicalBatchCase"));
  const clinical = interfaceFields("lib/engine/types.ts", "ClinicalInput");

  const mapperSrc = readFileSync(path.join(root, "lib/batch/processor.ts"), "utf8");
  const body = mapperSrc.slice(
    mapperSrc.indexOf("export function mapCanonicalToClinicalInput"),
    mapperSrc.indexOf("// ─── Batch Processor")
  );
  const forwarded = new Set(
    [...body.matchAll(/batchCase\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1])
  );

  const shared = clinical.filter((f) => canonical.has(f));
  const dropped = shared.filter((f) => !forwarded.has(f));

  assert.deepEqual(
    dropped,
    [],
    `Field(s) exist on both CanonicalBatchCase and ClinicalInput but are never forwarded: ${dropped.join(", ")}. ` +
      `Forward them in mapCanonicalToClinicalInput, transform them with a documented reason, ` +
      `or add them to DISPLAY_AND_PROVENANCE_ONLY if they are genuinely not clinical facts.`
  );
});

test("every canonical field is either an engine fact or declared display-only", () => {
  const canonical = interfaceFields("lib/batch/types.ts", "CanonicalBatchCase");
  const clinical = new Set(interfaceFields("lib/engine/types.ts", "ClinicalInput"));

  const unclassified = canonical.filter(
    (f) => !clinical.has(f) && !DISPLAY_AND_PROVENANCE_ONLY.has(f)
  );

  assert.deepEqual(
    unclassified,
    [],
    `Field(s) on CanonicalBatchCase are neither an engine field nor declared display-only: ${unclassified.join(", ")}. ` +
      `A new clinical field needs a ClinicalInput counterpart and a mapper entry; ` +
      `a new display field belongs in DISPLAY_AND_PROVENANCE_ONLY.`
  );
});

test("the declared display-only list stays accurate", () => {
  const canonical = new Set(interfaceFields("lib/batch/types.ts", "CanonicalBatchCase"));
  const clinical = new Set(interfaceFields("lib/engine/types.ts", "ClinicalInput"));

  for (const field of DISPLAY_AND_PROVENANCE_ONLY) {
    assert.ok(canonical.has(field), `${field} is declared display-only but no longer exists`);
    assert.ok(
      !clinical.has(field),
      `${field} is declared display-only but the engine now has a field of that name — it may need forwarding`
    );
  }
});

test("testOfCureStatus reaches the engine", () => {
  // The specific regression. Figure 2 branches on this value to choose between
  // returning to routine screening, completing Test of Cure, and stopping for
  // records; undefined collapses all three into the stop.
  const base = {
    caseId: "contract-test",
    source: {
      sourceType: "demo" as const,
      importedAt: "2026-01-01T00:00:00.000Z",
      rowNumber: 1,
      mappingVersion: "test",
      engineVersion: "test",
    },
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    validationStatus: "valid" as const,
    validationErrors: [],
    validationWarnings: [],
  } satisfies Partial<CanonicalBatchCase> as CanonicalBatchCase;

  for (const status of ["COMPLETE", "INCOMPLETE", "REQUIRED"] as const) {
    const mapped = mapCanonicalToClinicalInput({ ...base, testOfCureStatus: status });
    assert.equal(mapped.testOfCureStatus, status);
  }

  // Absent stays absent — the mapper must not invent a value.
  assert.equal(mapCanonicalToClinicalInput(base).testOfCureStatus, undefined);
});

test("an outstanding colposcopy from a previous episode is representable", () => {
  // Figure 2's first branch is unreachable without these, so a case whose
  // referral outcome was never documented could not be expressed at all.
  const base = {
    caseId: "contract-test-colp",
    source: {
      sourceType: "demo" as const,
      importedAt: "2026-01-01T00:00:00.000Z",
      rowNumber: 1,
      mappingVersion: "test",
      engineVersion: "test",
    },
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    validationStatus: "valid" as const,
    validationErrors: [],
    validationWarnings: [],
  } satisfies Partial<CanonicalBatchCase> as CanonicalBatchCase;

  const mapped = mapCanonicalToClinicalInput({
    ...base,
    colposcopyRecommendedInLastCytology: true,
    colposcopyCompletedForLastRecommendation: false,
  });
  assert.equal(mapped.colposcopyRecommendedInLastCytology, true);
  assert.equal(mapped.colposcopyCompletedForLastRecommendation, false);

  // Tri-state: silence is not "no colposcopy was recommended".
  const silent = mapCanonicalToClinicalInput(base);
  assert.equal(silent.colposcopyRecommendedInLastCytology, undefined);
  assert.equal(silent.colposcopyCompletedForLastRecommendation, undefined);
});
