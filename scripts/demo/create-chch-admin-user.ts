/**
 * Provision the CHCH proof-of-concept environment: the default organisation,
 * plus a full-access account — login "chchadmin", password "chchadmin".
 *
 * One full-access account drives the whole demo (pull, review, grade,
 * decisions, rules, admin) while the concept is being proven. Role separation
 * across coordinator/grader/reviewer accounts comes after sign-off.
 *
 * Idempotent — safe to re-run; repairs the account to the expected state
 * rather than failing if it already exists. Also renames the earlier
 * "chchpublic" account onto this login so only one demo identity exists.
 * Flagged isDemoAccount so it's excluded from anything treating accounts as
 * real clinical users.
 *
 * Acts on whatever DATABASE_URL points at, so check it before running against
 * anything shared. Set CHCH_ADMIN_PASSWORD to avoid seeding the POC default.
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
const ROLE = "ADMIN" as const;

// Overridable so a deployment that should not carry the POC credential can set
// a real one without a code change. The value is never logged.
const PASSWORD = process.env.CHCH_ADMIN_PASSWORD?.trim() || "chchadmin";

async function main() {
  // The same command can point at a local file or a shared deployment, and the
  // difference is one environment variable. Say which before writing anything.
  const summary = getDatabaseRuntimeSummary();
  const isRemote = summary.mode === "remote-libsql";
  console.log(`Target: ${summary.displayTarget} ${isRemote ? "(REMOTE — shared deployment)" : "(local file)"}`);

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

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
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
