import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
import { CURRENT_GUIDELINES_TITLE } from "@/lib/clinical-rules/current-guidelines";

/**
 * Shown when no governed rule version has been imported yet. The guidelines
 * surface is generated from governed content only — there is deliberately no
 * hand-maintained fallback diagram to drift from it.
 */
export function GuidelinesUnavailable() {
  return (
    <div className="animate-fade-in space-y-6 p-6">
      <div className="page-aura">
        <PageIntro eyebrow="Clinical guidance" title={CURRENT_GUIDELINES_TITLE} />
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-warn" aria-hidden />
        <h2 className="mt-3 text-base font-semibold text-foreground">
          No governed guideline version is available
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Guideline pathways are generated from the governed clinical rule set. Import or activate
          a version in Rule Studio to make them available here.
        </p>
        <Link
          href="/rules/clinical"
          className="mt-4 inline-flex items-center rounded-lg bg-accent-color px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open Rule Studio
        </Link>
      </div>
    </div>
  );
}
