"use client";

import { SlideOver } from "@/components/ui/slide-over";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpRight, GitBranch, FileText, Database,
  Stethoscope, AlertTriangle, FlaskConical, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";

interface BatchResultDetailProps {
  result: BatchCaseResult | null;
  open: boolean;
  onClose: () => void;
}

function Section({ title, icon, children, accent }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: "amber" | "red" | "brand";
}) {
  return (
    <div className="space-y-2">
      <div className={cn(
        "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
        accent === "amber" ? "text-amber-600 dark:text-amber-400"
          : accent === "red" ? "text-red-600 dark:text-red-400"
          : accent === "brand" ? "text-brand-600 dark:text-brand-400"
          : "text-muted-foreground"
      )}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground flex-shrink-0 w-36">{label}</span>
      <span className={cn("text-xs text-foreground text-right font-medium flex-1", mono && "font-mono")}>
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 px-4 py-3", className)}>
      {children}
    </div>
  );
}

function formatMs(ms: number) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  return `${ms.toFixed(2)} ms`;
}

export function BatchResultDetail({ result, open, onClose }: BatchResultDetailProps) {
  if (!result) return null;

  const { decision } = result;
  const c = result.case;
  const inp = result.input;

  const patientId = c.source.externalPatientId ?? `ROW-${String(c.source.rowNumber).padStart(3, "0")}`;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={patientId}
      subtitle={c.label ?? `Row ${c.source.rowNumber} · processed in ${formatMs(result.processingTimeMs)}`}
      width="lg"
    >
      <div className="space-y-7">

        {/* ── 1. Source Record ─────────────────────────────────────────────── */}
        <Section title="Source Record" icon={<Database className="h-3.5 w-3.5" />}>
          <Panel>
            <Row label="Patient ID"     value={<span className="font-mono font-bold">{patientId}</span>} />
            <Row label="Source System"  value={c.source.sourceSystem ?? c.source.sourceType} />
            <Row label="Source Type"    value={<span className="font-mono">{c.source.sourceType}</span>} />
            {c.source.sourceFileName && <Row label="File" value={c.source.sourceFileName} />}
            <Row label="Row in Source"  value={c.source.rowNumber} />
            <Row label="Imported"       value={new Date(c.source.importedAt).toLocaleString()} />
            <Row label="Mapping Version" value={c.source.mappingVersion} mono />
            <Row label="Engine Version"  value={c.source.engineVersion} mono />
          </Panel>
        </Section>

        {/* ── 2. Input Data Used for Decision ──────────────────────────────── */}
        <Section title="Input Data Used for Decision" icon={<FlaskConical className="h-3.5 w-3.5" />} accent="brand">
          <Panel>
            {/* Demographics */}
            {c.patientAge != null && <Row label="Patient Age"       value={`${c.patientAge} years`} />}

            {/* Test results */}
            {inp?.hpvResult      && <Row label="HPV Result"         value={inp.hpvResult.replace(/_/g, " ")} />}
            {inp?.cytologyResult && <Row label="Cytology Result"    value={inp.cytologyResult.replace(/_/g, " ")} />}
            {inp?.histologyResult && <Row label="Histology Result"  value={inp.histologyResult.replace(/_/g, " ")} />}
            {inp?.sampleType     && <Row label="Sample Type"        value={inp.sampleType} />}
            {inp?.tzType         && <Row label="TZ Type"            value={inp.tzType} />}

            {/* Key boolean flags — only show true ones */}
            {inp?.immunocompromised         && <Row label="Immunocompromised"        value="Yes" />}
            {inp?.isPostHysterectomy        && <Row label="Post-hysterectomy"        value="Yes" />}
            {inp?.hysterectomyType          && <Row label="Hysterectomy Type"        value={inp.hysterectomyType} />}
            {inp?.hysterectomyIndication    && <Row label="Hysterectomy Indication"  value={inp.hysterectomyIndication?.replace(/_/g, " ")} />}
            {inp?.isFirstTimeHPVTransition  && <Row label="First HPV Transition"     value="Yes" />}
            {inp?.isPregnant                && <Row label="Pregnant"                 value="Yes" />}
            {inp?.hasAbnormalVaginalBleeding && <Row label="Abnormal Bleeding"       value="Yes" />}
            {inp?.hasCancerSymptoms         && <Row label="Cancer Symptoms"          value="Yes" />}
            {inp?.isTestOfCure              && <Row label="Test of Cure"             value="Yes" />}
            {inp?.testOfCureStage           && <Row label="ToC Stage"               value={inp.testOfCureStage?.replace(/_/g, " ")} />}
            {inp?.atypicalEndometrialHistory && <Row label="Atypical Endometrial Hx" value="Yes" />}

            {/* Repeat / context */}
            {inp?.repeatStage   && <Row label="Repeat Stage"        value={inp.repeatStage?.replace(/_/g, " ")} />}
            {inp?.repeatContext  && <Row label="Repeat Context"      value={inp.repeatContext?.replace(/_/g, " ")} />}
            {inp?.screeningStatus && <Row label="Screening Status"   value={inp.screeningStatus?.replace(/_/g, " ")} />}

            {/* Counters */}
            {(inp?.consecutiveNegativeCoTestCount ?? 0) > 0 &&
              <Row label="Neg. CoTest Count" value={inp.consecutiveNegativeCoTestCount} />}
            {(inp?.consecutiveLowGradeCount ?? 0) > 0 &&
              <Row label="Low Grade Count"   value={inp.consecutiveLowGradeCount} />}

            {/* Colposcopy findings */}
            {inp?.colposcopicImpression && <Row label="Colposcopic Impression" value={inp.colposcopicImpression?.replace(/_/g, " ")} />}
            {inp?.biopsyResult          && <Row label="Biopsy Result"          value={inp.biopsyResult?.replace(/_/g, " ")} />}
          </Panel>
        </Section>

        {/* ── 3. Decision Output ───────────────────────────────────────────── */}
        {result.status === "success" ? (
          <>
            <Section title="Decision Output" icon={<Cpu className="h-3.5 w-3.5" />} accent="brand">
              <Card className="border-l-4 border-l-brand-600">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Pathway Figure</div>
                      <div className="text-base font-bold text-foreground">
                        {decision.figure?.replace(/_/g, " ") ?? "—"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {decision.recommendation}
                      </div>
                    </div>
                    <RiskBadge risk={decision.riskLevel} size="md" />
                  </div>
                </CardContent>
              </Card>
              <Panel>
                <Row label="Recommendation Code" value={decision.recommendationCode} mono />
                <Row label="Next Action"          value={decision.nextAction} />
                {decision.recallIntervalMonths != null &&
                  <Row label="Recall Interval" value={`${decision.recallIntervalMonths} months`} />}
              </Panel>
            </Section>

            {/* Referral */}
            {decision.referralRequired && (
              <Section title="Referral Required" icon={<ArrowUpRight className="h-3.5 w-3.5" />} accent="amber">
                <Panel className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
                  <Row label="Referral Required" value={<Badge variant="high" size="sm">Yes</Badge>} />
                  <Row label="Referral Type"     value={decision.referralType?.replace(/_/g, " ")} />
                </Panel>
              </Section>
            )}

            {/* Clinical warnings */}
            {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
              <Section title="Clinical Warnings" icon={<AlertTriangle className="h-3.5 w-3.5" />} accent="amber">
                <ul className="space-y-1.5">
                  {decision.clinicalWarnings.map((w: string, i: number) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Decision trace */}
            {decision.branchPath && decision.branchPath.length > 0 && (
              <Section title="Decision Trace" icon={<GitBranch className="h-3.5 w-3.5" />}>
                <Panel>
                  <p className="text-xs text-muted-foreground mb-2">
                    Step-by-step path through <span className="font-mono">evaluateClinicalDecision()</span>
                  </p>
                  <ol className="space-y-1.5">
                    {decision.branchPath.map((step: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="tabular-nums font-mono text-muted-foreground/50 flex-shrink-0 w-5 text-right">
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </Section>
            )}
          </>
        ) : (
          <Section title="Processing Error" icon={<AlertTriangle className="h-3.5 w-3.5" />} accent="red">
            <Panel className="border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-400">{result.error}</p>
            </Panel>
          </Section>
        )}

        {/* ── 4. Validation Issues (if any) ────────────────────────────────── */}
        {(c.validationErrors.length > 0 || c.validationWarnings.length > 0) && (
          <Section title="Validation Issues" icon={<FileText className="h-3.5 w-3.5" />}>
            <ul className="space-y-1.5">
              {c.validationErrors.map((e, i) => (
                <li key={`e-${i}`} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <span><strong>{e.field}:</strong> {e.message}</span>
                </li>
              ))}
              {c.validationWarnings.map((w, i) => (
                <li key={`w-${i}`} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><strong>{w.field}:</strong> {w.message}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

      </div>
    </SlideOver>
  );
}
