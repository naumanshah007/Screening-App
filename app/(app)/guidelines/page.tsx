"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, GitBranch, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/layout/PageIntro";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ClinicalRuleGraphStudio } from "@/components/clinical-rules/ClinicalRuleGraphStudio";
import type { ClinicalRuleSnapshot } from "@/lib/clinical-rules/schema";
import governedSnapshotJson from "@/lib/clinical-rules/governed-snapshots/cg-ncsp-3.1.0.json";
import governedManifest from "@/lib/clinical-rules/governed-snapshots/manifest.json";

type GuidelineTab = "canonical" | "legacy" | "colposcopy" | "gynaecology";

const GOVERNED_SNAPSHOT = governedSnapshotJson as unknown as ClinicalRuleSnapshot;
const GOVERNED_CHECKSUM = governedManifest.artefacts["cg-ncsp-3.1.0"].checksum;

const COLPOSCOPY_RULES = [
  { scenario: "HPV 16/18 + cytology suspicious/definite cancer", timeframe: "10 days", priority: "P1_HSC" },
  { scenario: "HPV 16/18 + cytology ASC-US, LSIL, or borderline/normal", timeframe: "30 days", priority: "P2" },
  { scenario: "HPV Other + cytology suspicious/definite cancer", timeframe: "10 days", priority: "P1_HSC" },
  { scenario: "HPV Other + cytology ASC-H, HSIL, or glandular", timeframe: "30 days", priority: "P2" },
  { scenario: "Second HPV Other + normal/low-grade cytology", timeframe: "3 months", priority: "P3" },
  { scenario: "Immune deficient + HPV Other", timeframe: "3 months", priority: "P3" },
  { scenario: "Endorsed referred on colposcopy", timeframe: "3 months", priority: "P3" },
  { scenario: "Abnormal cervical appearance — clinical suspicion of cancer", timeframe: "10 days", priority: "P1_HSC" },
  { scenario: "Abnormal cervical appearance — borderline/normal", timeframe: "1 month", priority: "P2" },
  { scenario: "Post-treatment: HPV 16/18 + cancer suspicion", timeframe: "10 days", priority: "P1_HSC" },
  { scenario: "Post-treatment: HPV 16/18 + abnormal cytology", timeframe: "30 days", priority: "P2" },
  { scenario: "Post-treatment: HPV 16/18 + normal/low-grade", timeframe: "3 months", priority: "P3" },
  { scenario: "Surveillance: HPV 16/18 + cancer suspicion", timeframe: "10 days", priority: "P1_HSC" },
  { scenario: "Surveillance: HPV 16/18 + abnormal cytology", timeframe: "30 days", priority: "P2" },
  { scenario: "Surveillance: HPV + normal/low-grade", timeframe: "3 months", priority: "P3" },
  { scenario: "Other clinical assessment", timeframe: "6 months", priority: "P3" },
];

