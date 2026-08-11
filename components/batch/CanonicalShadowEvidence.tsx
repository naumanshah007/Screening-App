"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BatchCaseResult } from "@/lib/batch/types";
import { cn } from "@/lib/utils";

type CanonicalShadowEvidenceProps = {
  result: BatchCaseResult;
  reviewItemId?: string;
  canCorrectCanonicalFacts?: boolean;
};

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="w-36 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("flex-1 text-right text-xs font-medium text-foreground", mono && "font-mono")}>
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  );
}

export function CanonicalShadowEvidence({
  result,
  reviewItemId,
  canCorrectCanonicalFacts = false,
}: CanonicalShadowEvidenceProps) {
  const router = useRouter();
  const [factName, setFactName] = useState("");
  const [factStatus, setFactStatus] = useState("UNKNOWN");
  const [factValue, setFactValue] = useState("");
  const [factSource, setFactSource] = useState("REVIEWER_ENTRY");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState("");
  const shadow = result.canonicalShadow;
  const shadowReviewItemId = shadow?.reviewItemId;

  if (!shadow) return null;

  function parsedCorrectionValue() {
    const trimmed = factValue.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  async function correctCanonicalFact() {
    const targetReviewItemId = reviewItemId ?? shadowReviewItemId;
    if (!targetReviewItemId) return;
    setCorrecting(true);
    setCorrectionError("");
    try {
      const response = await fetch(`/api/batch/review/${targetReviewItemId}/canonical-facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factName,
          status: factStatus,
          ...(factStatus === "KNOWN" ? { value: parsedCorrectionValue() } : {}),
          source: factSource,
          reason: correctionReason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to correct canonical fact");
      setFactName("");
      setFactValue("");
      setCorrectionReason("");
      router.refresh();
    } catch (caught) {
      setCorrectionError(caught instanceof Error ? caught.message : "Unable to correct canonical fact");
    } finally {
      setCorrecting(false);
    }
  }

  return (
    <section aria-labelledby="canonical-shadow-heading" className="space-y-2">
      <h3 id="canonical-shadow-heading" className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
        Canonical V2 Shadow Comparison
      </h3>
      <div className="rounded-lg border border-brand-200 bg-brand-50/30 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/20">
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Comparison evidence only. The legacy decision remains authoritative. This shadow result is a provisional recommendation, requires reviewer confirmation, and is not for direct clinical action.
        </div>
        <Row label="Ruleset" value={shadow.ruleVersionDisplay} mono />
        <Row label="Checksum" value={shadow.rulesetChecksum} mono />
        <Row label="Evaluation mode" value={shadow.evaluationMode} mono />
        <Row label="Shadow outcome" value={shadow.provisionalRecommendation} />
        <Row label="Reviewer boundary" value={shadow.reviewerRequirement} />
        <Row label="Matched rules" value={shadow.matchedRuleIds.join(", ") || "Governance stop"} mono />
        <Row label="Missing facts" value={shadow.missingInformation.join(", ") || "None recorded"} mono />
        <Row label="Conflicting facts" value={shadow.factDiagnostics?.factsConflicting?.join(", ") || "None recorded"} mono />
        <Row label="Provenance" value={shadow.factDiagnostics?.provenanceSources?.join(", ") || "See canonical input snapshot"} />
        {/*
          The branch path below is the machine trace. This link opens the same
          governed pathway diagram the Guidelines surface uses, with this case's
          traversed rules and the controlling rule highlighted, so a reviewer can
          see where the case sits rather than reading raw node identifiers.
        */}
        {shadow.matchedRuleIds.length > 0 && (
          <div className="mt-3">
            <Link
              href={`/guidelines/pathway-for-rule/${encodeURIComponent(shadow.matchedRuleIds[0])}?rules=${encodeURIComponent(shadow.matchedRuleIds.join(","))}&controlling=${encodeURIComponent(shadow.matchedRuleIds[0])}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-card px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-brand-700 dark:text-brand-300"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden />
              Why this recommendation?
            </Link>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              Opens the governed guideline pathway with this case&apos;s traversed rules and the
              controlling rule highlighted.
            </p>
          </div>
        )}

        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Canonical branch path</p>
          <ol className="space-y-1">
            {shadow.branchPath.map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-2 break-all font-mono text-[11px] text-muted-foreground">
                <span className="w-5 shrink-0 text-right">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Source references</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {shadow.sourceReferences.map((source) => (
              <li key={`${source.document}:${source.reference}`}>{source.document} · {source.reference}</li>
            ))}
          </ul>
        </div>
        {canCorrectCanonicalFacts && (reviewItemId || shadow.reviewItemId) && (
          <div className="mt-4 border-t border-brand-200 pt-4 dark:border-brand-800">
            <p className="text-xs font-bold text-foreground">Add or correct one canonical fact, then rerun shadow simulation</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">The prior evaluation is preserved and linked. Completed decisions cannot use this control.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold">Fact name<input value={factName} onChange={(event) => setFactName(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs" placeholder="e.g. marginStatus" /></label>
              <label className="text-xs font-semibold">Status<select value={factStatus} onChange={(event) => setFactStatus(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs">{["KNOWN", "UNKNOWN", "NOT_RECORDED", "NOT_APPLICABLE", "PENDING", "CONFLICTING"].map((value) => <option key={value}>{value}</option>)}</select></label>
              {factStatus === "KNOWN" && <label className="text-xs font-semibold">Value<input value={factValue} onChange={(event) => setFactValue(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs" placeholder="text, number, true/false, or JSON array" /></label>}
              <label className="text-xs font-semibold">Provenance source<select value={factSource} onChange={(event) => setFactSource(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs">{["PARTICIPANT_REPORT", "LAB_RESULT", "PATHOLOGY", "COLPOSCOPY", "OPERATIVE_REPORT", "SPECIALIST_LETTER", "PRIOR_RECORD", "REVIEWER_ENTRY"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <label className="mt-2 block text-xs font-semibold">Correction reason<textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs" placeholder="Why this fact is being added or corrected (minimum 10 characters)." /></label>
            {correctionError && <div role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{correctionError}</div>}
            <Button className="mt-3" size="sm" loading={correcting} disabled={!factName.trim() || correctionReason.trim().length < 10 || (factStatus === "KNOWN" && !factValue.trim())} onClick={() => void correctCanonicalFact()}>Preserve prior and rerun shadow</Button>
          </div>
        )}
      </div>
    </section>
  );
}
