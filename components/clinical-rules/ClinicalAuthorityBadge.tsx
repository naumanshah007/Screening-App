"use client";

import { cn } from "@/lib/utils";

/**
 * Clinical authority provenance.
 *
 * Under the pinning policy the Review Queue and Completed Decisions can contain
 * decisions from BOTH authorities at once. Without a visible badge a reviewer
 * silently compares incomparable decisions, so this is the highest-priority UI
 * element of the cutover.
 *
 * While authority is legacy, the badge must say so plainly and must never imply
 * canonical is clinically active.
 */

export type ClinicalAuthorityBadgeProps = {
  authorityEngine: "LEGACY" | "CANONICAL";
  /** e.g. "CG-NCSP-3.1.0". */
  ruleSetVersion?: string | null;
  /** Full ruleset checksum; displayed truncated. */
  ruleSetChecksum?: string | null;
  /** SHADOW and SIMULATION are not clinically operative. */
  evaluationMode?: "LIVE_PRODUCTION" | "LIVE_DEMO" | "SHADOW" | "SIMULATION" | null;
  /** The routing engine — always legacy, since canonical has no router. */
  routerEngine?: string | null;
  /** True when this decision superseded an earlier evaluation. */
  isRegrade?: boolean;
  className?: string;
};

const MODE_LABEL: Record<string, string> = {
  LIVE_PRODUCTION: "Live",
  LIVE_DEMO: "Demo",
  SHADOW: "Shadow",
  SIMULATION: "Simulation",
};

export function ClinicalAuthorityBadge({
  authorityEngine,
  ruleSetVersion,
  ruleSetChecksum,
  evaluationMode,
  routerEngine,
  isRegrade,
  className,
}: ClinicalAuthorityBadgeProps) {
  const isCanonicalAuthority = authorityEngine === "CANONICAL" && Boolean(ruleSetVersion);
  // Only a live mode is clinically operative. Anything else is a comparison
  // artefact and must not be presented as the deciding authority.
  const isOperative =
    evaluationMode === "LIVE_PRODUCTION" || evaluationMode === "LIVE_DEMO";

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        isCanonicalAuthority && isOperative
          ? "border-info/30 bg-info/5 text-foreground dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
      title={
        isCanonicalAuthority && isOperative
          ? `Clinical authority: canonical ${ruleSetVersion}. Pathway routing remains legacy${
              routerEngine ? ` (${routerEngine})` : ""
            }.`
          : "Clinical authority: legacy engine. Canonical rules are recorded for comparison only and are not clinically active."
      }
    >
      <span className="font-medium">
        {isCanonicalAuthority && isOperative ? `Canonical ${ruleSetVersion}` : "Legacy"}
      </span>

      {ruleSetChecksum && isCanonicalAuthority && isOperative ? (
        <span className="font-mono text-[10px] opacity-70">{ruleSetChecksum.slice(0, 12)}</span>
      ) : null}

      {/* A non-operative canonical evaluation is named explicitly so it can never
          be mistaken for the deciding authority. */}
      {ruleSetVersion && !isOperative ? (
        <span className="opacity-80">
          · {ruleSetVersion} {MODE_LABEL[evaluationMode ?? ""] ?? "not active"}
        </span>
      ) : null}

      {isRegrade ? (
        <span className="rounded border border-warn/30 bg-warn/5 px-1 text-[10px] font-medium">
          Regrade
        </span>
      ) : null}
    </span>
  );
}

/**
 * Persistent header indicator: which engine is clinically authoritative right
 * now, and the status of the canonical ruleset.
 */
export function ActiveClinicalAuthorityIndicator({
  authorityEngine,
  ruleSetVersion,
  canonicalStatus,
  className,
}: {
  authorityEngine: "LEGACY" | "CANONICAL";
  ruleSetVersion?: string | null;
  /** The canonical version's lifecycle status, e.g. "DRAFT". */
  canonicalStatus?: string | null;
  className?: string;
}) {
  const canonicalActive = authorityEngine === "CANONICAL" && Boolean(ruleSetVersion);
  return (
    <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
      <span>
        <span className="text-muted-foreground">Clinical authority: </span>
        <span className="font-medium">
          {canonicalActive ? `Canonical ${ruleSetVersion}` : "Legacy"}
        </span>
      </span>
      {!canonicalActive && ruleSetVersion ? (
        <span className="text-muted-foreground">
          {ruleSetVersion}: {canonicalStatus ?? "DRAFT"} · shadow/simulation only, not clinically active
        </span>
      ) : null}
    </div>
  );
}
