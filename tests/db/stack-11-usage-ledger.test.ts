/**
 * Phase 2: the usage ledger.
 *
 * WHAT THIS LEDGER IS FOR
 * -----------------------
 * It answers "what did the platform do", as fact, so that an invoice can later
 * be derived from it. It is not an invoice, and it holds no prices — because it
 * is append-only, and a commercial opinion written into an append-only table
 * could only be corrected by rewriting history or by contradicting it.
 *
 * THE TWO PROPERTIES THAT MUST HOLD
 * ---------------------------------
 *   Exactly once. A retried save, a duplicated request or a re-run after a
 *   partial failure must not bill twice. For the commercial unit — one first
 *   governed triage per unique episode — this is enforced by the database, not
 *   by the application remembering to check.
 *
 *   Append-only. A usage ledger that can be quietly edited is not evidence.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import {
  recordUsageEvent,
  usageEventTypeFor,
  usageIdempotencyKey,
} from "@/lib/usage/usage-events";
import {
  ensureDefaultOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `USAGE-${Date.now()}`;

async function context() {
  const previous = process.env.ORGANISATION_KEY;
  process.env.ORGANISATION_KEY = `${RUN}-org`;
  await ensureDefaultOrganisation();
  const organisationId = await requireCurrentOrganisationId();
  return {
    organisationId,
    restore() {
      if (previous === undefined) delete process.env.ORGANISATION_KEY;
      else process.env.ORGANISATION_KEY = previous;
    },
  };
}

async function episode(organisationId: string, suffix: string) {
  const id = `${RUN}-${suffix}`;
  await prisma.screeningEpisode.create({
    data: {
      id,
      organisationId,
      weakFingerprint: `${id}-weak`,
    },
  });
  return id;
}

// ─── Exactly once ───────────────────────────────────────────────────────────

test("a first triage can be recorded only once per episode, ever", async () => {
  // The commercial unit. Retries, re-runs and duplicated requests must all
  // converge on one billable fact.
  const ctx = await context();
  try {
    const episodeId = await episode(ctx.organisationId, "episode-1");

    const first = await prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: ctx.organisationId,
        episodeId,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        ruleEvaluationId: "evaluation-a",
      })
    );
    assert.equal(first, true, "the first write records the event");

    // Same episode, DIFFERENT evaluation — a re-run that produced a new
    // evaluation id. It must still not count twice.
    const second = await prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: ctx.organisationId,
        episodeId,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        ruleEvaluationId: "evaluation-b",
      })
    );
    assert.equal(second, false, "a repeat is a no-op, not a second charge");

    const count = await prisma.usageEvent.count({
      where: { episodeId, eventType: "FIRST_TRIAGE" },
    });
    assert.equal(count, 1);
  } finally {
    ctx.restore();
  }
});

test("the first-triage key is scoped to the episode alone", () => {
  // This is what makes "once per episode, ever" a database guarantee rather
  // than an application convention.
  const base = { organisationId: "org", episodeId: "ep" } as const;
  assert.equal(
    usageIdempotencyKey({ ...base, eventType: "FIRST_TRIAGE", ruleEvaluationId: "a" }),
    usageIdempotencyKey({ ...base, eventType: "FIRST_TRIAGE", ruleEvaluationId: "b" })
  );
  // Every other type genuinely can recur — an episode may be amended twice.
  assert.notEqual(
    usageIdempotencyKey({ ...base, eventType: "UPDATE_REEVALUATION", ruleEvaluationId: "a" }),
    usageIdempotencyKey({ ...base, eventType: "UPDATE_REEVALUATION", ruleEvaluationId: "b" })
  );
});

test("keys never collide across organisations or episodes", async () => {
  const ctx = await context();
  try {
    const episodeIds = await Promise.all(
      ["ep-a", "ep-b"].map((suffix) => episode(ctx.organisationId, suffix))
    );
    const written = await Promise.all(
      episodeIds.map((episodeId) =>
        prisma.$transaction((tx) =>
          recordUsageEvent({
            tx,
            organisationId: ctx.organisationId,
            episodeId,
            eventType: "FIRST_TRIAGE",
            classification: "NEW",
          })
        )
      )
    );
    assert.deepEqual(written, [true, true], "different episodes are different facts");

    assert.notEqual(
      usageIdempotencyKey({ organisationId: "org-1", episodeId: "ep", eventType: "FIRST_TRIAGE" }),
      usageIdempotencyKey({ organisationId: "org-2", episodeId: "ep", eventType: "FIRST_TRIAGE" })
    );
  } finally {
    ctx.restore();
  }
});

test("an update is metered separately from the first triage", async () => {
  const ctx = await context();
  try {
    const episodeId = await episode(ctx.organisationId, "episode-update");
    await prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: ctx.organisationId,
        episodeId,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        ruleEvaluationId: "eval-1",
      })
    );
    const updated = await prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: ctx.organisationId,
        episodeId,
        eventType: "UPDATE_REEVALUATION",
        classification: "UPDATED",
        ruleEvaluationId: "eval-2",
      })
    );
    assert.equal(updated, true);

    const byType = await prisma.usageEvent.findMany({
      where: { episodeId },
      select: { eventType: true },
    });
    assert.deepEqual(
      byType.map((e) => e.eventType).sort(),
      ["FIRST_TRIAGE", "UPDATE_REEVALUATION"],
      "both are recorded as facts; whether either is charged is a policy question"
    );
  } finally {
    ctx.restore();
  }
});

// ─── Append-only ────────────────────────────────────────────────────────────

test("a usage event cannot be edited or deleted", async () => {
  const ctx = await context();
  try {
    const episodeId = await episode(ctx.organisationId, "episode-immutable");
    await prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: ctx.organisationId,
        episodeId,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
      })
    );
    const event = await prisma.usageEvent.findFirstOrThrow({ where: { episodeId } });

    // Asserted through raw SQL deliberately.
    //
    // The guarantee is a database trigger, and the ORM does not preserve its
    // message: SQLITE_CONSTRAINT_TRIGGER and SQLITE_CONSTRAINT_FOREIGNKEY share
    // a subcode, so Prisma reports the abort as a foreign-key violation. Going
    // through the ORM would still prove the write is refused, but it would
    // prove it via an error that names the wrong cause — and would keep passing
    // if the trigger were replaced by an unrelated constraint. The raw path
    // shows the actual guarantee firing.
    for (const [what, sql] of [
      ["edited", `UPDATE "UsageEvent" SET "eventType" = 'REGRADE' WHERE "id" = ?`],
      ["deleted", `DELETE FROM "UsageEvent" WHERE "id" = ?`],
    ] as const) {
      await assert.rejects(
        prisma.$executeRawUnsafe(sql, event.id),
        /Usage events are immutable/,
        `a usage event must not be ${what} — a ledger that can be quietly changed is not evidence`
      );
    }

    // And the ORM route is refused too, whatever it calls the failure.
    await assert.rejects(
      prisma.usageEvent.update({ where: { id: event.id }, data: { eventType: "REGRADE" } })
    );
    await assert.rejects(prisma.usageEvent.delete({ where: { id: event.id } }));
  } finally {
    ctx.restore();
  }
});

// ─── Facts, not prices ──────────────────────────────────────────────────────

test("the ledger carries no price and no billable flag", async () => {
  const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(
    'PRAGMA table_info("UsageEvent")'
  );
  const names = columns.map((c) => c.name.toLowerCase());
  for (const forbidden of ["price", "amount", "cost", "currency", "billable", "billablereason"]) {
    assert.ok(
      !names.includes(forbidden),
      `${forbidden} is a policy question and must not be frozen into an append-only fact`
    );
  }
  // The facts a policy needs in order to decide are present.
  for (const required of ["eventtype", "episodeid", "organisationid", "occurredat", "isdemo"]) {
    assert.ok(names.includes(required), `missing fact: ${required}`);
  }
});

// ─── Which event a classification produces ──────────────────────────────────

test("event type follows what actually happened", () => {
  assert.equal(
    usageEventTypeFor({ classification: "NEW", evaluated: true, episodeAlreadyTriaged: false }),
    "FIRST_TRIAGE"
  );
  assert.equal(
    usageEventTypeFor({ classification: "UPDATED", evaluated: true, episodeAlreadyTriaged: true }),
    "UPDATE_REEVALUATION"
  );
  assert.equal(
    usageEventTypeFor({ classification: "NEW", evaluated: true, episodeAlreadyTriaged: true }),
    "REGRADE",
    "a second evaluation of unchanged information is a regrade, not a new triage"
  );
  assert.equal(
    usageEventTypeFor({ classification: "COMPLETED", evaluated: false, episodeAlreadyTriaged: true }),
    "DUPLICATE_SUPPRESSED",
    "suppression is metered so it is visible, not left as an absence"
  );
});

test("an advisory possible-duplicate is not its own category of work", () => {
  // It is processed exactly like any other case, so it produces whatever its
  // evaluation produces. A maybe is not a kind of work.
  assert.equal(
    usageEventTypeFor({
      classification: "POSSIBLE_DUPLICATE",
      evaluated: true,
      episodeAlreadyTriaged: false,
    }),
    "FIRST_TRIAGE"
  );
  assert.equal(
    usageEventTypeFor({
      classification: "POSSIBLE_DUPLICATE",
      evaluated: false,
      episodeAlreadyTriaged: false,
    }),
    null,
    "and if it was never evaluated it is not metered at all"
  );
});

test("a failed evaluation is never metered", () => {
  // Charging for a case that reached no governed recommendation is indefensible.
  assert.equal(
    usageEventTypeFor({ classification: "NEW", evaluated: false, episodeAlreadyTriaged: false }),
    null
  );
});
