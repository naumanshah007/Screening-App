/**
 * Episode classification.
 *
 * THE TWO FAILURE MODES
 * ---------------------
 * Both are clinical, and they pull in opposite directions:
 *
 *   Suppressing a real result. A screening result that is withheld is
 *   indistinguishable from one that was lost. This is the worse failure, which
 *   is why only a deterministic identifier match may ever stop a case being
 *   processed, and why a resemblance may only advise.
 *
 *   Missing an amendment. An amended report that is treated as a duplicate is a
 *   clinical update that never reaches a reviewer. This is why UPDATED is
 *   decided on the normalised clinical digest and is always processable.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyEpisode,
  strongFingerprint,
  summariseClassifications,
  weakFingerprint,
  type KnownEpisode,
} from "@/lib/batch/episode-classification";

const ORG = "org-1";

function known(overrides: Partial<KnownEpisode> = {}): KnownEpisode {
  return {
    episodeId: "episode-1",
    isCompleted: false,
    isAwaitingReview: false,
    clinicalPayloadDigest: "v1:clinical-a",
    sourceEpisodeKey: "ACC-1",
    sourceFacility: "Awanui Labs — Auckland",
    collectedOn: new Date("2026-08-03T00:00:00.000Z"),
    lastSeenAt: new Date("2026-08-03T00:00:00.000Z"),
    ...overrides,
  };
}

const identity = {
  organisationId: ORG,
  sourceFacility: "Awanui Labs — Auckland",
  sourceEpisodeKey: "ACC-1",
  nhi: "ZAB1042",
  testType: "HPV_LBC",
  collectedOn: "2026-08-03",
};

// ─── Fingerprints ───────────────────────────────────────────────────────────

test("a strong fingerprint requires an accession number", () => {
  assert.equal(
    strongFingerprint({ organisationId: ORG, nhi: "ZAB1042" }),
    null,
    "no specimen identifier means no certain identity — and null must never match"
  );
  assert.ok(strongFingerprint(identity));
});

test("fingerprints ignore formatting but not content", () => {
  assert.equal(
    strongFingerprint(identity),
    strongFingerprint({ ...identity, sourceEpisodeKey: "  acc-1  " })
  );
  assert.notEqual(
    strongFingerprint(identity),
    strongFingerprint({ ...identity, sourceEpisodeKey: "ACC-2" })
  );
});

test("fingerprints never cross organisations", () => {
  // The single most important scoping property: one customer's episode can
  // never match another's.
  assert.notEqual(
    strongFingerprint(identity),
    strongFingerprint({ ...identity, organisationId: "org-2" })
  );
  assert.notEqual(
    weakFingerprint(identity),
    weakFingerprint({ ...identity, organisationId: "org-2" })
  );
});

test("the weak fingerprint compares collection day, not timestamp", () => {
  assert.equal(
    weakFingerprint({ ...identity, collectedOn: "2026-08-03T01:00:00.000Z" }),
    weakFingerprint({ ...identity, collectedOn: "2026-08-03T23:00:00.000Z" })
  );
});

// ─── Classification ─────────────────────────────────────────────────────────

test("an unseen episode is new", () => {
  const result = classifyEpisode({ identity, clinicalPayloadDigest: "v1:clinical-a" });
  assert.equal(result.classification, "NEW");
  assert.equal(result.processable, true);
  assert.equal(result.matchedEpisodeId, null);
});

test("changed clinical content is an update, and is always processable", () => {
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-b",
    strongMatch: known({ isCompleted: true }),
  });
  assert.equal(result.classification, "UPDATED");
  assert.equal(
    result.processable,
    true,
    "an amended result is precisely the case that must be evaluated again"
  );
});

test("an update outranks a completed decision", () => {
  // Order matters: if COMPLETED were checked first, an amended report on a
  // finished case would be dismissed as a duplicate and never reviewed.
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-b",
    strongMatch: known({ isCompleted: true, isAwaitingReview: true }),
  });
  assert.equal(result.classification, "UPDATED");
});

test("unchanged clinical content on a completed episode is not reprocessed", () => {
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-a",
    strongMatch: known({ isCompleted: true }),
  });
  assert.equal(result.classification, "COMPLETED");
  assert.equal(result.processable, false);
  assert.match(result.explanation, /Already reviewed and completed/);
  assert.match(result.explanation, /accession ACC-1/, "must be explained by identifier");
});

test("unchanged clinical content already queued is not queued twice", () => {
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-a",
    strongMatch: known({ isAwaitingReview: true }),
  });
  assert.equal(result.classification, "ALREADY_IN_REVIEW");
  assert.equal(result.processable, false);
});

test("a known episode that was never sent for review is processable", () => {
  // Pulled once, never submitted. Refusing it would strand the case.
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-a",
    strongMatch: known({ isCompleted: false, isAwaitingReview: false }),
  });
  assert.equal(result.classification, "NEW");
  assert.equal(result.processable, true);
});

test("a cosmetic correction is not an update", () => {
  // The reason two digests exist. Same clinical digest, different raw payload.
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:clinical-a",
    strongMatch: known({ clinicalPayloadDigest: "v1:clinical-a", isCompleted: true }),
  });
  assert.equal(result.classification, "COMPLETED");
  assert.notEqual(result.classification, "UPDATED");
});

// ─── The safety property ────────────────────────────────────────────────────

test("a weak match is advisory and NEVER suppresses processing", () => {
  const result = classifyEpisode({
    identity: { ...identity, sourceEpisodeKey: null },
    clinicalPayloadDigest: "v1:clinical-a",
    weakMatches: [known({ isCompleted: true })],
  });
  assert.equal(result.classification, "POSSIBLE_DUPLICATE");
  assert.equal(
    result.processable,
    true,
    "a resemblance is not proof; withholding a screening result on one is how a real result is lost"
  );
  assert.match(result.explanation, /no matching accession number to confirm it/);
});

test("no classification other than a strong match can withhold a case", () => {
  // Stated as a property rather than a case: only a strong identifier match may
  // ever set processable=false.
  const withoutStrong = [
    classifyEpisode({ identity, clinicalPayloadDigest: "x" }),
    classifyEpisode({
      identity: { ...identity, sourceEpisodeKey: null },
      clinicalPayloadDigest: "x",
      weakMatches: [known({ isCompleted: true }), known({ isAwaitingReview: true })],
    }),
  ];
  for (const result of withoutStrong) {
    assert.equal(result.processable, true, `${result.classification} must stay processable`);
  }
});

test("every explanation names identifiers, never a fingerprint", () => {
  const results = [
    classifyEpisode({ identity, clinicalPayloadDigest: "b", strongMatch: known() }),
    classifyEpisode({ identity, clinicalPayloadDigest: "v1:clinical-a", strongMatch: known({ isCompleted: true }) }),
    classifyEpisode({
      identity: { ...identity, sourceEpisodeKey: null },
      clinicalPayloadDigest: "x",
      weakMatches: [known()],
    }),
  ];
  for (const result of results) {
    assert.doesNotMatch(
      result.explanation,
      /[0-9a-f]{16,}/,
      `a hash is a lookup key, not an explanation: ${result.explanation}`
    );
    assert.ok(result.explanation.length > 0);
  }
});

test("a contract change is never presented as a clinical amendment", () => {
  // The stored digest was produced under an older normalisation contract, so
  // whether anything changed is genuinely unknown. Asserting UPDATED here would
  // turn a deploy into a wave of false amendments across every open episode.
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:aaaa",
    strongMatch: known({ clinicalPayloadDigest: "v0:bbbb", isCompleted: true }),
  });
  assert.notEqual(result.classification, "UPDATED");
  assert.equal(
    result.processable,
    true,
    "an indeterminate comparison must not suppress the case either"
  );
  assert.match(result.explanation, /cannot be determined/);
});

test("an unversioned stored digest is also indeterminate, not unchanged", () => {
  // Rows written before the contract was versioned. Reporting COMPLETED here
  // would silently hide a genuine amendment.
  const result = classifyEpisode({
    identity,
    clinicalPayloadDigest: "v1:aaaa",
    strongMatch: known({ clinicalPayloadDigest: "legacy-digest", isCompleted: true }),
  });
  assert.notEqual(result.classification, "COMPLETED");
  assert.equal(result.processable, true);
});

test("the summary counts what the intake screen reports", () => {
  const counts = summariseClassifications([
    { classification: "NEW" },
    { classification: "NEW" },
    { classification: "ALREADY_IN_REVIEW" },
    { classification: "COMPLETED" },
    { classification: "UPDATED" },
    { classification: "POSSIBLE_DUPLICATE" },
  ]);
  assert.equal(counts.received, 6);
  assert.equal(counts.NEW, 2);
  assert.equal(counts.ALREADY_IN_REVIEW, 1);
  assert.equal(counts.COMPLETED, 1);
  assert.equal(counts.UPDATED, 1);
  assert.equal(counts.POSSIBLE_DUPLICATE, 1);
});
