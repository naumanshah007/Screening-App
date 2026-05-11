"use client";

import Link from "next/link";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { ServiceLineBadge, StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceLine, CaseStatus } from "@prisma/client";

type Props = {
  caseId: string;
  patientName: string;
  nhi: string;
  serviceLine: ServiceLine;
  status: CaseStatus;
  hasDocuments: boolean;
  hasSummary: boolean;
  summaryApproved: boolean;
  hasRuleDecision: boolean;
  hasClinicianDecision: boolean;
};

export function TriageActionBar({
  caseId,
  patientName,
  nhi,
  serviceLine,
  status,
  hasDocuments,
  hasSummary,
  summaryApproved,
  hasRuleDecision,
  hasClinicianDecision,
}: Props) {
  const step1Ok = hasDocuments;
  const step2Ok = summaryApproved;
  const step3Ok = hasRuleDecision;
  const step4Ok = hasClinicianDecision;

  return (
    <div className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
        {/* Back link */}
        <Link
          href={`/cases/${caseId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Cases</span>
        </Link>

        <div className="w-px h-5 bg-muted/60 shrink-0" />

        {/* Patient info */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground text-sm truncate">{patientName}</span>
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{nhi}</span>
          <ServiceLineBadge serviceLine={serviceLine} />
          <StatusBadge status={status} />
        </div>

        <div className="flex-1" />

        {/* Workflow steps indicator */}
        <div className="hidden md:flex items-center gap-1 text-xs">
          <StepPill done={step1Ok} active={!step1Ok} label="1. Pack" />
          <div className="w-4 h-px bg-muted/60" />
          <StepPill done={step2Ok} active={step1Ok && !step2Ok} label="2. Summary" />
          <div className="w-4 h-px bg-muted/60" />
          <StepPill done={step3Ok} active={step2Ok && !step3Ok} label="3. Recommend" />
          <div className="w-4 h-px bg-muted/60" />
          <StepPill done={step4Ok} active={step3Ok && !step4Ok} label="4. Confirm" />
        </div>

        <div className="w-px h-5 bg-muted/60 shrink-0 hidden md:block" />

        {/* Export PDF */}
        {hasSummary && (
          <Link
            href={`/cases/${caseId}/summary/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Export PDF
          </Link>
        )}
      </div>
    </div>
  );
}

function StepPill({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        done
          ? "bg-success/10 text-success"
          : active
            ? "bg-info/10 text-info"
            : "bg-muted text-muted-foreground"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : active ? (
        <div className="h-2 w-2 rounded-full bg-info/50 animate-pulse" />
      ) : (
        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      )}
      {label}
    </div>
  );
}
