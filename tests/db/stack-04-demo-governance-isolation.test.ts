/**
 * Demonstration governance decisions must never satisfy real activation gates.
 *
 * This is the property that makes it safe to demonstrate the full governance
 * workflow with shared demo identities. A decision recorded while DEMO_MODE was
 * on is stamped isDemo on the row itself, and the Production activation path
 * excludes those rows — so turning DEMO_MODE off later cannot promote a demo
 * approval into a real one.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import {
  getActivationGateStates,
  recordActivationGateDecision,
  assertProductionGovernanceGates,
} from "@/lib/clinical-rules/activation-governance";

const RUN = `DEMOGOV-${Date.now()}`;

let fixtureCounter = 0;

async function fixture() {
  // Each test needs its own version: gate state is scoped to a version's
  // checksum, so sharing one would let tests observe each other's decisions.
  const unique = `${RUN}-${(fixtureCounter += 1)}`;

  const ruleSet = await prisma.clinicalRuleSet.upsert({
    where: { key: `${unique}-set` },
    update: {},
    create: { key: `${unique}-set`, name: "Demo governance isolation set" },
  });

  const version = await prisma.clinicalRuleVersion.create({
    data: {
      ruleSetId: ruleSet.id,
      versionMajor: 3,
      versionMinor: 1,
      versionPatch: 0,
      displayVersion: `${unique}-3.1.0`,
      // DRAFT deliberately: other suites select a version with an unscoped
      // findFirst({ status: "VALIDATED" }), and a VALIDATED fixture here would
      // be picked up by them. Gate decisions and the Production gate assertion
      // depend on the checksum, not the status, so this costs nothing.
      status: "DRAFT",
      sourceGuidelineSummary: "demo governance isolation fixture",
      snapshotJson: "{}",
      checksum: `${unique}-checksum`,
    },
  });

  const actor = await prisma.user.create({
    data: {
      email: `${unique}-admin@validation.invalid`,
      name: "Demo Governance Admin",
      role: "ADMIN",
    },
  });

  return { ruleSet, version, actor };
}

async function withDemoMode<T>(value: string | undefined, run: () => Promise<T>) {
  const previous = process.env.DEMO_MODE;
  if (value === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  }
}

test("a gate decision recorded in demo mode is stamped isDemo", async () => {
  const { version, actor } = await fixture();

  await withDemoMode("true", () =>
    recordActivationGateDecision({
      ruleVersionId: version.id,
      actorUserId: actor.id,
      actorRole: "ADMIN",
      gateId: "RISK-ACCEPTANCE",
      action: "APPROVE",
      comments: "Demonstration attestation recorded during a walkthrough.",
    })
  );

  const event = await prisma.ruleVersionAuditEvent.findFirst({
    where: { ruleVersionId: version.id, eventType: "ACTIVATION_GATE_DECISION" },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(event, "the decision must be recorded");
  assert.equal(event!.isDemo, true, "the row must carry demo provenance");

  const details = JSON.parse(event!.afterJson!) as Record<string, unknown>;
  assert.equal(details.isDemo, true, "the payload must also record it");
});

test("a demo decision is visible to the governance UI but excluded from gates", async () => {
  const { version, actor } = await fixture();

  await withDemoMode("true", () =>
    recordActivationGateDecision({
      ruleVersionId: version.id,
      actorUserId: actor.id,
      actorRole: "ADMIN",
      gateId: "RISK-ACCEPTANCE",
      action: "APPROVE",
      comments: "Demonstration attestation recorded during a walkthrough.",
    })
  );

  // The UI reads everything, so the demo decision remains visible and labelled.
  const visible = await getActivationGateStates(version.id);
  const shown = visible.find((state) => state.gateId === "RISK-ACCEPTANCE");
  assert.equal(shown?.action, "APPROVE");
  assert.equal(shown?.isDemo, true, "the UI must be able to label it as demo");

  // The activation path excludes it, so the gate reads as undecided.
  const authoritative = await getActivationGateStates(version.id, {
    excludeDemo: true,
  });
  const counted = authoritative.find(
    (state) => state.gateId === "RISK-ACCEPTANCE"
  );
  assert.equal(
    counted?.action,
    "PENDING",
    "a demo attestation must not count as an approval"
  );
});

/**
 * Insert a clinical interpretation approval directly.
 *
 * The propose/approve flow is exercised elsewhere; here the reader logic is
 * under test, so the events are written directly to isolate exactly which layer
 * performs the demo exclusion.
 */
async function approveAllCards(args: {
  ruleSetId: string;
  ruleVersionId: string;
  actorUserId: string;
  checksum: string;
  isDemo: boolean;
}) {
  const { CLINICAL_GOVERNANCE_CASES } = await import(
    "@/lib/clinical-rules/governance-review"
  );

  for (const item of CLINICAL_GOVERNANCE_CASES) {
    await prisma.ruleVersionAuditEvent.create({
      data: {
        ruleSetId: args.ruleSetId,
        ruleVersionId: args.ruleVersionId,
        actorUserId: args.actorUserId,
        eventType: "GOVERNANCE_INTERPRETATION_APPROVED",
        reason: "Test fixture approval.",
        isDemo: args.isDemo,
        afterJson: JSON.stringify({
          caseId: item.caseId,
          checksum: args.checksum,
          approvalStatus: "APPROVED_IN_DRAFT_REVISION",
        }),
      },
    });
  }
}

test("a demo interpretation approval does not satisfy the clinical card requirement", async () => {
  const { ruleSet, version, actor } = await fixture();

  await approveAllCards({
    ruleSetId: ruleSet.id,
    ruleVersionId: version.id,
    actorUserId: actor.id,
    checksum: version.checksum!,
    isDemo: true,
  });

  await withDemoMode("false", async () => {
    await assert.rejects(
      () => assertProductionGovernanceGates(version.id, actor.id),
      /Clinical interpretation cards are incomplete/,
      "cards approved as demonstrations must still read as incomplete"
    );
  });
});

test("demo gate approvals do not satisfy Production gates once demo mode is off", async () => {
  const { ruleSet, version, actor } = await fixture();

  // Real clinical card approvals, so the card check passes and the gate check
  // is the layer actually under test.
  await approveAllCards({
    ruleSetId: ruleSet.id,
    ruleVersionId: version.id,
    actorUserId: actor.id,
    checksum: version.checksum!,
    isDemo: false,
  });

  const gateIds = [
    "GOV-01",
    "GOV-02",
    "GOV-03",
    "GOV-04-OPERATING-POINT",
    "ROLLBACK-THRESHOLDS",
    "LICENSING",
    "RISK-ACCEPTANCE",
    "R6-CREDENTIAL",
    "SHARED-REHEARSAL",
  ] as const;

  await withDemoMode("true", async () => {
    for (const gateId of gateIds) {
      await recordActivationGateDecision({
        ruleVersionId: version.id,
        actorUserId: actor.id,
        actorRole: "ADMIN",
        gateId,
        action: "APPROVE",
        comments: `Demonstration attestation for ${gateId} during a walkthrough.`,
      });
    }
  });

  // Switch demo mode off, as at handover, and attempt a real activation.
  await withDemoMode("false", async () => {
    await assert.rejects(
      () => assertProductionGovernanceGates(version.id, actor.id),
      (error: Error) => {
        assert.match(error.message, /gates are incomplete/i);
        // The refusal names the demo-only gates so an operator understands why
        // an apparently approved gate does not count.
        assert.match(
          error.message,
          /demonstration attestations only/i,
          "the error must explain that the approvals are demonstration-only"
        );
        return true;
      },
      "demo approvals must never satisfy Production activation"
    );
  });
});
