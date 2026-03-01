import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Prisma v7 requires the libsql adapter (same as lib/prisma.ts)
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Practice ──────────────────────────────────────────────────────────────
  const practice = await prisma.gPPractice.upsert({
    where: { hpiNumber: "G00001" },
    update: {},
    create: {
      name: "Auckland City Medical Centre",
      address: "123 Queen Street, Auckland 1010",
      dhbRegion: "Auckland",
      hpiNumber: "G00001",
    },
  });

  // ── Users — all share password "admin123" ─────────────────────────────────
  const pw = await bcrypt.hash("admin123", 10);

  const users = [
    {
      email: "admin@cs.nz",
      name: "System Admin",
      role: "ADMIN" as const,
      gpPracticeId: null,
    },
    {
      email: "clinician@cs.nz",
      name: "Dr. Sarah Smith",
      role: "GP" as const,
      gpPracticeId: practice.id,
    },
    {
      email: "coordinator@cs.nz",
      name: "Jane Coordinator",
      role: "COORDINATOR" as const,
      gpPracticeId: null,
    },
    {
      email: "specialist@cs.nz",
      name: "Dr. James Colposcopy",
      role: "COLPOSCOPIST" as const,
      gpPracticeId: practice.id,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        // Keep existing record but ensure password & role are up to date
        passwordHash: pw,
        role: u.role,
        name: u.name,
        ...(u.gpPracticeId ? { gpPracticeId: u.gpPracticeId } : {}),
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: pw,
        role: u.role,
        ...(u.gpPracticeId ? { gpPracticeId: u.gpPracticeId } : {}),
      },
    });
  }

  // ── Sample patients ───────────────────────────────────────────────────────
  const patients = [
    {
      nhi: "ZZZ0001",
      firstName: "Mary",
      lastName: "Johnson",
      dateOfBirth: new Date("1985-03-15"),
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
    },
    {
      nhi: "ZZZ0002",
      firstName: "Patricia",
      lastName: "Williams",
      dateOfBirth: new Date("1978-07-22"),
      isFirstTimeHPVTransition: true,
      previousScreeningType: "CYTOLOGY" as const,
      isPostHysterectomy: false,
    },
    {
      nhi: "ZZZ0003",
      firstName: "Linda",
      lastName: "Brown",
      dateOfBirth: new Date("1962-11-08"),
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: true,
    },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { nhi: p.nhi },
      update: {},
      create: {
        ...p,
        gpPracticeId: practice.id,
        medicalHistory: { create: {} },
      },
    });
  }

  console.log("\n✓ Seed complete — all accounts use password: admin123\n");
  console.log("  Username        Role");
  console.log("  ─────────────────────────────────────────");
  console.log("  admin           ADMIN");
  console.log("  clinician       GP / Clinician");
  console.log("  coordinator     COORDINATOR");
  console.log("  specialist      COLPOSCOPIST");
  console.log("\n  (append @cs.nz for full email, e.g. admin@cs.nz)\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