const GYNAECOLOGY_RULES = [
  { category: "AUB", condition: "No pelvic USS within 12 months", priority: "REJECT", action: "Ask GP to re-refer with scan" },
  { category: "AUB", condition: "USS with ET >15mm, no pipelle within 6/12", priority: "P2", action: "Menorrhagia pathway" },
  { category: "AUB", condition: "ET <15mm, persistent bleeding >3/12, tried medical management", priority: "P3", action: "Menorrhagia / hysteroscopy" },
  { category: "AUB", condition: "USS suggestive of polyp", priority: "P3", action: "Hysteroscopy" },
  { category: "Fibroids", condition: "Fibroids >3cm with mass symptoms", priority: "P2", action: "Semi-urgent gynaecology review" },
  { category: "Fibroids", condition: "Fibroids <3cm with mass symptoms", priority: "P3", action: "Routine with GP note" },
  { category: "Fibroids", condition: "Fibroids <3cm, no mass symptoms, no AUB", priority: "DECLINE", action: "No follow-up scan needed" },
  { category: "Ovarian Masses", condition: "Symptomatic/asymptomatic probable benign cyst", priority: "P2", action: "Gynaecology review" },
  { category: "Ovarian Masses", condition: "Complex adnexal mass — suspicious (SMO only)", priority: "P1_HSC", action: "CT + tumour markers, SMO consult" },
  { category: "PMB", condition: "No USS within 6 months", priority: "REJECT", action: "Ask GP to re-refer with USS" },
  { category: "PMB", condition: "One or more episodes + ET >=5mm", priority: "P1_HSC", action: "RAC clinic (Rapid Access)" },
  { category: "PMB", condition: "Multiple episodes, ET <5mm", priority: "P1_HSC", action: "RAC clinic" },
  { category: "Pelvic Pain", condition: "No USS", priority: "REJECT", action: "Ask GP to re-refer with USS" },
  { category: "Pelvic Pain", condition: "Endometriomas >=5cm, normal tumour markers", priority: "P2", action: "Semi-urgent review" },
  { category: "Pelvic Pain", condition: ">3 months, not responding to medical management, normal USS", priority: "P3", action: "General Gynae" },
  { category: "Urogynaecology", condition: "Mesh-related problems", priority: "P2", action: "Semi-urgent Urogynae (SMO grading)" },
  { category: "Urogynaecology", condition: "Procidentia", priority: "P2", action: "Semi-urgent Urogynae" },
  { category: "Urogynaecology", condition: "Prolapse with urinary retention / hydronephrosis", priority: "P2", action: "Semi-urgent Urogynae" },
  { category: "Urogynaecology", condition: "Asymptomatic prolapse", priority: "REJECT", action: "Appointment not required" },
  { category: "Other", condition: "PCOS", priority: "P5", action: "Virtual clinic only" },
  { category: "Other", condition: "Fertility", priority: "DECLINE", action: "Refer directly to NRFS" },
  { category: "Other", condition: "Tubal ligation counselling", priority: "P3", action: "Routine" },
  { category: "Cervical Polyp", condition: "Asymptomatic <=2cm + normal smear", priority: "REJECT", action: "GP to monitor" },
  { category: "Cervical Polyp", condition: ">=2cm + symptoms + normal smear", priority: "P3", action: "Gynaecology review" },
];

function PriorityPill({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P1_HSC: "bg-destructive/10 text-destructive border border-destructive/30",
    P2_HSC: "bg-destructive/5 text-destructive border border-destructive/30",
    P1:     "bg-destructive/10 text-destructive border border-destructive/30",
    P2:     "bg-warn/10 text-foreground border border-warn/30",
    P3:     "bg-success/10 text-foreground border border-success/30",
    P5:     "bg-info/10 text-foreground border border-info/30",
    REJECT: "bg-muted text-muted-foreground border border-border",
    DECLINE:"bg-muted text-muted-foreground border border-border",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", colors[priority] ?? "bg-muted text-muted-foreground border border-border")}>
      {priority.replace("_", " ")}
    </span>
  );
}

// Each tab names the rules system it documents. Three different rule stacks are
// represented here, and conflating them is a real governance hazard: the
// colposcopy/gynaecology tabs describe operational referral-booking rules
// (RuleSetRelease), NOT the governed canonical screening ruleset.
const TABS = [
  {
    id: "canonical" as const,
    label: "Governed pathways",
    system: "CG-NCSP-3.1.0 · governed within-pathway recommendation layer",
  },
  {
    id: "legacy" as const,
    label: "Technical Reference",
    system: "Legacy pathway router reference · age gates / figure selection",
  },
];

export default function GuidelinesPage() {
  return (
    <Suspense fallback={null}>
      <GuidelinesPageInner />
    </Suspense>
  );
}

