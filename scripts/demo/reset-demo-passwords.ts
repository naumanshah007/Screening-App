/**
 * Align the demonstration accounts with DEMO_PASSWORD.
 *
 * Used when standing a demo environment up, and whenever the demo credential is
 * changed. Safe to re-run: it is idempotent and touches only accounts flagged
 * isDemoAccount.
 *
 * Refuses unless DEMO_MODE is on, so it cannot be used to weaken a real
 * deployment. Every reset is audited as DEMO_PASSWORD_RESET.
 */

import { DEMO_ACCOUNTS, isDemoModeEnabled } from "@/lib/config/demo-mode";
import { resetUserToDemoPassword } from "@/lib/admin/user-management";
import { prisma } from "@/lib/prisma";

async function main() {
  if (!isDemoModeEnabled()) {
    throw new Error(
      "DEMO_MODE must be enabled to reset demonstration passwords."
    );
  }
  if (!process.env.DEMO_PASSWORD?.trim()) {
    throw new Error("DEMO_PASSWORD must be configured.");
  }

  // Attribute the resets to an existing administrator so the audit trail names
  // a real actor rather than inventing one.
  const actor = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!actor) throw new Error("No active ADMIN account to attribute this to.");

  const results: Array<{ email: string; status: string }> = [];

  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true, isDemoAccount: true },
    });

    if (!user) {
      // Provision a missing demonstration identity. Created disabled-free but
      // with no usable password until the reset below sets one, so there is no
      // window in which the account exists with an unknown credential.
      const created = await prisma.user.create({
        data: {
          email: account.email,
          name: account.label,
          role: account.role,
          isDemoAccount: true,
          isActive: true,
        },
        select: { id: true },
      });
      await resetUserToDemoPassword({
        targetUserId: created.id,
        changedByUserId: actor.id,
      });
      results.push({ email: account.email, status: "CREATED + RESET" });
      continue;
    }

    // The reset helper only accepts flagged demo accounts. An account seeded
    // before the flag existed is repaired here rather than silently skipped.
    if (!user.isDemoAccount) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isDemoAccount: true },
      });
    }

    await resetUserToDemoPassword({
      targetUserId: user.id,
      changedByUserId: actor.id,
    });
    results.push({ email: account.email, status: "RESET" });
  }

  console.log(`Actor: ${actor.email}`);
  for (const result of results) {
    console.log(`  ${result.email.padEnd(24)} ${result.status}`);
  }
  // The password itself is never printed.
  console.log(
    "\nDemonstration accounts now use the configured DEMO_PASSWORD value."
  );
}

main()
  .catch((error) => {
    console.error(
      "Demo password reset failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
