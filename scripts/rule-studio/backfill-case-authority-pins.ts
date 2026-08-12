/**
 * Backfill `CaseAuthorityPin` from verifiable existing case history.
 *
 * POLICY
 * ------
 * A case that has already received a clinical decision stays pinned to the
 * authority under which that decision was made. Before this backfill a Legacy
 * decision produced no pin, so a global activation could silently re-evaluate
 * the case under canonical.
 *
 * WHAT IT WRITES
 * --------------
 * Authority provenance only. It never touches the recommendation, clinical
 * content, decision timestamp, reviewer or rule result.
 *
 * GUARANTEES
 * ----------
 * - Idempotent: a case that already has a pin is skipped.
 * - Transactional: each pin and its audit row are written together.
 * - Fail-closed: a case whose history implies a different authority than an
 *   existing pin is reported as a conflict and left untouched.
 * - Auditable: every write emits an AuditLog row.
 *
 * Use --dry-run to report without writing.
 */

import { prisma } from "@/lib/prisma";
import { LEGACY_ENGINE_VERSION } from "@/lib/clinical-rules/authority";
import { isOperativeMode } from "@/lib/clinical-rules/pinning";

type Outcome = {
  scanned: number;
  created: number;
  skippedExisting: number;
  skippedNoHistory: number;
  conflicts: Array<{ caseId: string; reason: string }>;
};

export async function backfillCaseAuthorityPins(options: {
  dryRun?: boolean;
  actorUserId?: string | null;
} = {}): Promise<Outcome> {
  const outcome: Outcome = {
    scanned: 0,
    created: 0,
    skippedExisting: 0,
    skippedNoHistory: 0,
    conflicts: [],
  };

  const cases = await prisma.referralCase.findMany({
    select: {
      id: true,
      authorityPin: {
        select: { authorityEngine: true, origin: true, ruleVersionId: true },
      },
      ruleDecision: { select: { createdAt: true, generatedBy: true } },
      ruleEvaluations: {
        select: {
          id: true,
          ruleVersionId: true,
          ruleVersionDisplay: true,
          rulesetChecksum: true,
          engineVersion: true,
          evaluationMode: true,
          evaluatedAt: true,
        },
        orderBy: { evaluatedAt: "asc" },
      },
    },
  });

  for (const referralCase of cases) {
    outcome.scanned += 1;

    const firstOperative = referralCase.ruleEvaluations.find((evaluation) =>
      isOperativeMode(evaluation.evaluationMode)
    );

    // Determine the authority this case's history actually implies.
    const impliedEngine = firstOperative
      ? "CANONICAL"
      : referralCase.ruleDecision
        ? "LEGACY"
        : null;

    if (referralCase.authorityPin) {
      // Fail closed on disagreement — never silently overwrite an existing pin.
      if (impliedEngine && referralCase.authorityPin.authorityEngine !== impliedEngine) {
        outcome.conflicts.push({
          caseId: referralCase.id,
          reason:
            `Existing pin is ${referralCase.authorityPin.authorityEngine} but case history implies ` +
            `${impliedEngine}. Left unchanged for review.`,
        });
      } else {
        outcome.skippedExisting += 1;
      }
      continue;
    }

    if (!impliedEngine) {
      outcome.skippedNoHistory += 1;
      continue;
    }

    const data =
      impliedEngine === "CANONICAL" && firstOperative
        ? {
            caseId: referralCase.id,
            authorityEngine: "CANONICAL",
            ruleVersionId: firstOperative.ruleVersionId,
            ruleVersionDisplay: firstOperative.ruleVersionDisplay,
            rulesetChecksum: firstOperative.rulesetChecksum,
            engineVersion: firstOperative.engineVersion,
            evaluationId: firstOperative.id,
            evaluationMode: firstOperative.evaluationMode,
            pinnedAt: firstOperative.evaluatedAt,
            origin: "FIRST_OPERATIVE_EVALUATION",
          }
        : {
            caseId: referralCase.id,
            authorityEngine: "LEGACY",
            ruleVersionId: null,
            ruleVersionDisplay: null,
            rulesetChecksum: null,
            engineVersion: referralCase.ruleDecision?.generatedBy || LEGACY_ENGINE_VERSION,
            evaluationId: null,
            evaluationMode: null,
            pinnedAt: referralCase.ruleDecision!.createdAt,
            origin: "LEGACY_DECISION_BACKFILL",
          };

    if (options.dryRun) {
      outcome.created += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so concurrent runs cannot double-write.
      const existing = await tx.caseAuthorityPin.findUnique({ where: { caseId: referralCase.id } });
      if (existing) return;
      await tx.caseAuthorityPin.create({ data });
      await tx.auditLog.create({
        data: {
          userId: options.actorUserId ?? undefined,
          action: "CASE_AUTHORITY_PIN_BACKFILL",
          entity: "ReferralCase",
          entityId: referralCase.id,
          newValue: JSON.stringify({
            authorityEngine: data.authorityEngine,
            origin: data.origin,
            pinnedAt: data.pinnedAt,
            engineVersion: data.engineVersion,
          }),
        },
      });
    });
    outcome.created += 1;
  }

  return outcome;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const outcome = await backfillCaseAuthorityPins({ dryRun });
  console.log(JSON.stringify({ dryRun, ...outcome }, null, 2));
  if (outcome.conflicts.length > 0) {
    console.error(
      `\nFAIL CLOSED: ${outcome.conflicts.length} case(s) have conflicting authority history. ` +
        "No pin was changed for them. Review before activation."
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.includes("backfill-case-authority-pins")) {
  main()
    .catch((error) => {
      console.error("Backfill aborted:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
