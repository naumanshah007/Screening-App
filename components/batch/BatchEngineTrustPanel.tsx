"use client";

/**
 * Calm, production-grade trust strip shown at the top of the batch page.
 *
 * Replaces the loud "DEMO / POC" banner with credibility signals that
 * matter to clinical buyers (CMO, governance, IT):
 *   - Engine version + last reviewed date
 *   - NCSP Guideline citation
 *   - Pathway figures covered
 *   - Automated test count
 *   - A small but unambiguous "Demo environment" badge
 */

import { ShieldCheck, BookOpen, GitBranch, FlaskConical, AlertTriangle } from "lucide-react";
import { ENGINE_VERSION } from "@/lib/batch/processor";

const NCSP_GUIDELINE_VERSION = "NCSP Clinical Practice Guidelines — HPV Primary (2023+ updates)";
const FIGURES_COVERED = "Figures 1–10 + Table 1";
const TEST_COUNT = 104;

function Item({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-xs font-medium text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

export function BatchEngineTrustPanel() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Top strip: trust signals */}
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Item
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Engine Version"
          value={<span className="font-mono">{ENGINE_VERSION}</span>}
        />
        <Item
          icon={<BookOpen className="h-4 w-4" />}
          label="Guideline Source"
          value={NCSP_GUIDELINE_VERSION}
        />
        <Item
          icon={<GitBranch className="h-4 w-4" />}
          label="Pathways Covered"
          value={FIGURES_COVERED}
        />
        <Item
          icon={<FlaskConical className="h-4 w-4" />}
          label="Engine Status"
          value={`${TEST_COUNT} automated tests · guideline-aligned prototype · under clinical validation`}
        />
      </div>

      {/* Bottom strip: calm POC notice */}
      <div className="px-4 py-2 border-t border-border bg-amber-50/40 dark:bg-amber-950/20 flex items-center gap-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
          <strong>Demo / validation environment.</strong>{" "}
          <span className="text-amber-700 dark:text-amber-400">
            Results require clinical review before action. Reviewer confirmation required for
            ambiguous cases.
          </span>
        </p>
      </div>
    </div>
  );
}
