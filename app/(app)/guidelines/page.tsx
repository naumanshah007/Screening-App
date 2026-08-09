"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { PageIntro } from "@/components/layout/PageIntro";
import { FlowDiagram } from "@/components/clinical/FlowDiagram";
import { ALL_FIGURES } from "@/lib/decision-trees";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GuidelineTab = "pathways" | "colposcopy" | "gynaecology";

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
    id: "colposcopy" as const,
    label: "Colposcopy triage",
    system: "Operational referral grading · Case Rule Release",
  },
  {
    id: "gynaecology" as const,
    label: "Gynaecology grading",
    system: "Operational referral grading · Case Rule Release",
  },
  {
    id: "pathways" as const,
    label: "Cervical pathways",
    system: "Legacy pathway router reference",
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
  const initialFigure = ALL_FIGURES.find((f) => f.id === figureParam)?.id ?? ALL_FIGURES[0].id;
  // Initialised from the ?figure= URL param (set when arriving from a figure link
  // elsewhere in the app); the page mounts fresh on cross-route navigation so the
  // initial state reliably reflects the requested figure.
  const [tab, setTab] = useState<GuidelineTab>(figureParam ? "pathways" : "colposcopy");
  const [selectedId, setSelectedId] = useState(initialFigure);
  const [figureSearch, setFigureSearch] = useState("");
  const selected = ALL_FIGURES.find((f) => f.id === selectedId) ?? ALL_FIGURES[0];
  const filteredFigures = figureSearch
    ? ALL_FIGURES.filter((f) => `${f.title} ${f.subtitle}`.toLowerCase().includes(figureSearch.toLowerCase()))
    : ALL_FIGURES;

  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(520);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(Math.max(300, entry.contentRect.height - 1)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header + tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-card px-5 pt-5 lg:px-7">
        <PageIntro
          eyebrow="Reference"
          title="Clinical Guidance Library"
          description="Reference content for three separate rules systems. Colposcopy and gynaecology grading describe operational referral-booking rules; cervical pathways describe the legacy pathway router. None of these pages is the governed canonical ruleset CG-NCSP-3.1.0 — see Rule Governance for that."
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
          Governed canonical ruleset{" "}
          <span className="font-mono text-foreground">CG-NCSP-3.1.0</span> is{" "}
          <span className="font-medium text-foreground">DRAFT · shadow/simulation only</span> and is
          not represented on this page.{" "}
          <Link href="/rules/clinical" className="underline hover:text-foreground">
            Open Rule Studio
          </Link>
        </p>
      </div>

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

      {/* Pathways */}
      {tab === "pathways" && (
        <div role="tabpanel" id="panel-pathways" className="flex flex-1 min-h-0 animate-fade-in">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-card flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-border">
              <Input
                value={figureSearch}
                onChange={(e) => setFigureSearch(e.target.value)}
                placeholder="Search pathways…"
                icon={<Search className="h-3.5 w-3.5" />}
              />
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Clinical pathways">
              {filteredFigures.map((fig) => (
                <button
                  key={fig.id}
                  onClick={() => setSelectedId(fig.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedId === fig.id
                      ? "bg-accent-color text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <p className="font-semibold leading-snug">{fig.title}</p>
                  <p className={cn("truncate mt-0.5 text-[11px]", selectedId === fig.id ? "text-white/70" : "text-muted-foreground/60")}>
                    {fig.subtitle}
                  </p>
                </button>
              ))}
              {filteredFigures.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No pathways match</p>
              )}
            </nav>
          </aside>

          {/* Diagram panel */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
              <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{selected.subtitle}</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Simplified visual reference under validation. Use rule trace and validation log for clinical parity review.
              </p>
            </div>
            <div ref={panelRef} className="flex-1 min-h-0 bg-bg p-4">
              <FlowDiagram key={selected.id} figure={selected} height={height} className="h-full shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
