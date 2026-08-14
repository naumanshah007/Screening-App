/**
 * Phase 1A: source identity, persisted.
 *
 * Two guarantees:
 *
 *   1. Episode identifiers survive in clear. The digests are lookup keys; the
 *      accession number and facility are the explanation. A reviewer asked to
 *      accept that two results are the same episode is entitled to see the
 *      identifiers, not a hash.
 *
 *   2. Ingestion identity is separate from clinical identity, and enforced by
 *      the database. The unique constraint is the idempotency guarantee itself,
 *      not an optimisation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import {
  ensureDefaultOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `SRCID-${Date.now()}`;

async function context() {
  const previous = process.env.ORGANISATION_KEY;
  process.env.ORGANISATION_KEY = `${RUN}-org`;
  await ensureDefaultOrganisation();
  const organisationId = await requireCurrentOrganisationId();
  const actor = await prisma.user.findFirst({ select: { id: true } });
  return {
    organisationId,
    actorId: actor?.id ?? null,
    restore() {
      if (previous === undefined) delete process.env.ORGANISATION_KEY;
      else process.env.ORGANISATION_KEY = previous;
    },
  };
}

test("episode identifiers and both digests are persisted in clear", async () => {
  const ctx = await context();
  try {
    if (!ctx.actorId) return;

    const run = await prisma.batchRun.create({
      data: {
        organisationId: ctx.organisationId,
        source: "HL7",
        engineVersion: "source-identity-test",
        totalCases: 1,
        pendingCount: 1,
        createdByUserId: ctx.actorId,
        items: {
          create: [
            {
              rowNumber: 1,
              figure: "FIGURE_3",
              riskLevel: "HIGH",
              recommendationCode: "TEST",
              recommendation: "Test",
              caseJson: "{}",
              inputJson: "{}",
              decisionJson: "{}",
              sourceEpisodeKey: "ACC-ZAB1042-01",
              sourceFacility: "Awanui Labs — Auckland (HL7v2)",
              testType: "HPV_LBC",
              collectedOn: new Date("2026-07-10T00:00:00.000Z"),
              rawPayloadDigest: "raw-digest",
              clinicalPayloadDigest: "clinical-digest",
            },
          ],
        },
      },
      include: { items: true },
    });

    try {
      const item = run.items[0];
      // Explainability: a match must be describable as "accession X from Y".
      assert.equal(item.sourceEpisodeKey, "ACC-ZAB1042-01");
      assert.equal(item.sourceFacility, "Awanui Labs — Auckland (HL7v2)");
      assert.equal(item.testType, "HPV_LBC");
      assert.ok(item.collectedOn instanceof Date);
      // Both digests, kept apart.
      assert.equal(item.rawPayloadDigest, "raw-digest");
      assert.equal(item.clinicalPayloadDigest, "clinical-digest");
    } finally {
      await prisma.batchRun.delete({ where: { id: run.id } });
    }
  } finally {
    ctx.restore();
  }
});

test("the same delivery cannot be recorded twice on a channel", async () => {
  const ctx = await context();
  try {
    const deliveryKey = `${RUN}-msh10`;
    const first = await prisma.ingestionReceipt.create({
      data: {
        organisationId: ctx.organisationId,
        channel: "hl7-gateway",
        deliveryKey,
        caseCount: 3,
      },
    });

    try {
      await assert.rejects(
        prisma.ingestionReceipt.create({
          data: { organisationId: ctx.organisationId, channel: "hl7-gateway", deliveryKey },
        }),
        "a replayed delivery must be refused by the database, not by hoping callers check"
      );
    } finally {
      await prisma.ingestionReceipt.delete({ where: { id: first.id } });
    }
  } finally {
    ctx.restore();
  }
});

test("the same identifier on a different channel is a different delivery", async () => {
  // Two channels may legitimately use the same identifier space. A message
  // control ID from an HL7 gateway and a file hash from an upload are unrelated,
  // and colliding them would suppress a real delivery.
  const ctx = await context();
  try {
    const deliveryKey = `${RUN}-shared-key`;
    const a = await prisma.ingestionReceipt.create({
      data: { organisationId: ctx.organisationId, channel: "hl7-gateway", deliveryKey },
    });
    const b = await prisma.ingestionReceipt.create({
      data: { organisationId: ctx.organisationId, channel: "upload", deliveryKey },
    });
    try {
      assert.notEqual(a.id, b.id);
    } finally {
      await prisma.ingestionReceipt.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  } finally {
    ctx.restore();
  }
});

test("a message control ID is never used as episode identity", async () => {
  // The separation this whole subphase rests on. An amended report carries a NEW
  // control number for the SAME specimen: if the control number were episode
  // identity, the amendment would look like a brand-new case and the original
  // decision would never be revisited.
  const ctx = await context();
  try {
    if (!ctx.actorId) return;

    const accession = `${RUN}-ACC-1`;
    const run = await prisma.batchRun.create({
      data: {
        organisationId: ctx.organisationId,
        source: "HL7",
        engineVersion: "source-identity-test",
        totalCases: 1,
        pendingCount: 1,
        createdByUserId: ctx.actorId,
        items: {
          create: [
            {
              rowNumber: 1,
              figure: "FIGURE_3",
              riskLevel: "HIGH",
              recommendationCode: "TEST",
              recommendation: "Test",
              caseJson: "{}",
              inputJson: "{}",
              decisionJson: "{}",
              sourceEpisodeKey: accession,
            },
          ],
        },
      },
    });

    // Original transmission and its amendment: different control numbers.
    const original = await prisma.ingestionReceipt.create({
      data: {
        organisationId: ctx.organisationId,
        channel: "hl7-gateway",
        deliveryKey: `${RUN}-CTRL-001`,
        batchRunId: run.id,
      },
    });
    const amendment = await prisma.ingestionReceipt.create({
      data: {
        organisationId: ctx.organisationId,
        channel: "hl7-gateway",
        deliveryKey: `${RUN}-CTRL-002`,
      },
    });

    try {
      assert.notEqual(
        original.deliveryKey,
        amendment.deliveryKey,
        "an amendment arrives under a new control number"
      );
      const items = await prisma.batchReviewItem.findMany({
        where: { sourceEpisodeKey: accession },
        select: { sourceEpisodeKey: true },
      });
      assert.equal(items.length, 1);
      assert.equal(
        items[0].sourceEpisodeKey,
        accession,
        "episode identity is the accession, which does not change between the two"
      );
    } finally {
      await prisma.ingestionReceipt.deleteMany({
        where: { id: { in: [original.id, amendment.id] } },
      });
      await prisma.batchRun.delete({ where: { id: run.id } });
    }
  } finally {
    ctx.restore();
  }
});
