import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { ENGINE_VERSION } from "@/lib/batch/processor";
import { BatchPageClient } from "./BatchPageClient";

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
  const current = await getCurrentGovernedRuleset().catch(() => null);

  return (
    <BatchPageClient
      currentRuleset={
        current
          ? { displayVersion: current.displayVersion, status: "Active" }
          : null
      }
      routingService={ENGINE_VERSION}
    />
  );
}
