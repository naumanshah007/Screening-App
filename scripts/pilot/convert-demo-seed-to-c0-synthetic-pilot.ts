import os from "node:os";
import path from "node:path";
import { realpathSync } from "node:fs";

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generate } from "otplib";

const IDENTITY_MAP: Record<string, { email: string; name: string; enrolled: boolean }> = {
  "admin@cs.nz": { email: "c0.admin@example.invalid", name: "C0 Synthetic Administrator", enrolled: true },
  "deputy.admin@cs.nz": {
    email: "c0.deputy.admin@example.invalid",
    name: "C0 Synthetic Deputy Administrator",
    enrolled: true,
  },
  "smo@cs.nz": { email: "c0.reviewer@example.invalid", name: "C0 Synthetic Reviewer", enrolled: true },
  "specialist@cs.nz": {
    email: "c0.colposcopist@example.invalid",
    name: "C0 Synthetic Colposcopist",
    enrolled: true,
  },
  "colpo.cns@cs.nz": { email: "c0.cns@example.invalid", name: "C0 Synthetic CNS", enrolled: true },
  "gynae.grader@cs.nz": {
    email: "c0.gynae@example.invalid",
    name: "C0 Synthetic Gynae Reviewer",
    enrolled: true,
  },
  "integration.admin@cs.nz": {
    email: "c0.integration@example.invalid",
    name: "C0 Synthetic Integration Administrator",
    enrolled: true,
  },
  "coordinator@cs.nz": {
    email: "c0.coordinator@example.invalid",
    name: "C0 Synthetic Coordinator",
    enrolled: true,
  },
  "clinician@cs.nz": {
    email: "c0.gp.enrol@example.invalid",
    name: "C0 Synthetic GP Enrolment",
    enrolled: false,
  },
  "gp.manukau@cs.nz": {
    email: "c0.gp.scoped@example.invalid",
    name: "C0 Synthetic Scoped GP",
    enrolled: true,
  },
};

function resolveSafeDatabaseUrl() {
  if (process.env.C0_SYNTHETIC_REHEARSAL !== "1") {
    throw new Error("C0_SYNTHETIC_REHEARSAL=1 is required.");
  }
  const url = process.env.C0_SYNTHETIC_DATABASE_URL?.trim();
  if (!url?.startsWith("file:")) {
    throw new Error("C0 conversion accepts only an isolated file: database.");
  }
  const databasePath = path.resolve(url.slice("file:".length));
  const realDatabasePath = path.join(realpathSync(path.dirname(databasePath)), path.basename(databasePath));
  const allowedTempRoots = [realpathSync(os.tmpdir()), realpathSync("/tmp")];
  const inApprovedTempRoot = allowedTempRoots.some((root) => {
    const relative = path.relative(root, realDatabasePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });
  if (
    !inApprovedTempRoot ||
    !databasePath.includes("cervigrade-c0-")
  ) {
    throw new Error("C0 conversion database must be an explicitly named OS-temporary path.");
  }
  return `file:${databasePath}`;
}

async function main() {
  const password = process.env.C0_SYNTHETIC_PASSWORD?.trim();
  const totpSecret = process.env.C0_SYNTHETIC_TOTP_SECRET?.trim();
  if (!password || password.length < 20 || !totpSecret) {
    throw new Error("A 20+ character synthetic password and C0_SYNTHETIC_TOTP_SECRET are required.");
  }
  try {
    await generate({ strategy: "totp", secret: totpSecret });
  } catch {
    throw new Error("C0_SYNTHETIC_TOTP_SECRET must be a valid authenticator secret of at least 128 bits.");
  }

  const adapter = new PrismaLibSql({ url: resolveSafeDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const users = await prisma.user.findMany({
      where: { email: { in: Object.keys(IDENTITY_MAP) } },
      select: { id: true, email: true, isDemoAccount: true },
    });
    if (users.length !== Object.keys(IDENTITY_MAP).length || users.some((user) => !user.isDemoAccount)) {
      throw new Error("Expected every synthetic seed identity to be explicitly marked as demo before conversion.");
    }

    for (const user of users) {
      const identity = IDENTITY_MAP[user.email];
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: identity.email,
          name: identity.name,
          passwordHash,
          passwordChangeRequired: false,
          passwordChangedAt: new Date(),
          passwordExpiresAt: null,
          twoFAEnabled: identity.enrolled,
          twoFASecret: identity.enrolled ? totpSecret : null,
          twoFARecoveryCodesJson: null,
          failedAttempts: 0,
          lockedUntil: null,
          isActive: true,
          isDemoAccount: false,
          sessionVersion: { increment: 1 },
        },
      });
    }

    const converted = await prisma.user.findMany({
      where: { email: { endsWith: "@example.invalid" } },
      select: { role: true, twoFAEnabled: true, isDemoAccount: true },
    });
    if (converted.length !== Object.keys(IDENTITY_MAP).length || converted.some((user) => user.isDemoAccount)) {
      throw new Error("Synthetic PILOT identity conversion did not complete safely.");
    }

    console.log(
      JSON.stringify({
        status: "PASS",
        data: "synthetic-only",
        convertedAccounts: converted.length,
        mfaEnrolled: converted.filter((user) => user.twoFAEnabled).length,
        enrollmentRestricted: converted.filter((user) => !user.twoFAEnabled).length,
        demoAccountsRemaining: 0,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "C0 synthetic identity conversion failed.");
  process.exit(1);
});
