import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { ENGINE_VERSION } from "@/lib/batch/processor";
import { BatchPageClient } from "./BatchPageClient";
import { getServerSession } from "@/lib/auth/server-session";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { isEvaluationAccount } from "@/lib/auth/evaluation-mode";

/**
 * /batch — Case Intake
 *
 * Server Component wrapper: enforces the ENABLE_BATCH_DEMO feature flag and
 * resolves the current governed ruleset so the intake screen can name the rules
 * that will actually decide these cases. Resolving it here rather than in the
 * client keeps the single source of truth on the server.
 *
 * The interactive state lives in BatchPageClient (a Client Component).
 */
export const dynamic = "force-dynamic";

export default async function BatchPage() {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  // Null is a legitimate answer meaning no governed ruleset is active. It is
  // surfaced as "Not configured" rather than silently substituted.
  const [current, session] = await Promise.all([
    getCurrentGovernedRuleset().catch(() => null),
    getServerSession(),
  ]);
  const sessionUser = session?.user as { role?: string; email?: string | null } | undefined;
  const role = sessionUser?.role;
  // Under the evaluation boundary the intake screen offers exactly one
  // source and no way to alter the supplied cases. The server refuses these
  // operations regardless; withholding the controls keeps the screen honest
  // about what is available rather than presenting actions that will fail.
  const evaluationMode = isEvaluationAccount(sessionUser);

  return (
    <BatchPageClient
      currentRuleset={
        current
          ? { displayVersion: current.displayVersion, status: "Active" }
          : null
      }
      routingService={ENGINE_VERSION}
      canConfigureIntegrations={!evaluationMode && isAuthorizedForRoute("/admin/integrations", role)}
      evaluationMode={evaluationMode}
    />
  );
}
