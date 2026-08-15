"use client";

import Link from "next/link";
import { ArrowRight, Cable, FileSpreadsheet, Lock, ShieldCheck } from "lucide-react";

import { Panel, PanelInset, StatusBadge } from "@/components/system";

/**
 * Pull Cases shows operational intake context only. Connector configuration is
 * intentionally centralised in /admin/integrations so normal intake work never
 * becomes a second administration experience.
 */
export function IntegrationReadinessPanel({ canConfigure }: { canConfigure: boolean }) {
  return (
    <Panel
      title="Intake source readiness"
      description="Current intake is demonstration/file based. External connector configuration is managed separately."
      action={
        canConfigure ? (
          <Link
            href="/admin/integrations"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Integration Centre
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <PanelInset className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-foreground">File and synthetic intake</p>
              <StatusBadge size="sm" tone="success">Available</StatusBadge>
            </div>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">CSV, Excel, JSON and clearly labelled demonstration sources feed the existing validation workflow.</p>
          </div>
        </PanelInset>
        <PanelInset className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Cable className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-foreground">External connector intake</p>
              <StatusBadge size="sm" tone="neutral">Not connected</StatusBadge>
            </div>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">The connection has not been tested. Configuration readiness is not evidence of remote connectivity or a successful import.</p>
          </div>
        </PanelInset>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-[0.6875rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> No credential values in Pull Cases</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Source metadata remains attached to intake evidence</span>
      </div>
    </Panel>
  );
}
