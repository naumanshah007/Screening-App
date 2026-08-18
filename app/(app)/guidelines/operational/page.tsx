"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Local Health NZ Counties Manukau booking guidance.
 *
 * Deliberately separate from the national screening guidelines: these tables
 * govern booking priority and service SLAs, not clinical screening logic, and
 * are not part of the governed NCSP rule set.
 */

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
    P1: "bg-destructive/10 text-destructive border border-destructive/30",
    P2: "bg-warn/10 text-foreground border border-warn/30",
    P3: "bg-success/10 text-foreground border border-success/30",
    P5: "bg-info/10 text-foreground border border-info/30",
    REJECT: "bg-muted text-muted-foreground border border-border",
    DECLINE: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colors[priority] ?? "bg-muted text-muted-foreground border border-border"
      )}
    >
      {priority.replace("_", " ")}
    </span>
  );
}

const TABS = [
  { id: "colposcopy" as const, label: "Colposcopy triage" },
  { id: "gynaecology" as const, label: "Gynaecology grading" },
];

export default function OperationalGuidesPage() {
  const [tab, setTab] = useState<"colposcopy" | "gynaecology">("colposcopy");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="page-aura flex-shrink-0 border-b border-border bg-card px-6 pt-5">
        <PageIntro
          eyebrow="Local operational guidance"
          title="Booking priority guides"
          description="Health NZ Counties Manukau booking priorities and service SLAs. These govern local scheduling and sit alongside the national screening guidelines."
          breadcrumb={[{ label: "Guidelines", href: "/guidelines" }, { label: "Local booking guides" }]}
          trailing={
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-accent-color" aria-hidden />
              Local policy reference
            </div>
          }
        />
        <div role="tablist" aria-label="Booking guide sections" className="mt-4 flex gap-0">
          {TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                tab === item.id
                  ? "-mb-px border-b-2 border-accent-color text-accent-color"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "colposcopy" && (
        <div role="tabpanel" id="panel-colposcopy" className="animate-fade-in flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-5">
            <div>
              <h2 className="text-h3 text-foreground">Colposcopy referral triage guide</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Booking priorities by clinical scenario — Health NZ Counties Manukau
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="px-4 py-3 text-left text-label text-muted-foreground">Clinical scenario</th>
                    <th scope="col" className="w-32 px-4 py-3 text-left text-label text-muted-foreground">Timeframe</th>
                    <th scope="col" className="w-28 px-4 py-3 text-left text-label text-muted-foreground">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COLPOSCOPY_RULES.map((rule) => (
                    <tr key={rule.scenario} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{rule.scenario}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{rule.timeframe}</td>
                      <td className="px-4 py-3"><PriorityPill priority={rule.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Alert variant="info">
              <strong>SLA policy:</strong> P1/P1_HSC: 10 calendar days · P2: 30 calendar days · P3: 3
              calendar months · P5: Virtual clinic (no booking SLA)
            </Alert>
          </div>
        </div>
      )}

      {tab === "gynaecology" && (
        <div role="tabpanel" id="panel-gynaecology" className="animate-fade-in flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <div>
              <h2 className="text-h3 text-foreground">Gynaecology grading guideline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Priority levels and condition-specific rules — Health NZ Counties Manukau
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "P1 / P1-HSC", sub: "Within 2 weeks", cls: "bg-danger-bg border-danger-border text-destructive" },
                { label: "P2 / P2-HSC", sub: "Within 30 days", cls: "bg-warn-bg border-warn-border text-warn" },
                { label: "P3", sub: "Within 4 months", cls: "bg-success-bg border-success-border text-success" },
                { label: "P5", sub: "Virtual clinic", cls: "bg-info-bg border-info-border text-info" },
              ].map(({ label, sub, cls }) => (
                <div key={label} className={cn("hover-lift rounded-xl border px-4 py-3 text-center", cls)}>
                  <p className="text-base font-bold">{label}</p>
                  <p className="mt-1 text-xs opacity-80">{sub}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="w-36 px-4 py-3 text-left text-label text-muted-foreground">Category</th>
                    <th scope="col" className="px-4 py-3 text-left text-label text-muted-foreground">Condition</th>
                    <th scope="col" className="w-24 px-4 py-3 text-left text-label text-muted-foreground">Priority</th>
                    <th scope="col" className="w-52 px-4 py-3 text-left text-label text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {GYNAECOLOGY_RULES.map((rule) => (
                    <tr key={`${rule.category}-${rule.condition}`} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{rule.category}</td>
                      <td className="px-4 py-3 text-foreground">{rule.condition}</td>
                      <td className="px-4 py-3"><PriorityPill priority={rule.priority} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Alert variant="warning">
              <strong>HSC-tracked pathways:</strong> Patients with P1-HSC or P2-HSC receive waitlist
              tracking by the Cancer Nurse Coordinator. P2-HSC ensures FSA within 4 weeks.
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
}
