/**
 * Provision (or reset) the CHCH proof-of-concept account:
 * login "chchadmin", password "chchadmin".
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
 * Run: npx tsx scripts/demo/create-chch-admin-user.ts
 */

import bcrypt from "bcryptjs";
import { buildUserAuditEntry, USER_AUDIT_ACTION } from "@/lib/admin/user-audit";
import { prisma } from "@/lib/prisma";

const EMAIL = "chchadmin@cs.nz";
const PREVIOUS_EMAIL = "chchpublic@cs.nz";
const PASSWORD = "chchadmin";
const NAME = "CHCH Admin (Proof of Concept)";
const ROLE = "ADMIN" as const;

async function main() {
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
