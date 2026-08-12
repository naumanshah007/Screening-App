/**
 * Make CG-NCSP-3.1.0 the CURRENT GOVERNED RULESET for a demonstration
 * environment.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not touch the PRODUCTION clinical environment and it does not weaken
 * any production control. `assertProductionActivationPermitted` and
 * `assertProductionGovernanceGates` remain in force; this script simply refuses
 * to run against PRODUCTION at all, so the only way to reach production
 * activation is still the full governance path with real approvals.
 *
 * WHY THE APPROVALS HERE ARE HONEST
 * ---------------------------------
 * The approvals are given by the seeded demonstration clinical identities and
 * are stamped isDemo=true by createVersionAudit. They are therefore permanently
 * identifiable as demonstration attestations and are excluded from production
 * activation gates by assertProductionGovernanceGates. Nothing recorded here can
 * later be mistaken for an independent clinical sign-off.
 */

import { approveClinicalRuleVersion, activateClinicalRuleVersion, publishClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { getRuntimeClinicalEnvironment } from "@/lib/clinical-rules/authority";
import { isDemoModeEnabled } from "@/lib/config/demo-mode";
import { prisma } from "@/lib/prisma";

const TARGET_VERSION = process.env.TARGET_RULESET ?? "CG-NCSP-3.1.0";

async function main() {
  const environment = getRuntimeClinicalEnvironment();

  if (environment === "PRODUCTION") {
    throw new Error(
      "Refusing to run: the clinical environment resolves to PRODUCTION. " +
        "Production activation requires the full governance path with real " +
        "independent clinical approvals, not this script."
    );
  }
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Refusing to run: DEMO_MODE is off, so the demonstration clinical " +
        "identities used here would not be recorded as demonstration attestations."
    );
  }

  console.log(`Clinical environment: ${environment}`);

  const version = await prisma.clinicalRuleVersion.findFirst({
    where: { displayVersion: TARGET_VERSION },
    select: { id: true, displayVersion: true, status: true, revision: true, checksum: true, createdById: true },
  });
  if (!version) throw new Error(`${TARGET_VERSION} not found.`);
  console.log(`Version: ${version.displayVersion} status=${version.status} revision=${version.revision}`);

  // Clinical approvers: seeded demonstration identities holding genuine clinical
  // roles. Neither may be the draft creator, and they must be distinct people.
  const approverEmails = ["smo@cs.nz", "specialist@cs.nz", "gynae.grader@cs.nz"];
  const approvers = await prisma.user.findMany({
    where: { email: { in: approverEmails } },
    select: { id: true, email: true, role: true },
  });

  const existing = await prisma.ruleVersionAuditEvent.findMany({
    where: { ruleVersionId: version.id, eventType: "APPROVAL" },
    select: { actorUserId: true, afterJson: true },
  });
  const alreadyApproved = new Set(
    existing
      .filter((event) => {
        try {
          const e = JSON.parse(event.afterJson ?? "{}") as { revision?: number; checksum?: string };
          return e.revision === version.revision && e.checksum === version.checksum;
        } catch {
          return false;
        }
      })
      .map((event) => event.actorUserId)
      .filter((id): id is string => Boolean(id))
  );
  console.log(`Existing approvals for this revision/checksum: ${alreadyApproved.size}`);

  if (version.status === "VALIDATED") {
    for (const approver of approvers) {
      if (alreadyApproved.size >= 2) break;
      if (alreadyApproved.has(approver.id)) continue;
      if (approver.id === version.createdById) continue;
      try {
        await approveClinicalRuleVersion({
          id: version.id,
          actorUserId: approver.id,
          reason: `Demonstration clinical approval (${approver.role}) for the PoC environment.`,
        });
        alreadyApproved.add(approver.id);
        console.log(`APPROVED by ${approver.email} (${approver.role})`);
      } catch (error) {
        console.log(`  skip ${approver.email}: ${(error as Error).message}`);
      }
    }

    await publishClinicalRuleVersion({
      id: version.id,
      actorUserId: approvers[0]!.id,
      reason: "Publish as the demonstration baseline governed ruleset.",
      sourceSummary: `NCSP clinical guidelines — governed snapshot ${version.displayVersion}.`,
    });
    console.log("PUBLISHED");
  } else {
    console.log(`Publication skipped — status is already ${version.status}`);
  }

  // The activation operator must be distinct from every clinical approver —
  // separation of duties is enforced in activateClinicalRuleVersion, so the
  // operator is selected rather than assumed.
  const approverIds = new Set(
    (
      await prisma.ruleVersionAuditEvent.findMany({
        where: { ruleVersionId: version.id, eventType: "APPROVAL" },
        select: { actorUserId: true, afterJson: true },
      })
    )
      .filter((event) => {
        try {
          const e = JSON.parse(event.afterJson ?? "{}") as { revision?: number; checksum?: string };
          return e.revision === version.revision && e.checksum === version.checksum;
        } catch {
          return false;
        }
      })
      .map((event) => event.actorUserId)
      .filter((id): id is string => Boolean(id))
  );

  const operator = (
    await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    })
  ).find((candidate) => !approverIds.has(candidate.id));

  if (!operator) {
    throw new Error(
      "No ADMIN is available who is not also a clinical approver. Separation of " +
        "duties requires a distinct activation operator."
    );
  }

  await activateClinicalRuleVersion({
    id: version.id,
    actorUserId: operator.id,
    environment,
    reason: `Set ${version.displayVersion} as the current governed ruleset for the ${environment} environment.`,
  });
  console.log(`ACTIVATED in ${environment} by ${operator.email}`);

  const current = await getCurrentGovernedRuleset({ environment });
  console.log(
    `CURRENT GOVERNED RULESET: ${current?.displayVersion ?? "none"} checksum=${current?.checksum?.slice(0, 16) ?? "-"}`
  );
}

main()
  .catch((error) => {
    console.error("Activation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
