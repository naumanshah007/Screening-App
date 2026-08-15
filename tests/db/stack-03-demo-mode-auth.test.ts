/**
 * Demonstration mode — account administration and governance isolation.
 *
 * The load-bearing property is that a demonstration attestation can never be
 * mistaken for, or promoted into, a real clinical approval — including after
 * DEMO_MODE is turned off.
 */

import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { USER_AUDIT_ACTION } from "@/lib/admin/user-audit";
import {
  resetUserPassword,
  resetUserToDemoPassword,
  setUserEnabled,
} from "@/lib/admin/user-management";

const RUN = `DEMOTEST-${Date.now()}`;
const STRONG_PASSWORD = "CorrectHorseBatteryStaple9";
const SHORT_DEMO_PASSWORD = "demo1234";

async function makeUser(
  suffix: string,
  overrides: { role?: "ADMIN" | "GP"; isDemoAccount?: boolean } = {}
) {
  return prisma.user.create({
    data: {
      email: `${RUN}-${suffix}@validation.invalid`,
      name: `Demo Test ${suffix}`,
      role: overrides.role ?? "GP",
      isDemoAccount: overrides.isDemoAccount ?? false,
      passwordHash: await bcrypt.hash("initial-placeholder-value", 10),
    },
  });
}

async function withDemoMode<T>(value: string, run: () => Promise<T>) {
  const previous = process.env.DEMO_MODE;
  const previousPassword = process.env.DEMO_PASSWORD;
  process.env.DEMO_MODE = value;
  process.env.DEMO_PASSWORD = SHORT_DEMO_PASSWORD;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
    if (previousPassword === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = previousPassword;
  }
}

test("an admin password reset stores a bcrypt hash, never plaintext", async () => {
  const admin = await makeUser("hash-admin", { role: "ADMIN" });
  const target = await makeUser("hash-target");

  await resetUserPassword({
    targetUserId: target.id,
    changedByUserId: admin.id,
    password: STRONG_PASSWORD,
  });

  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { passwordHash: true, sessionVersion: true },
  });

  assert.ok(stored.passwordHash, "a hash must be stored");
  assert.notEqual(
    stored.passwordHash,
    STRONG_PASSWORD,
    "the plaintext must never be stored"
  );
  assert.match(stored.passwordHash!, /^\$2[aby]\$/, "must be a bcrypt hash");
  assert.ok(
    await bcrypt.compare(STRONG_PASSWORD, stored.passwordHash!),
    "the stored hash must verify against the password that was set"
  );
  assert.equal(stored.sessionVersion, 1, "credential reset must revoke issued JWTs");
});

test("the existing password can never be read back", async () => {
  const admin = await makeUser("readback-admin", { role: "ADMIN" });
  const target = await makeUser("readback-target");

  await resetUserPassword({
    targetUserId: target.id,
    changedByUserId: admin.id,
    password: STRONG_PASSWORD,
  });

  // Everything the administration surface returns about a user.
  const record = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
  });

  const serialised = JSON.stringify(record);
  assert.doesNotMatch(
    serialised,
    new RegExp(STRONG_PASSWORD),
    "no representation of the user may contain the plaintext password"
  );

  // The hash is one-way: it does not reveal the password.
  assert.notEqual(record.passwordHash, STRONG_PASSWORD);
});

