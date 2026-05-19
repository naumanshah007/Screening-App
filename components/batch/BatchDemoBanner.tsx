"use client";

import { AlertTriangle } from "lucide-react";

export function BatchDemoBanner() {
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm leading-relaxed">
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          Demo / Proof of Concept
        </span>
        <span className="text-amber-700 dark:text-amber-400">
          {" "}&mdash; This batch processor is under validation.
          Results require clinical review and are not a substitute for professional judgement.
          Reviewer confirmation is required before acting on any recommendation.
        </span>
      </div>
    </div>
  );
}
