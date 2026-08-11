import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
import { Alert } from "@/components/ui/alert";

/**
 * Legacy pathway router reference — technical provenance, not clinical guidance.
 *
 * Moved off the clinician-facing Guidelines surface so a clinician is never asked
 * to choose between "Legacy" and "Canonical" guideline systems. The router itself
 * is unchanged and is still the component that selects the pathway; this page
 * documents that role and nothing more.
 */

const ROUTER_STAGES = [
  [
    "1",
    "Global safety and eligibility",
    "Applies age eligibility, missing-data safety gates and cancer-suspicion precedence.",
  ],
  [
    "2",
    "Context precedence",
    "Selects special contexts such as abnormal bleeding, pregnancy and post-hysterectomy before ordinary screening.",
  ],
  [
    "3",
    "Clinical pathway selection",
    "Chooses the applicable governed pathway identifier (Figures 2–10 or Table 1).",
  ],
  [
    "4",
    "Canonical hand-off",
    "Passes the selected pathway as DERIVED_ROUTER provenance to CG-NCSP-3.1.0.",
  ],
] as const;

export default function TechnicalRouterReferencePage() {
  return (
    <div className="animate-fade-in space-y-6 p-6">
      <PageIntro
        eyebrow="Technical provenance"
        title="Legacy pathway router reference"
        description="Retained as an implementation component for pathway selection. This is not a competing clinical guideline system."
        breadcrumb={[
          { label: "Guidelines", href: "/guidelines" },
          { label: "Legacy pathway router reference" },
        ]}
        trailing={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Route className="h-3.5 w-3.5 text-accent-color" aria-hidden />
            Router provenance
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Technical Reference
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Legacy Pathway Router</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The Legacy router remains responsible for pathway selection. Governed canonical rules
            determine the within-pathway recommendation when canonical clinical authority is
            enabled.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {ROUTER_STAGES.map(([step, title, detail]) => (
            <div key={step} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
                  {step}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Alert variant="warning">
          <strong>Scope boundary:</strong> this reference documents pathway selection only. It does
          not present Legacy recommendation trees as current clinical guidance.
        </Alert>

        <Link
          href="/guidelines"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-color hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to current guidelines
        </Link>
      </div>
    </div>
  );
}