test("a password reset is audited without recording any credential", async () => {
  const admin = await makeUser("audit-admin", { role: "ADMIN" });
  const target = await makeUser("audit-target");

  await resetUserPassword({
    targetUserId: target.id,
    changedByUserId: admin.id,
    password: STRONG_PASSWORD,
  });

  const entry = await prisma.auditLog.findFirst({
    where: {
      entityId: target.id,
      action: USER_AUDIT_ACTION.PASSWORD_RESET_BY_ADMIN,
    },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(entry, "the reset must be audited");
  assert.equal(entry!.userId, admin.id, "the actor must be recorded");
  assert.equal(entry!.entityId, target.id, "the target must be recorded");

  const payload = `${entry!.newValue ?? ""}${entry!.oldValue ?? ""}`;
  assert.doesNotMatch(
    payload,
    new RegExp(STRONG_PASSWORD),
    "the audit row must not contain the plaintext password"
  );
  assert.doesNotMatch(
    payload,
    /\$2[aby]\$/,
    "the audit row must not contain the password hash"
  );

  const details = JSON.parse(entry!.newValue!) as Record<string, unknown>;
  assert.equal(details.demoMode, false);
  assert.ok("environment" in details, "environment must be recorded");
});

test("the generic reset path enforces the full password policy length", async () => {
  const admin = await makeUser("policy-admin", { role: "ADMIN" });
  const target = await makeUser("policy-target");

  await assert.rejects(
    () =>
      resetUserPassword({
        targetUserId: target.id,
        changedByUserId: admin.id,
        password: SHORT_DEMO_PASSWORD,
      }),
    /at least 12 characters/,
    "the short demo password must be refused on the normal administrative path"
  );
});

test("requirePasswordChange controls the next-login gate", async () => {
  const admin = await makeUser("mustchange-admin", { role: "ADMIN" });
  const target = await makeUser("mustchange-target");

  await resetUserPassword({
    targetUserId: target.id,
    changedByUserId: admin.id,
    password: STRONG_PASSWORD,
  });
  let record = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(
    record.passwordChangeRequired,
    true,
    "a reset must force a change by default"
  );

  await resetUserPassword({
    targetUserId: target.id,
    changedByUserId: admin.id,
    password: `${STRONG_PASSWORD}-2`,
    requirePasswordChange: false,
  });
  record = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(record.passwordChangeRequired, false);
});

test("reset-to-demo-password refuses while demo mode is off", async () => {
  const admin = await makeUser("demooff-admin", { role: "ADMIN" });
  const target = await makeUser("demooff-target", { isDemoAccount: true });

  const previous = process.env.DEMO_MODE;
  delete process.env.DEMO_MODE;
  try {
    await assert.rejects(
      () =>
        resetUserToDemoPassword({
          targetUserId: target.id,
          changedByUserId: admin.id,
        }),
      /only available when DEMO_MODE is enabled/
    );
  } finally {
    if (previous !== undefined) process.env.DEMO_MODE = previous;
  }
});

test("reset-to-demo-password refuses a real account even in demo mode", async () => {
  const admin = await makeUser("realacct-admin", { role: "ADMIN" });
  const realUser = await makeUser("realacct-target", { isDemoAccount: false });

  await withDemoMode("true", async () => {
    await assert.rejects(
      () =>
        resetUserToDemoPassword({
          targetUserId: realUser.id,
          changedByUserId: admin.id,
        }),
      /Only demonstration accounts/,
      "the policy-length bypass must never reach a real account"
    );
  });
});

test("reset-to-demo-password sets the demo credential and audits it as demo", async () => {
  const admin = await makeUser("demoreset-admin", { role: "ADMIN" });
  const demoUser = await makeUser("demoreset-target", { isDemoAccount: true });

  await withDemoMode("true", async () => {
    await resetUserToDemoPassword({
      targetUserId: demoUser.id,
      changedByUserId: admin.id,
    });
  });

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: demoUser.id },
  });
  assert.ok(
    await bcrypt.compare(SHORT_DEMO_PASSWORD, record.passwordHash!),
    "the demo account must authenticate with the demo password"
  );
  assert.equal(
    record.passwordChangeRequired,
    false,
    "a demo account must stay immediately reusable"
  );

  const entry = await prisma.auditLog.findFirst({
    where: {
      entityId: demoUser.id,
      action: USER_AUDIT_ACTION.DEMO_PASSWORD_RESET,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(entry, "a demo reset must be audited under its own action");
  const details = JSON.parse(entry!.newValue!) as Record<string, unknown>;
  assert.equal(details.demoMode, true, "the audit row must record demo provenance");
  assert.doesNotMatch(
    entry!.newValue!,
    new RegExp(SHORT_DEMO_PASSWORD),
    "the audit row must not contain the demo password"
  );
});

test("enabling and disabling an account is audited under distinct actions", async () => {
  const admin = await makeUser("status-admin", { role: "ADMIN" });
  // A second admin so disabling is not blocked by the last-admin guard.
  await makeUser("status-admin-2", { role: "ADMIN" });
  const target = await makeUser("status-target");

  await setUserEnabled({
    targetUserId: target.id,
    changedByUserId: admin.id,
    isActive: false,
    reason: "Test disable",
  });
  let record = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(record.isActive, false);
  assert.equal(record.sessionVersion, 1, "disable must invalidate existing sessions");

  const disabled = await prisma.auditLog.findFirst({
    where: { entityId: target.id, action: USER_AUDIT_ACTION.USER_DISABLED },
  });
  assert.ok(disabled, "disabling must be audited as USER_DISABLED");
  assert.match(disabled!.newValue!, /Test disable/, "the reason must be recorded");

  await setUserEnabled({
    targetUserId: target.id,
    changedByUserId: admin.id,
    isActive: true,
  });
  record = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(record.isActive, true);
  assert.equal(record.sessionVersion, 2, "re-enable must not revive an old session");

  const enabled = await prisma.auditLog.findFirst({
    where: { entityId: target.id, action: USER_AUDIT_ACTION.USER_ENABLED },
  });
  assert.ok(enabled, "enabling must be audited as USER_ENABLED");
});

test("the last active admin cannot be disabled", async () => {
  // Isolate: count existing active admins and disable down to one.
  const soleAdmin = await makeUser("last-admin", { role: "ADMIN" });
  const otherAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, id: { not: soleAdmin.id } },
    select: { id: true },
  });

  await prisma.user.updateMany({
    where: { id: { in: otherAdmins.map((a) => a.id) } },
    data: { isActive: false },
  });

  try {
    await assert.rejects(
      () =>
        setUserEnabled({
          targetUserId: soleAdmin.id,
          changedByUserId: soleAdmin.id,
          isActive: false,
        }),
      /last remaining active admin/
    );
  } finally {
    await prisma.user.updateMany({
      where: { id: { in: otherAdmins.map((a) => a.id) } },
      data: { isActive: true },
    });
  }
});

test("a disabled account is refused before any password comparison", async () => {
  const target = await makeUser("disabled-auth");
  await prisma.user.update({
    where: { id: target.id },
    data: {
      isActive: false,
      passwordHash: await bcrypt.hash(STRONG_PASSWORD, 10),
    },
  });

  // The credentials provider reads isActive and throws before comparing. Assert
  // the persisted state the provider depends on, and that the correct password
  // does not change it.
  const record = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
  });
  assert.equal(record.isActive, false);
  assert.ok(
    await bcrypt.compare(STRONG_PASSWORD, record.passwordHash!),
    "the password is still correct — only the disabled flag should block sign-in"
  );

  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(
      new URL("../../lib/auth.ts", import.meta.url).pathname,
      "utf8"
    )
  );
  const disabledCheckIndex = source.indexOf("!user.isActive");
  const compareIndex = source.indexOf("bcrypt.compare");
  assert.ok(disabledCheckIndex > 0, "auth must check isActive");
  assert.ok(
    disabledCheckIndex < compareIndex,
    "the disabled check must run before the password comparison"
  );
});
