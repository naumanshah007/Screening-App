import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDisposition,
  BatchReviewConflictError,
  returnNeedsInformationToQueue,
} from "@/lib/batch/persistence";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `PILOT-INTEGRITY-${Date.now()}`;

async function fixture() {
  const previous = process.env.ORGANISATION_KEY;
  process.env.ORGANISATION_KEY = `${RUN}-org`;
  await ensureDefaultOrganisation();
  const organisationId = await requireCurrentOrganisationId();
  const actor = await prisma.user.findFirst({ select: { id: true } });
  if (!actor) throw new Error("The DB test seed must contain a user.");

  const run = await prisma.batchRun.create({
    data: {
      organisationId,
      source: "DEMO",
      engineVersion: "pilot-integrity-test",
      totalCases: 1,
      pendingCount: 1,
      createdByUserId: actor.id,
      items: {
        create: {
          rowNumber: 1,
          figure: "FIGURE_3",
          riskLevel: "HIGH",
          recommendationCode: "TEST",
          recommendation: "Test recommendation",
          caseJson: JSON.stringify({ immutable: "case" }),
          inputJson: JSON.stringify({ immutable: "input" }),
          decisionJson: JSON.stringify({ immutable: "decision" }),
        },
      },
    },
    include: { items: true },
  });

  return {
    actorId: actor.id,
    run,
    restore() {
      if (previous === undefined) delete process.env.ORGANISATION_KEY;
      else process.env.ORGANISATION_KEY = previous;
    },
  };
}

test("a stale reviewer cannot overwrite a completed decision", async () => {
  const ctx = await fixture();
  try {
    const itemId = ctx.run.items[0].id;
    await applyDisposition({
      itemIds: [itemId],
      disposition: "ACCEPTED",
      reviewedByUserId: ctx.actorId,
    });

    await assert.rejects(
      applyDisposition({
        itemIds: [itemId],
        disposition: "REJECTED",
        reviewedByUserId: ctx.actorId,
        note: "Stale second reviewer action",
      }),
      BatchReviewConflictError
    );

    const stored = await prisma.batchReviewItem.findUniqueOrThrow({ where: { id: itemId } });
    assert.equal(stored.disposition, "ACCEPTED");
    assert.equal(stored.overrideReason, null);
  } finally {
    await prisma.batchRun.delete({ where: { id: ctx.run.id } });
    ctx.restore();
  }
});

test("needs information records ownership and returns to pending without changing clinical facts", async () => {
  const ctx = await fixture();
  try {
    const before = ctx.run.items[0];
    await applyDisposition({
      itemIds: [before.id],
      disposition: "NEEDS_INFO",
      reviewedByUserId: ctx.actorId,
      note: "Awaiting NCSR screening history.",
    });

    const waiting = await prisma.batchReviewItem.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(waiting.disposition, "NEEDS_INFO");
    assert.equal(waiting.informationOwnerUserId, ctx.actorId);
    assert.ok(waiting.informationRequestedAt);
    assert.equal(waiting.reviewNote, "Awaiting NCSR screening history.");

    await returnNeedsInformationToQueue({
      itemId: before.id,
      actorUserId: ctx.actorId,
      resolutionNote: "NCSR history received and attached for reviewer verification.",
    });

    const returned = await prisma.batchReviewItem.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(returned.disposition, "PENDING");
    assert.ok(returned.informationReceivedAt);
    assert.equal(returned.caseJson, before.caseJson);
    assert.equal(returned.inputJson, before.inputJson);
    assert.equal(returned.decisionJson, before.decisionJson);

    const run = await prisma.batchRun.findUniqueOrThrow({ where: { id: ctx.run.id } });
    assert.equal(run.pendingCount, 1);
    assert.equal(run.needsInfoCount, 0);
  } finally {
    await prisma.batchRun.delete({ where: { id: ctx.run.id } });
    ctx.restore();
  }
});
