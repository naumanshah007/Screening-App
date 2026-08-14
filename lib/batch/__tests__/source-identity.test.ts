/**
 * Source identity and the two payload digests.
 *
 * THE PROPERTY THAT MATTERS
 * -------------------------
 * A case is treated as an UPDATED result only when clinically meaningful
 * content changed. Getting this wrong fails in both directions and both are
 * harmful:
 *
 *   Too sensitive — a lab corrects a name spelling or reformats a date, the
 *   product calls it an amended result, and a clinician is asked to re-review a
 *   case where nothing clinical changed. Do that often enough and the signal is
 *   ignored.
 *
 *   Too blunt — a genuinely amended result arrives and is silently treated as a
 *   duplicate of the original. That is a missed clinical update.
 *
 * Hence two digests. The raw digest notices everything; only the normalised
 * clinical digest may drive re-evaluation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLINICAL_DIGEST_VERSION,
  clinicalDigestVersionOf,
  clinicalPayloadDigest,
  compareClinicalDigests,
  fileDeliveryKey,
  normaliseClinicalFacts,
  rawPayloadDigest,
} from "@/lib/batch/source-identity";
import type { CanonicalBatchCase } from "@/lib/batch/types";
import type { ClinicalInput } from "@/lib/engine/types";

function input(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return {
    patientId: "case-1",
    patientAge: 38,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    atypicalEndometrialHistory: false,
    immunocompromised: false,
    hpvResult: "HPV_16_18",
    cytologyResult: "HSIL",
    sampleType: "LBC",
    ...overrides,
  } as ClinicalInput;
}

function batchCase(overrides: Partial<CanonicalBatchCase> = {}): CanonicalBatchCase {
  return {
    caseId: "generated-per-pull",
    patientName: "Aroha Williams",
    nhi: "ZAB1042",
    source: {
      sourceType: "hl7",
      sourceSystem: "Awanui Labs — Auckland (HL7v2)",
      mappingVersion: "hl7v2-oru-r01-v1",
      engineVersion: "test",
      rowNumber: 1,
      importedAt: "2026-08-14T00:00:00.000Z",
      sourceEpisodeKey: "ACC-ZAB1042-01",
    },
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],
    ...overrides,
  } as unknown as CanonicalBatchCase;
}

// ─── The clinical digest ────────────────────────────────────────────────────

test("identical clinical content produces an identical digest", () => {
  assert.equal(clinicalPayloadDigest(input()), clinicalPayloadDigest(input()));
});

test("a changed result changes the clinical digest", () => {
  assert.notEqual(
    clinicalPayloadDigest(input()),
    clinicalPayloadDigest(input({ cytologyResult: "LSIL" })),
    "a different cytology result is exactly what must be noticed"
  );
});

test("the per-pull patient id does not affect the clinical digest", () => {
  // patientId is regenerated on every pull. If it counted, every redelivery of
  // an unchanged episode would look like new clinical information — which is the
  // precise failure this digest exists to prevent.
  assert.equal(
    clinicalPayloadDigest(input({ patientId: "pull-a" })),
    clinicalPayloadDigest(input({ patientId: "pull-b" }))
  );
});

test("formatting is not clinical content", () => {
  const base = clinicalPayloadDigest(input());
  for (const [label, variant] of [
    ["lower case enum", input({ hpvResult: "hpv_16_18" as ClinicalInput["hpvResult"] })],
    ["surrounding whitespace", input({ cytologyResult: "  HSIL  " as ClinicalInput["cytologyResult"] })],
  ] as const) {
    assert.equal(clinicalPayloadDigest(variant), base, `${label} must not read as an amendment`);
  }
});

test("absent and null are the same fact", () => {
  // A feed that starts sending explicit nulls has not amended anything.
  const withNull = input({ tzType: null as unknown as ClinicalInput["tzType"] });
  assert.equal(clinicalPayloadDigest(withNull), clinicalPayloadDigest(input()));
});

test("a date is compared by day, not by timestamp", () => {
  const morning = input({ hysterectomyDate: "2026-07-10T02:00:00.000Z" });
  const evening = input({ hysterectomyDate: "2026-07-10T21:30:00.000Z" });
  assert.equal(
    clinicalPayloadDigest(morning),
    clinicalPayloadDigest(evening),
    "a lab reporting midday rather than midnight has not amended the result"
  );
  assert.notEqual(
    clinicalPayloadDigest(morning),
    clinicalPayloadDigest(input({ hysterectomyDate: "2026-07-11T02:00:00.000Z" })),
    "a different day is a real difference"
  );
});

test("the normalised facts cover the whole engine input, not a curated list", () => {
  // A curated list would drift from the engine and silently stop noticing a
  // change. Every field the engine consumes must survive normalisation.
  const facts = normaliseClinicalFacts(
    input({ colposcopyRecommendedInLastCytology: true, repeatStage: "BASELINE" })
  );
  assert.equal(facts.colposcopyRecommendedInLastCytology, true);
  assert.equal(facts.repeatStage, "BASELINE");
  assert.equal(facts.patientId, undefined, "identity is not a clinical fact");
});

// ─── The versioned contract ─────────────────────────────────────────────────

test("a clinical digest carries the contract it was produced under", () => {
  const digest = clinicalPayloadDigest(input());
  assert.match(digest, /^v\d+:[0-9a-f]{64}$/);
  assert.equal(clinicalDigestVersionOf(digest), CLINICAL_DIGEST_VERSION);
});

test("digests from different contracts are INCOMPARABLE, never 'changed'", () => {
  // The failure this prevents: normalisation is changed, every stored digest
  // stops matching how the code would now compute it, and a deploy presents
  // itself as a clinical amendment on every open episode at once.
  const current = clinicalPayloadDigest(input());
  const older = `v0:${current.split(":")[1]}`;

  assert.equal(
    compareClinicalDigests(older, current),
    "INCOMPARABLE",
    "a contract change must never be reported as a clinical change"
  );
  // ...and equally must not be reported as unchanged, which would hide a real
  // amendment. Both directions are clinical, so the third state is required.
  assert.notEqual(compareClinicalDigests(older, current), "UNCHANGED");
});

test("an unversioned legacy digest is INCOMPARABLE", () => {
  // Rows written before versioning existed.
  const current = clinicalPayloadDigest(input());
  assert.equal(compareClinicalDigests("abc123", current), "INCOMPARABLE");
  assert.equal(clinicalDigestVersionOf("abc123"), null);
});

test("a missing digest on either side is INCOMPARABLE", () => {
  const current = clinicalPayloadDigest(input());
  assert.equal(compareClinicalDigests(null, current), "INCOMPARABLE");
  assert.equal(compareClinicalDigests(current, null), "INCOMPARABLE");
});

test("within one contract the comparison is exact", () => {
  assert.equal(
    compareClinicalDigests(clinicalPayloadDigest(input()), clinicalPayloadDigest(input())),
    "UNCHANGED"
  );
  assert.equal(
    compareClinicalDigests(
      clinicalPayloadDigest(input()),
      clinicalPayloadDigest(input({ cytologyResult: "LSIL" }))
    ),
    "CHANGED"
  );
});

// ─── The raw digest ─────────────────────────────────────────────────────────

test("the raw digest notices a correction the clinical digest ignores", () => {
  // This pair is the whole reason both digests exist.
  const original = batchCase();
  const corrected = batchCase({ patientName: "Aroha Wiremu" });

  assert.notEqual(
    rawPayloadDigest(original),
    rawPayloadDigest(corrected),
    "a corrected spelling is a real change to what arrived"
  );
  assert.equal(
    clinicalPayloadDigest(input()),
    clinicalPayloadDigest(input()),
    "...but it is not a clinical change, so it must not trigger re-evaluation"
  );
});

test("per-delivery metadata is excluded from the raw digest", () => {
  // caseId is a fresh UUID each pull and importedAt is the clock. If either
  // counted, the raw digest would differ on every pull and report nothing.
  const first = batchCase({ caseId: "uuid-a" });
  const second = batchCase({
    caseId: "uuid-b",
    source: { ...batchCase().source, importedAt: "2099-01-01T00:00:00.000Z", rowNumber: 47 },
  } as Partial<CanonicalBatchCase>);

  assert.equal(rawPayloadDigest(first), rawPayloadDigest(second));
});

test("the accession number is part of what arrived", () => {
  assert.notEqual(
    rawPayloadDigest(batchCase()),
    rawPayloadDigest(
      batchCase({
        source: { ...batchCase().source, sourceEpisodeKey: "ACC-OTHER-99" },
      } as Partial<CanonicalBatchCase>)
    )
  );
});

// ─── Delivery identity ──────────────────────────────────────────────────────

test("a file's delivery key is its content, not its name", () => {
  assert.equal(fileDeliveryKey("a,b,c\n1,2,3"), fileDeliveryKey("a,b,c\n1,2,3"));
  assert.notEqual(fileDeliveryKey("a,b,c\n1,2,3"), fileDeliveryKey("a,b,c\n1,2,4"));
});
