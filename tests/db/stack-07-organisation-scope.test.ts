/**
 * Tenancy: Phase 0.
 *
 * The product is single-tenant today, so almost nothing observable changes. What
 * this locks is the property that makes the *next* two phases possible:
 * every row that will later need a tenant already has one, and the resolver
 * refuses to guess when the answer is ambiguous.
 *
 * WHY IT MATTERS THAT THIS IS TESTED NOW
 * --------------------------------------
 * Screening episodes and usage events are append-only by design. A row written
 * without an organisation cannot be corrected later, because those tables may
 * not be updated. So the failure mode is not "a query returns the wrong thing"
 * — it is permanently unattributable pilot history. The resolver therefore
 * fails closed, and these tests assert that it does.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ORGANISATION_KEY,
  ensureDefaultOrganisation,
  getConfiguredOrganisationKey,
  getCurrentOrganisation,
  requireCurrentOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `ORG-${Date.now()}`;

/** Run a body with ORGANISATION_KEY set, restoring the previous value. */
async function withOrganisationKey(value: string | undefined, body: () => Promise<void>) {
  const previous = process.env.ORGANISATION_KEY;
  if (value === undefined) delete process.env.ORGANISATION_KEY;
  else process.env.ORGANISATION_KEY = value;
  try {
    await body();
  } finally {
    if (previous === undefined) delete process.env.ORGANISATION_KEY;
    else process.env.ORGANISATION_KEY = previous;
  }
}

test("seeding the tenant is idempotent and never overwrites a corrected name", async () => {
  const key = `${RUN}-idempotent`;
  await withOrganisationKey(key, async () => {
    const first = await ensureDefaultOrganisation();
    assert.equal(first.key, key);

    // Someone corrects the display name in the product.
    await prisma.organisation.update({
      where: { id: first.id },
      data: { name: "Corrected Service Name" },
    });

    // A later cold start must not undo that.
    const second = await ensureDefaultOrganisation();
    assert.equal(second.id, first.id, "re-seeding must not create a second tenant");
    assert.equal(
      second.name,
      "Corrected Service Name",
      "re-seeding must not overwrite an edited name"
    );
  });
});

test("an explicitly named organisation is resolved", async () => {
  const key = `${RUN}-named`;
  await withOrganisationKey(key, async () => {
    assert.equal(getConfiguredOrganisationKey(), key);
    const seeded = await ensureDefaultOrganisation();
    const resolved = await requireCurrentOrganisation();
    assert.equal(resolved.id, seeded.id);
  });
});

test("a named organisation that does not exist fails closed with a usable message", async () => {
  await withOrganisationKey(`${RUN}-absent`, async () => {
    assert.equal(
      await getCurrentOrganisation(),
      null,
      "read paths get null so they can render an empty state"
    );
    await assert.rejects(
      requireCurrentOrganisation(),
      // The message must name the misconfiguration, not just fail.
      /ORGANISATION_KEY names an organisation that does not exist or is disabled/,
      "write paths must refuse rather than fall back to some other tenant"
    );
  });
});

test("a disabled organisation is not resolved", async () => {
  const key = `${RUN}-disabled`;
  await withOrganisationKey(key, async () => {
    const org = await ensureDefaultOrganisation();
    await prisma.organisation.update({
      where: { id: org.id },
      data: { isActive: false },
    });
    assert.equal(await getCurrentOrganisation(), null);
    await assert.rejects(requireCurrentOrganisation(), /does not exist or is disabled/);
  });
});

test("ambiguity is surfaced, never guessed", async () => {
  // With no ORGANISATION_KEY the resolver may only answer when there is exactly
  // one active organisation. Silently picking the oldest is how rows end up
  // attributed to the wrong customer the first time a second one is added.
  await withOrganisationKey(undefined, async () => {
    const before = await prisma.organisation.count({ where: { isActive: true } });
    const a = await prisma.organisation.create({
      data: { key: `${RUN}-ambiguous-a`, name: "Service A" },
    });
    const b = await prisma.organisation.create({
      data: { key: `${RUN}-ambiguous-b`, name: "Service B" },
    });

    try {
      if (before + 2 > 1) {
        assert.equal(await getCurrentOrganisation(), null);
        await assert.rejects(
          requireCurrentOrganisation(),
          /active organisations exist and none is selected/,
          "more than one tenant with no selection must be an error"
        );
      }
    } finally {
      await prisma.organisation.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  });
});

test("a batch run carries its tenant", async () => {
  const key = `${RUN}-run`;
  await withOrganisationKey(key, async () => {
    await ensureDefaultOrganisation();
    const organisationId = await requireCurrentOrganisationId();
    const actor = await prisma.user.findFirst({ select: { id: true } });
    if (!actor) return; // seeded-user-dependent; skip on an empty database

    const run = await prisma.batchRun.create({
      data: {
        organisationId,
        source: "DEMO",
        engineVersion: "organisation-scope-test",
        totalCases: 0,
        pendingCount: 0,
        createdByUserId: actor.id,
      },
      include: { organisation: true },
    });

    try {
      assert.equal(run.organisationId, organisationId);
      assert.equal(run.organisation?.key, key);
    } finally {
      await prisma.batchRun.delete({ where: { id: run.id } });
    }
  });
});

test("an organisation with runs cannot be deleted", async () => {
  // onDelete: Restrict. Deleting a tenant that owns history would orphan the
  // runs its episodes and usage events will later hang off.
  const key = `${RUN}-restrict`;
  await withOrganisationKey(key, async () => {
    await ensureDefaultOrganisation();
    const organisationId = await requireCurrentOrganisationId();
    const actor = await prisma.user.findFirst({ select: { id: true } });
    if (!actor) return;

    const run = await prisma.batchRun.create({
      data: {
        organisationId,
        source: "DEMO",
        engineVersion: "organisation-restrict-test",
        totalCases: 0,
        pendingCount: 0,
        createdByUserId: actor.id,
      },
    });

    try {
      await assert.rejects(
        prisma.organisation.delete({ where: { id: organisationId } }),
        "deleting a tenant that owns runs must be refused"
      );
    } finally {
      await prisma.batchRun.delete({ where: { id: run.id } });
    }
  });
});

test("the default key is a stable constant, not a generated value", () => {
  // Bootstrap seeds by this key against a live database; a value that changed
  // between builds would seed a second tenant on the next deploy.
  assert.equal(DEFAULT_ORGANISATION_KEY, "counties-manukau");
});