function GuidelinesPageInner() {
  const searchParams = useSearchParams();
  const figureParam = searchParams.get("figure");
  // Initialised from the ?figure= URL param (set when arriving from a figure link
  // elsewhere in the app); the page mounts fresh on cross-route navigation so the
  // initial state reliably reflects the requested figure.
  const [tab, setTab] = useState<GuidelineTab>(figureParam ? "legacy" : "canonical");
  const [authorityState, setAuthorityState] = useState<{
    authorityEngine: "LEGACY" | "CANONICAL";
    canonicalVersion: string | null;
    canonicalStatus: string | null;
    canonicalMode: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/clinical-rules/status", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.authority) setAuthorityState(payload.authority);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const canonicalIsAuthoritative = authorityState?.authorityEngine === "CANONICAL";
  const lifecycle = authorityState?.canonicalStatus ?? "Loading lifecycle…";
  const evaluationMode = authorityState?.canonicalMode ?? "Loading mode…";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header + tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-card px-5 pt-5 lg:px-7">
        <PageIntro
          eyebrow="Reference"
          title="Clinical Guidelines"
          description="CG-NCSP-3.1.0 is CerviGrade’s governed clinical recommendation ruleset. Every pathway view below is rendered from the checksum-controlled canonical snapshot."
          trailing={
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-accent-color" aria-hidden />
              Policy and pathway reference
            </div>
          }
        />
        <div role="tablist" aria-label="Guideline sections" className="flex gap-0 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                tab === t.id
                  ? "text-accent-color border-b-2 border-accent-color -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Which rules system the visible tab actually documents. */}
        <p className="mt-2 pb-3 text-xs text-muted-foreground">
          Showing:{" "}
          <span className="font-medium text-foreground">
            {TABS.find((t) => t.id === tab)?.system}
          </span>
          {" · "}
          Clinical authority: <span className="font-medium text-foreground">{canonicalIsAuthoritative ? "Canonical" : "Legacy"}</span>.{" "}
          <span className="font-mono text-foreground">{authorityState?.canonicalVersion ?? "CG-NCSP-3.1.0"}</span>: {" "}
          <span className="font-medium text-foreground">{lifecycle} · {evaluationMode}</span>.{" "}
          <Link href="/rules/clinical" className="underline hover:text-foreground">
            Open governance record
          </Link>
        </p>
      </div>

      {/* Governed canonical pathways — rendered directly from the committed,
          checksum-controlled snapshot. These are views of shared governed data,
          not manually duplicated diagrams. */}
      {tab === "canonical" && (
        <div role="tabpanel" id="panel-canonical" className="flex-1 overflow-y-auto px-4 py-5 lg:px-7 lg:py-6">
          <div className="mx-auto max-w-[112rem] space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Lifecycle", `${lifecycle} · ${evaluationMode}`, canonicalIsAuthoritative ? "Authoritative for new, unpinned cases" : "Shadow / simulation only"],
                ["Governed rules", GOVERNED_SNAPSHOT.rules.length.toString(), "Shared across every view"],
                ["Graph identity", `${GOVERNED_SNAPSHOT.nodes.length} nodes · ${GOVERNED_SNAPSHOT.edges.length} edges`, "Checksum protected"],
                ["Synchronized views", GOVERNED_SNAPSHOT.views.length.toString(), "Generated from governed data"],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>

            <Alert variant="info">
              <span className="inline-flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span><strong>Decision-support boundary:</strong> provisional recommendation; reviewer confirmation required. The Legacy router continues to select the pathway. {canonicalIsAuthoritative ? "Governed canonical rules determine the within-pathway recommendation for eligible new cases." : "Canonical results remain shadow/simulation and are not clinically authoritative."}</span>
              </span>
            </Alert>

            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <ClinicalRuleGraphStudio
                versionId="governed-snapshot-cg-ncsp-3.1.0"
                initialSnapshot={GOVERNED_SNAPSHOT}
                initialRevision={1}
                editable={false}
                auditEnabled={false}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground"><GitBranch className="h-4 w-4" aria-hidden />Snapshot provenance</div>
              <p className="mt-2 break-all font-mono">CG-NCSP-3.1.0 · SHA-256 {GOVERNED_CHECKSUM}</p>
              <p className="mt-2">Source package v{governedManifest.sourcePackageVersion} · source JSON SHA-256 {governedManifest.sourceJsonSha256}</p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Technical Reference</p>
                <p className="mt-1 text-sm text-foreground">The Legacy router remains responsible for pathway selection. Governed canonical rules determine the within-pathway recommendation when canonical clinical authority is enabled.</p>
              </div>
              <button type="button" onClick={() => setTab("legacy")} className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">View routing details</button>
            </div>
          </div>
        </div>
      )}

      {/* Colposcopy */}
      {tab === "colposcopy" && (
        <div role="tabpanel" id="panel-colposcopy" className="animate-fade-in flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
          <div className="max-w-4xl mx-auto space-y-5">
            <div>
              <h2 className="text-h3 text-foreground">Colposcopy referral triage guide</h2>
              <p className="text-sm text-muted-foreground mt-1">Booking priorities by clinical scenario — Health NZ Counties Manukau</p>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground">Clinical scenario</th>
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground w-32">Timeframe</th>
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground w-28">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COLPOSCOPY_RULES.map((rule, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-foreground">{rule.scenario}</td>
                      <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">{rule.timeframe}</td>
                      <td className="px-4 py-3"><PriorityPill priority={rule.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Alert variant="info">
              <strong>SLA policy:</strong> P1/P1_HSC: 10 calendar days · P2: 30 calendar days · P3: 3 calendar months · P5: Virtual clinic (no booking SLA)
            </Alert>
          </div>
        </div>
      )}

      {/* Gynaecology */}
      {tab === "gynaecology" && (
        <div role="tabpanel" id="panel-gynaecology" className="animate-fade-in flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <div>
              <h2 className="text-h3 text-foreground">Gynaecology grading guideline</h2>
              <p className="text-sm text-muted-foreground mt-1">Priority levels and condition-specific rules — Health NZ Counties Manukau</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "P1 / P1-HSC", sub: "Within 2 weeks", cls: "bg-danger-bg border-danger-border text-destructive" },
                { label: "P2 / P2-HSC", sub: "Within 30 days", cls: "bg-warn-bg border-warn-border text-warn" },
                { label: "P3", sub: "Within 4 months", cls: "bg-success-bg border-success-border text-success" },
                { label: "P5", sub: "Virtual clinic", cls: "bg-info-bg border-info-border text-info" },
              ].map(({ label, sub, cls }) => (
                <div key={label} className={cn("rounded-xl border px-4 py-3 text-center hover-lift", cls)}>
                  <p className="text-base font-bold">{label}</p>
                  <p className="text-xs mt-1 opacity-80">{sub}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground w-36">Category</th>
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground">Condition</th>
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground w-24">Priority</th>
                    <th scope="col" className="text-left px-4 py-3 text-label text-muted-foreground w-52">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {GYNAECOLOGY_RULES.map((rule, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{rule.category}</td>
                      <td className="px-4 py-3 text-foreground">{rule.condition}</td>
                      <td className="px-4 py-3"><PriorityPill priority={rule.priority} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Alert variant="warning">
              <strong>HSC-tracked pathways:</strong> Patients with P1-HSC or P2-HSC receive waitlist tracking by the Cancer Nurse Coordinator. P2-HSC ensures FSA within 4 weeks.
            </Alert>
          </div>
        </div>
      )}

      {/* Technical routing reference only. Superseded Legacy recommendation
          trees are intentionally not rendered as current clinical guidance. */}
      {tab === "legacy" && (
        <div role="tabpanel" id="panel-legacy" className="flex-1 overflow-y-auto px-4 py-6 lg:px-7">
          <div className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Technical Reference</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Legacy Pathway Router</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">The Legacy router remains responsible for pathway selection. Governed canonical rules determine the within-pathway recommendation when canonical clinical authority is enabled.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["1", "Global safety and eligibility", "Applies age eligibility, missing-data safety gates and cancer-suspicion precedence."],
                ["2", "Context precedence", "Selects special contexts such as abnormal bleeding, pregnancy and post-hysterectomy before ordinary screening."],
                ["3", "Clinical pathway selection", "Chooses the applicable governed pathway identifier (Figures 2–10 or Table 1)."],
                ["4", "Canonical hand-off", "Passes the selected pathway as DERIVED_ROUTER provenance to CG-NCSP-3.1.0."],
              ].map(([step, title, detail]) => (
                <div key={step} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">{step}</span>
                    <div><h3 className="font-semibold text-foreground">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <Alert variant="warning"><strong>Scope boundary:</strong> this reference documents pathway selection only. It does not present Legacy recommendation trees as current clinical guidance.</Alert>
          </div>
        </div>
      )}
    </div>
  );
}
