/**
 * Provision the CHCH controlled clinical evaluation environment: the default
 * organisation, plus the evaluator account (login "chchadmin").
 *
 * One account drives the whole evaluation workflow — pull the supplied cases,
 * process, review, and record accept / reject / needs-information — at least
 * privilege. What the role still carries beyond that is withheld by the
 * evaluation boundary in lib/auth/evaluation-mode.ts, which denies before the
 * role grants, so the evaluator cannot alter rules, accounts, or the supplied
 * case set.
 *
 * Idempotent — safe to re-run; repairs the account to the expected state
 * rather than failing if it already exists. Also renames the earlier
 * "chchpublic" account onto this login so only one evaluation identity exists.
 * Flagged isDemoAccount so it is excluded from anything treating accounts as
 * real clinical users.
 *
 * Acts on whatever DATABASE_URL points at, and says which before writing.
 * CHCH_ADMIN_PASSWORD is required against a shared deployment.
 *
 *   npx tsx scripts/demo/create-chch-admin-user.ts
 */

import bcrypt from "bcryptjs";
import { buildUserAuditEntry, USER_AUDIT_ACTION } from "@/lib/admin/user-audit";
import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import { ensureDefaultOrganisation } from "@/lib/organisation/current-organisation";
import { prisma } from "@/lib/prisma";

const EMAIL = "chchadmin@cs.nz";
const PREVIOUS_EMAIL = "chchpublic@cs.nz";
const NAME = "CHCH Admin (Proof of Concept)";
// Least privilege for the evaluation workflow: view the supplied cases, pull
// them, process, review, and record accept / reject / needs-information.
// GYNAE_GRADER carries cases:grade, batch:view and batch:manage, which is the
// whole workflow; the capabilities it holds beyond that — rules:approve,
// rules:validate, documents:ingest — are withheld by the evaluation boundary
// in lib/auth/evaluation-mode.ts, which denies before the role grants.
//
// ADMIN was wrong here: it carries rules:edit, rules:activate and admin:users,
// so an evaluator could have changed the ruleset they were evaluating.
const ROLE = "GYNAE_GRADER" as const;

// The weak default is a local-development convenience and must never reach a
// shared deployment, where the account is internet-reachable and the login is
// the username. Refused against a remote target rather than warned about.
const LOCAL_ONLY_DEFAULT_PASSWORD = "chchadmin";

function resolvePassword(isRemote: boolean): string {
  const supplied = process.env.CHCH_ADMIN_PASSWORD?.trim();
  if (supplied) return supplied;
  if (isRemote) {
    throw new Error(
      "CHCH_ADMIN_PASSWORD is required for a shared deployment. The built-in " +
        "default is a local-development convenience and is refused against a remote database."
    );
  }
  return LOCAL_ONLY_DEFAULT_PASSWORD;
}

async function main() {
  // The same command can point at a local file or a shared deployment, and the
  // difference is one environment variable. Say which before writing anything.
  const summary = getDatabaseRuntimeSummary();
  const isRemote = summary.mode === "remote-libsql";
  console.log(`Target: ${summary.displayTarget} ${isRemote ? "(REMOTE — shared deployment)" : "(local file)"}`);

  // Resolved before any database work so a missing credential fails the run
  // outright rather than part-way through provisioning a shared deployment.
  const password = resolvePassword(isRemote);

  // Cases cannot be graded without an organisation to attribute the run to;
  // intake fails with "no active organisation" long before the engine is
  // reached. Idempotent — returns the existing row when there is one.
  const organisation = await ensureDefaultOrganisation();
  console.log(`Organisation ready: ${organisation.name} (${organisation.key})`);

  const actor = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true, email: { not: EMAIL } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const existing =
    (await prisma.user.findUnique({ where: { email: EMAIL } })) ??
    (await prisma.user.findUnique({ where: { email: PREVIOUS_EMAIL } }));

  const data = {
    email: EMAIL,
    name: NAME,
    role: ROLE,
    passwordHash,
    isActive: true,
    isDemoAccount: true,
    passwordChangeRequired: false,
    failedAttempts: 0,
    lockedUntil: null,
  };

  if (existing) {
    const user = await prisma.user.update({ where: { id: existing.id }, data });
    if (actor) {
      await prisma.auditLog.create({
        data: buildUserAuditEntry({
          action: USER_AUDIT_ACTION.PASSWORD_RESET_BY_ADMIN,
          actorUserId: actor.id,
          targetUserId: user.id,
          details: { email: EMAIL, reason: "chch-admin-provision-script" },
        }),
      });
    }
    console.log(`Updated account ${existing.email} → ${EMAIL} (role ${ROLE}).`);
    return;
  }

  const user = await prisma.user.create({ data });
  if (actor) {
    await prisma.auditLog.create({
      data: buildUserAuditEntry({
        action: USER_AUDIT_ACTION.USER_CREATED,
        actorUserId: actor.id,
        targetUserId: user.id,
        details: { email: EMAIL, role: ROLE },
      }),
    });
  }
  console.log(`Created account ${EMAIL} (role ${ROLE}).`);
}

main()
  .catch((error) => {
    console.error(
      "chchadmin account provisioning failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
