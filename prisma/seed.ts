import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create GP practice
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

  // Create users
  const adminHash = await bcrypt.hash("Admin1234!", 10);
  const gpHash = await bcrypt.hash("GP1234!", 10);
  const coordHash = await bcrypt.hash("Coord1234!", 10);

  await prisma.user.upsert({
    where: { email: "admin@cervical.nz" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@cervical.nz",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "dr.smith@cervical.nz" },
    update: {},
    create: {
      name: "Dr. Sarah Smith",
      email: "dr.smith@cervical.nz",
      passwordHash: gpHash,
      role: "GP",
      gpPracticeId: practice.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "coordinator@cervical.nz" },
    update: {},
    create: {
      name: "Jane Coordinator",
      email: "coordinator@cervical.nz",
      passwordHash: coordHash,
      role: "COORDINATOR",
    },
  });

  // Create sample patients
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

  console.log("✓ Seed data created");
  console.log("  Admin:       admin@cervical.nz / Admin1234!");
  console.log("  GP:          dr.smith@cervical.nz / GP1234!");
  console.log("  Coordinator: coordinator@cervical.nz / Coord1234!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
