"use client";

import { SlideOver } from "@/components/ui/slide-over";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, Clock, GitBranch, FileText, User, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";

interface BatchResultDetailProps {
  result: BatchCaseResult | null;
  open: boolean;
  onClose: () => void;
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-1.5", className)}>
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function BatchResultDetail({ result, open, onClose }: BatchResultDetailProps) {
  if (!result) return null;

  const { decision } = result;
  const c = result.case;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={c.label || c.source.externalPatientId || `Row ${c.source.rowNumber}`}
      subtitle={`Processed in ${result.processingTimeMs}ms`}
      width="lg"
    >
      <div className="space-y-6">
        {/* Hero card */}
        {result.status === "success" ? (
          <Card className="border-l-4 border-l-brand-600">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Decision Pathway</div>
                  <div className="text-lg font-bold text-foreground">
                    {decision.figure?.replace(/_/g, " ") ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {decision.recommendation}
                  </div>
                </div>
                <RiskBadge risk={decision.riskLevel} size="md" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="py-4">
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">Processing Error</div>
              <div className="text-sm text-muted-foreground mt-1">{result.error}</div>
            </CardContent>
          </Card>
        )}

        {/* Recommendation details */}
        {result.status === "success" && (
          <>
            <DetailSection title="Recommendation" icon={<Stethoscope className="h-3.5 w-3.5" />}>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
                <DetailRow label="Code" value={decision.recommendationCode} />
                <DetailRow label="Next Action" value={decision.nextAction} />
                {decision.recallIntervalMonths && (
                  <DetailRow label="Recall" value={`${decision.recallIntervalMonths} months`} />
                )}
              </div>
            </DetailSection>

            {/* Referral */}
            {decision.referralRequired && (
              <DetailSection title="Referral" icon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3 space-y-1">
                  <DetailRow label="Referral Required" value={<Badge variant="high" size="sm">Yes</Badge>} />
                  <DetailRow label="Type" value={decision.referralType?.replace(/_/g, " ")} />
                </div>
              </DetailSection>
            )}

            {/* Warnings */}
            {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
              <DetailSection title="Clinical Warnings" icon={<FileText className="h-3.5 w-3.5" />}>
                <ul className="space-y-1">
                  {decision.clinicalWarnings.map((w: string, i: number) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}

            {/* Branch path */}
            {decision.branchPath && decision.branchPath.length > 0 && (
              <DetailSection title="Decision Trace" icon={<GitBranch className="h-3.5 w-3.5" />}>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <ol className="space-y-1.5">
                    {decision.branchPath.map((step: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="tabular-nums font-mono text-muted-foreground/60 flex-shrink-0 w-5 text-right">
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </DetailSection>
            )}
          </>
        )}

        {/* Source metadata */}
        <DetailSection title="Source Metadata" icon={<User className="h-3.5 w-3.5" />}>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
            <DetailRow label="Source" value={c.source.sourceType} />
            <DetailRow label="System" value={c.source.sourceSystem} />
            {c.source.sourceFileName && <DetailRow label="File" value={c.source.sourceFileName} />}
            <DetailRow label="Row" value={c.source.rowNumber} />
            {c.source.externalPatientId && <DetailRow label="Patient ID" value={c.source.externalPatientId} />}
            <DetailRow label="Engine Version" value={c.source.engineVersion} />
            <DetailRow label="Mapping Version" value={c.source.mappingVersion} />
            <DetailRow label="Imported" value={new Date(c.source.importedAt).toLocaleString()} />
          </div>
        </DetailSection>

        {/* Input summary */}
        <DetailSection title="Clinical Input" icon={<Clock className="h-3.5 w-3.5" />}>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
            {c.patientAge && <DetailRow label="Age" value={c.patientAge} />}
            {c.hpvResult && <DetailRow label="HPV Result" value={c.hpvResult.replace(/_/g, " ")} />}
            {c.cytologyResult && <DetailRow label="Cytology" value={c.cytologyResult.replace(/_/g, " ")} />}
            {c.histologyResult && <DetailRow label="Histology" value={c.histologyResult.replace(/_/g, " ")} />}
            {c.immunocompromised && <DetailRow label="Immunocompromised" value="Yes" />}
            {c.isPostHysterectomy && <DetailRow label="Post-hysterectomy" value="Yes" />}
            {c.isFirstTimeHPVTransition && <DetailRow label="First HPV Transition" value="Yes" />}
            {c.isPregnant && <DetailRow label="Pregnant" value="Yes" />}
            {c.hasAbnormalVaginalBleeding && <DetailRow label="Abnormal Bleeding" value="Yes" />}
            {c.isTestOfCure && <DetailRow label="Test of Cure" value="Yes" />}
          </div>
        </DetailSection>

        {/* Validation issues */}
        {(c.validationErrors.length > 0 || c.validationWarnings.length > 0) && (
          <DetailSection title="Validation Issues" icon={<FileText className="h-3.5 w-3.5" />}>
            <ul className="space-y-1">
              {c.validationErrors.map((e, i) => (
                <li key={`e-${i}`} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <span><strong>{e.field}:</strong> {e.message}</span>
                </li>
              ))}
              {c.validationWarnings.map((w, i) => (
                <li key={`w-${i}`} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><strong>{w.field}:</strong> {w.message}</span>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}
      </div>
    </SlideOver>
  );
}
