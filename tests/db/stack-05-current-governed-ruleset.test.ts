/**
 * The CURRENT GOVERNED RULESET pointer.
 *
 * The property under test is that "which ruleset decides a new case" is a
 * movable pointer rather than a hardwired version string — and that moving it
 * cannot re-decide a case that already has a decision.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import { getRuntimeClinicalEnvironment } from "@/lib/clinical-rules/authority";
import { NATIONAL_RULE_SET_KEY } from "@/lib/clinical-rules/constants";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";

const RUN = `CURRENTRS-${Date.now()}`;
const ENVIRONMENT = "TEST" as const;

async function nationalRuleSet() {
  return prisma.clinicalRuleSet.upsert({
    where: { key: NATIONAL_RULE_SET_KEY },
    update: {},
    create: { key: NATIONAL_RULE_SET_KEY, name: "National cervical rule set" },
  });
}

let seq = 0;
async function publishedVersion(display: string, checksum: string) {
  const ruleSet = await nationalRuleSet();
  seq += 1;
  return prisma.clinicalRuleVersion.create({
    data: {
      ruleSetId: ruleSet.id,
      versionMajor: 3,
      versionMinor: 1,
      versionPatch: seq,
      displayVersion: display,
      status: "PUBLISHED",
      sourceGuidelineSummary: "current-ruleset pointer fixture",
      snapshotJson: "{}",
      checksum,
    },
  });
}

async function activate(ruleVersionId: string) {
  const ruleSet = await nationalRuleSet();
  // Deactivate any prior activation for this environment, exactly as a real
  // version bump does — the pointer must never resolve to two versions.
  await prisma.ruleSetActivation.updateMany({
    where: { ruleSetId: ruleSet.id, environment: ENVIRONMENT, deactivatedAt: null },
    data: { deactivatedAt: new Date() },
  });
  return prisma.ruleSetActivation.create({
    data: {
      ruleSetId: ruleSet.id,
      ruleVersionId,
      environment: ENVIRONMENT,
      organisationKey: null,
      reason: "current-ruleset pointer test",
    },
  });
}

test("an explicit CLINICAL_ENVIRONMENT declaration wins over the hosting target", () => {
  const previousDeclared = process.env.CLINICAL_ENVIRONMENT;
  const previousVercel = process.env.VERCEL_ENV;
  try {
    // A Vercel production deployment that is clinically a demonstration.
    process.env.VERCEL_ENV = "production";
    process.env.CLINICAL_ENVIRONMENT = "DEMO";
    assert.equal(getRuntimeClinicalEnvironment(), "DEMO");

    // Declaring PRODUCTION keeps production behaviour — it grants nothing.
    process.env.CLINICAL_ENVIRONMENT = "PRODUCTION";
    assert.equal(getRuntimeClinicalEnvironment(), "PRODUCTION");

    // An unrecognised value is ignored rather than trusted.
    process.env.CLINICAL_ENVIRONMENT = "NOT_A_REAL_ENVIRONMENT";
    assert.equal(getRuntimeClinicalEnvironment(), "PRODUCTION");

    // Unset reproduces the previous derivation exactly.
    delete process.env.CLINICAL_ENVIRONMENT;
    assert.equal(getRuntimeClinicalEnvironment(), "PRODUCTION");
    process.env.VERCEL_ENV = "preview";
    assert.equal(getRuntimeClinicalEnvironment(), "VALIDATION");
  } finally {
    if (previousDeclared === undefined) delete process.env.CLINICAL_ENVIRONMENT;
    else process.env.CLINICAL_ENVIRONMENT = previousDeclared;
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
  }
});

test("with no activation there is no current governed ruleset", async () => {
  const ruleSet = await nationalRuleSet();
  await prisma.ruleSetActivation.updateMany({
    where: { ruleSetId: ruleSet.id, environment: ENVIRONMENT, deactivatedAt: null },
    data: { deactivatedAt: new Date() },
  });

  const current = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.equal(
    current,
    null,
    "absence must be reported, not substituted with a default version"
  );
});

test("the pointer resolves to the activated version and its checksum", async () => {
  const version = await publishedVersion(`${RUN}-CG-NCSP-3.1.0`, `${RUN}-checksum-31`);
  await activate(version.id);

  const current = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.ok(current, "an active governed ruleset must resolve");
  assert.equal(current!.ruleVersionId, version.id);
  assert.equal(current!.displayVersion, `${RUN}-CG-NCSP-3.1.0`);
  assert.equal(current!.checksum, `${RUN}-checksum-31`);
  assert.equal(current!.environment, ENVIRONMENT);
});

test("a future release moves the pointer without a code change", async () => {
  const v31 = await publishedVersion(`${RUN}-CG-NCSP-3.1.0-b`, `${RUN}-checksum-31b`);
  await activate(v31.id);
  const before = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.equal(before!.displayVersion, `${RUN}-CG-NCSP-3.1.0-b`);

  // The successor becomes current purely by being activated.
  const v32 = await publishedVersion(`${RUN}-CG-NCSP-3.2.0`, `${RUN}-checksum-32`);
  await activate(v32.id);

  const after = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.equal(after!.displayVersion, `${RUN}-CG-NCSP-3.2.0`);
  assert.equal(after!.checksum, `${RUN}-checksum-32`);

  // The superseded version still exists — a version bump is not a deletion.
  const superseded = await prisma.clinicalRuleVersion.findUnique({
    where: { id: v31.id },
    select: { id: true, checksum: true },
  });
  assert.equal(superseded?.checksum, `${RUN}-checksum-31b`);
});

test("an activation without a checksum is treated as no current ruleset", async () => {
  const ruleSet = await nationalRuleSet();
  seq += 1;
  const unchecksummed = await prisma.clinicalRuleVersion.create({
    data: {
      ruleSetId: ruleSet.id,
      versionMajor: 3,
      versionMinor: 1,
      versionPatch: 900 + seq,
      displayVersion: `${RUN}-no-checksum`,
      status: "PUBLISHED",
      sourceGuidelineSummary: "fixture without checksum",
      snapshotJson: "{}",
      checksum: null,
    },
  });
  await activate(unchecksummed.id);

  const current = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.equal(
    current,
    null,
    "an activation that cannot identify what ran must fail closed"
  );
});

test("the pointer is scoped per environment", async () => {
  const version = await publishedVersion(`${RUN}-scoped`, `${RUN}-checksum-scoped`);
  await activate(version.id);

  // TEST has an activation; VALIDATION does not, and must not inherit it.
  const inTest = await getCurrentGovernedRuleset({ environment: ENVIRONMENT });
  assert.ok(inTest);

  const inValidation = await getCurrentGovernedRuleset({
    environment: "VALIDATION",
  });
  assert.notEqual(
    inValidation?.ruleVersionId,
    version.id,
    "an activation must not leak across environments"
  );
});
