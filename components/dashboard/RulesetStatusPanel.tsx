import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import type { ClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";

/**
 * Clinical authority and canonical ruleset status.
 *
 * SAFETY RULES, enforced here rather than left to the caller:
 *
 *  - The operative authority is stated first and unambiguously.
 *  - The canonical ruleset is shown with its REAL lifecycle status from the
 *    database, and is described as authoritative ONLY when it genuinely is —
 *    that is, when the resolved engine is canonical and the evaluation mode is
 *    operative. A non-operative ruleset is never described as "Live".
 *  - Canonical is only ever presented as the authority when the backend says
 *    the engine is canonical AND the evaluation mode is genuinely operative.
 *    Anything else renders as Legacy.
 */
export function RulesetStatusPanel({ authority }: { authority: ClinicalAuthorityDisplay }) {
  const canonicalIsOperative =
    authority.authorityEngine === "CANONICAL" &&
    (authority.canonicalMode === "LIVE_PRODUCTION" || authority.canonicalMode === "LIVE_DEMO");

  // Deliberately avoids the word "Live" for a non-operative ruleset.
  const modeLabel =
    authority.canonicalMode === "SIMULATION"
      ? "Simulation enabled"
      : authority.canonicalMode === "SHADOW"
        ? "Shadow evaluation available"
        : authority.canonicalMode === "NOT_EVALUATED"
          ? "Not yet evaluated"
          : authority.canonicalMode;

  return (
    <section
      aria-label="Governance and ruleset status"
      className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,30,50,0.04)]"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700 dark:bg-navy-900/50 dark:text-navy-200"
            aria-hidden
          >
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Governance &amp; ruleset status</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Clinical governance ensures safe, consistent and explainable decisions.
            </p>
          </div>
        </div>

        <div className="min-w-[190px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Current clinical authority
          </p>
          <p className="mt-1 flex items-center gap-2">
            <span className="rounded-md border border-border bg-muted px-2 py-1 text-sm font-semibold text-foreground">
              {/* Clinician-facing wording. The internal engine name belongs on
                  governance, Rule Studio, audit and provenance surfaces — not
                  here. The version itself is still shown alongside. */}
              {canonicalIsOperative && authority.canonicalVersion
                ? "Current governed rules"
                : "Legacy Engine"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pathway routing: Legacy router
          </p>
        </div>

        <div className="min-w-[230px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {/* "Shadow" is only true while canonical is NOT deciding cases.
                Once it is operative this heading would actively mislead. */}
            {canonicalIsOperative ? "Current ruleset" : "Canonical shadow"}
          </p>
          {authority.canonicalVersion ? (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {authority.canonicalVersion}
                </span>
                <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {authority.canonicalStatus ?? "DRAFT"}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {/* Only claim "not authoritative" when that is actually true.
                    Once the ruleset is operative it decides new cases, and
                    saying otherwise would misrepresent the live system. */}
                {canonicalIsOperative
                  ? `${modeLabel} · deciding new cases`
                  : `${modeLabel} · not clinically authoritative`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No canonical ruleset loaded in this environment.
            </p>
          )}
        </div>

        <Link
          href="/rules/clinical"
          className="ml-auto inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          View Rule Governance →
        </Link>
      </div>
    </section>
  );
}
