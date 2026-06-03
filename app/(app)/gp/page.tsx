"use client";
import Link from "next/link";
import { useState, useCallback } from "react";
import { PageIntro } from "@/components/layout/PageIntro";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge } from "@/components/ui/badge";
import { cn, formatClinicalReferenceText, getFigureLabel } from "@/lib/utils";
import type { ClinicalDecision } from "@/lib/engine/types";
import { Alert } from "@/components/ui/alert";
import {
  Search, CheckCircle, AlertTriangle, Activity,
  ClipboardList, Calendar, ChevronRight, BookOpen, FlaskConical
} from "lucide-react";

// ─── Form option lists ────────────────────────────────────────────────────────

const HPV_OPTIONS = [
  { value: "", label: "Select HPV result…" },
  { value: "NOT_DETECTED", label: "HPV Not Detected" },
  { value: "HPV_16_18",    label: "HPV 16 or 18 Detected" },
  { value: "HPV_OTHER",    label: "HPV Other Detected" },
  { value: "INADEQUATE",   label: "Inadequate Sample" },
];

const CYTOLOGY_OPTIONS = [
  { value: "", label: "Select cytology result…" },
  { value: "NEGATIVE",       label: "Negative" },
  { value: "ASC_US",         label: "ASC-US" },
  { value: "LSIL",           label: "LSIL" },
  { value: "ASC_H",          label: "ASC-H — cannot exclude HSIL" },
  { value: "HSIL",           label: "HSIL — high-grade squamous" },
  { value: "SCC",            label: "SCC — squamous cell carcinoma" },
  { value: "AG1",            label: "AG1 — atypical endocervical cells" },
  { value: "AG2",            label: "AG2 — atypical endometrial" },
  { value: "AG3",            label: "AG3 — atypical glandular cells NOS" },
  { value: "AG4",            label: "AG4 — atypical endocervical cells favouring neoplasia" },
  { value: "AG5",            label: "AG5 — atypical glandular cells favouring neoplasia" },
  { value: "AC1",            label: "AC1 — endocervical adenocarcinoma" },
  { value: "AC2",            label: "AC2 — endometrial adenocarcinoma" },
  { value: "AC3",            label: "AC3 — extrauterine adenocarcinoma" },
  { value: "AC4",            label: "AC4 — adenocarcinoma NOS" },
  { value: "UNSATISFACTORY", label: "Unsatisfactory" },
];

const SAMPLE_OPTIONS = [
  { value: "", label: "Select sample type…" },
  { value: "LBC",  label: "LBC — Liquid Based Cytology" },
  { value: "SWAB", label: "SWAB — Self-collected vaginal swab" },
];

const FIGURE_OPTIONS = [
  { value: "", label: "Auto-detect (recommended)" },
  { value: "FIGURE_1",  label: "HPV transition invitation pathway" },
  { value: "FIGURE_2",  label: "Previous high-grade/history transition pathway" },
  { value: "FIGURE_3",  label: "Primary HPV screening pathway" },
  { value: "FIGURE_4",  label: "Post-normal colposcopy follow-up after low-grade cytology" },
  { value: "FIGURE_5",  label: "Post-normal colposcopy follow-up after high-grade cytology" },
  { value: "FIGURE_6",  label: "Test of Cure pathway" },
  { value: "FIGURE_7",  label: "Glandular abnormality pathway" },
  { value: "FIGURE_8",  label: "Post-hysterectomy screening pathway" },
  { value: "FIGURE_9",  label: "Pregnancy high-grade/glandular cytology pathway" },
  { value: "FIGURE_10", label: "Abnormal vaginal bleeding pathway" },
];

interface PatientInfo {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isFirstTimeHPVTransition: boolean;
  isPostHysterectomy: boolean;
  gpPractice?: { name: string };
}

const riskBgMap: Record<string, string> = {
  URGENT: "border-l-destructive bg-destructive/5",
  HIGH:   "border-l-warn bg-warn/5",
  MEDIUM: "border-l-info bg-info/5",
  LOW:    "border-l-success bg-success/5",
};

// ─── Decision Panel (redesigned) ─────────────────────────────────────────────

function DecisionPreviewPanel({ decision, isPreview }: { decision: ClinicalDecision | null; isPreview: boolean }) {
  if (!decision) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-border rounded-xl bg-card">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <FlaskConical className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No decision yet</p>
        <p className="text-xs text-muted-foreground">Enter test results to see a clinical decision preview</p>
      </div>
    );
  }

  const riskLevel = decision.riskLevel ?? "LOW";
  const borderClass = riskBgMap[riskLevel] ?? riskBgMap.LOW;

  return (
    <div className="space-y-4">
      {isPreview && (
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          Preview — not yet saved
        </div>
      )}

      {/* Active pathway */}
      <div className={cn("rounded-xl border-l-4 p-4", borderClass)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Active Pathway</p>
            <p className="font-semibold text-sm text-foreground">{getFigureLabel(decision.figure)}</p>
          </div>
          <RiskBadge risk={riskLevel} size="md" />
        </div>
      </div>

      {/* Recommendation */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">{formatClinicalReferenceText(decision.recommendation)}</p>
          {decision.recommendationCode && (
            <p className="text-xs text-muted-foreground mt-1.5 font-mono">{decision.recommendationCode}</p>
          )}
          {decision.nextAction && (
            <div className="mt-3 flex items-start gap-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
              <ChevronRight className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-brand-700 uppercase tracking-wider">Next Action</p>
                <p className="text-xs text-brand-800 mt-0.5">{formatClinicalReferenceText(decision.nextAction)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral */}
      {decision.referralRequired && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand-600" />
              Referral Required
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={decision.referralPriority} showDays />
              {decision.referralType && <span className="text-sm text-muted-foreground">{decision.referralType}</span>}
            </div>
            {decision.referralReason && (
              <p className="text-xs text-muted-foreground leading-relaxed">{formatClinicalReferenceText(decision.referralReason)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recall */}
      {decision.recallRequired && decision.recallIntervalMonths && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-600" />
              Recall Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Recall in{" "}
              <strong>
                {decision.recallIntervalMonths >= 12
                  ? `${Math.round(decision.recallIntervalMonths / 12)} year${decision.recallIntervalMonths >= 24 ? "s" : ""}`
                  : `${decision.recallIntervalMonths} months`}
              </strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Clinical warnings */}
      {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Clinical Warnings
          </p>
          <ul className="space-y-1.5">
            {decision.clinicalWarnings.map((w, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-warn/50 mt-1.5 flex-shrink-0" />
                {formatClinicalReferenceText(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guideline reference */}
      {decision.guidelineReference && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border pt-3">
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{formatClinicalReferenceText(decision.guidelineReference)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GPPortalPage() {
  const [nhiSearch, setNhiSearch] = useState("");
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const [hpvResult, setHpvResult] = useState("");
  const [cytologyResult, setCytologyResult] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [labId, setLabId] = useState("");
  const [currentFigure, setCurrentFigure] = useState("");

  const [decision, setDecision] = useState<ClinicalDecision | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function lookupPatient(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    setLookupLoading(true);
    setPatient(null);
    setDecision(null);
    setSubmitted(false);
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(nhiSearch)}&limit=1`);
      const data = await res.json();
      if (!data.patients?.length) {
        setLookupError("No patient found with that NHI. Check and try again.");
      } else {
        setPatient(data.patients[0]);
      }
    } catch {
      setLookupError("Network error. Try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  const previewDecision = useCallback(async () => {
    if (!patient || (!hpvResult && !cytologyResult)) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/rules/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          isFirstTimeHPVTransition: patient.isFirstTimeHPVTransition,
          isPostHysterectomy: patient.isPostHysterectomy,
          hpvResult: hpvResult || undefined,
          cytologyResult: cytologyResult || undefined,
          sampleType: sampleType || undefined,
          currentFigure: currentFigure || undefined,
        }),
      });
      const data = await res.json();
      if (data.decision) setDecision(data.decision);
    } catch {
      // Preview errors are non-critical
    } finally {
      setPreviewLoading(false);
    }
  }, [patient, hpvResult, cytologyResult, sampleType, currentFigure]);

  async function submitResults(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setSubmitError("");
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          hpvResult: hpvResult || undefined,
          cytologyResult: cytologyResult || undefined,
          sampleType: sampleType || undefined,
          testDate,
          labId: labId || undefined,
          currentFigure: currentFigure || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Submission failed");
      } else {
        setDecision(data.decision);
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const cytologyWarning =
    hpvResult === "HPV_16_18" && !cytologyResult
      ? "HPV 16/18 detected — cytology result required to determine final pathway"
      : hpvResult === "HPV_OTHER" && !cytologyResult
      ? "HPV Other detected — cytology result required for the primary HPV screening pathway"
      : null;

  const swabWarning = sampleType === "SWAB"
    ? "Self-collected swab: clinical examination required before cytology can be interpreted"
    : null;

  const resetForm = () => {
    setPatient(null);
    setNhiSearch("");
    setHpvResult("");
    setCytologyResult("");
    setSampleType("");
    setLabId("");
    setCurrentFigure("");
    setDecision(null);
    setSubmitted(false);
    setSubmitError("");
  };

  return (
    <div className="page-aura p-6 space-y-6 animate-fade-in">
      <PageIntro
        eyebrow="Legacy cervical tool"
        title="Cervical Results Entry"
        description="Manual validation tool — not the primary enterprise referral workflow. Use this workspace for cervical screening result entry and pathway support; for colposcopy and gynaecology referral grading, use the enterprise case workflow."
        trailing={
          <>
            <Link href="/cases">
              <Button variant="outline" size="sm">Enterprise cases</Button>
            </Link>
            <Link href="/guidelines">
              <Button variant="outline" size="sm">Guidelines</Button>
            </Link>
            <Link href="/pathway">
              <Button variant="outline" size="sm">Pathway wizard</Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Use this screen when you already have structured cervical results and want a fast pathway recommendation:
          search for the patient, enter HPV and cytology details, preview the decision, then save the result into the clinical record.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Left: Form ── */}
        <div className="space-y-5">
          {/* Step 1: Patient Lookup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-600" />
                1. Patient Lookup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={lookupPatient} className="flex gap-3">
                <Input
                  label="NHI Number"
                  value={nhiSearch}
                  onChange={(e) => setNhiSearch(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC1234"
                  required
                  hint="Enter patient NHI to retrieve screening history"
                />
                <div className="flex items-end pb-5">
                  <Button type="submit" loading={lookupLoading} size="md">
                    Search
                  </Button>
                </div>
              </form>
              {lookupError && (
                <Alert variant="error" className="mt-3">{lookupError}</Alert>
              )}
              {patient && (
                <div className="mt-4 bg-brand-50 border border-brand-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground text-base">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono mt-0.5">NHI: {patient.nhi}</p>
                      <p className="text-sm text-muted-foreground">
                        DOB: {new Date(patient.dateOfBirth).toLocaleDateString("en-NZ")}
                      </p>
                      {patient.gpPractice && (
                        <p className="text-xs text-muted-foreground mt-0.5">{patient.gpPractice.name}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {patient.isFirstTimeHPVTransition && (
                        <span className="text-[10px] font-semibold bg-info/10 text-info px-2 py-0.5 rounded-full border border-info/30">
                          HPV Transition
                        </span>
                      )}
                      {patient.isPostHysterectomy && (
                        <span className="text-[10px] font-semibold bg-brand-50 text-muted-foreground px-2 py-0.5 rounded-full border border-brand-200">
                          Post-Hysterectomy
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Test Results */}
          {patient && !submitted && (
            <form onSubmit={submitResults} className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-brand-600" />
                    2. Test Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Test Date"
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      required
                    />
                    <Input
                      label="Lab / Specimen ID"
                      value={labId}
                      onChange={(e) => setLabId(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <Select
                    label="Sample Type"
                    options={SAMPLE_OPTIONS}
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    hint="LBC is standard. Swab requires return visit."
                  />
                  {swabWarning && <Alert variant="warning">{swabWarning}</Alert>}
                  <Select
                    label="HPV Result"
                    options={HPV_OPTIONS}
                    value={hpvResult}
                    onChange={(e) => { setHpvResult(e.target.value); previewDecision(); }}
                    hint="Required for the primary HPV screening pathway"
                  />
                  <Select
                    label="Cytology Result"
                    options={CYTOLOGY_OPTIONS}
                    value={cytologyResult}
                    onChange={(e) => { setCytologyResult(e.target.value); previewDecision(); }}
                    hint="Structured vocabulary per NZ Cervical Screening guidelines"
                  />
                  {cytologyWarning && <Alert variant="warning">{cytologyWarning}</Alert>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-brand-600" />
                    3. Pathway Override
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground normal-case tracking-normal">Optional</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    label="Clinical pathway"
                    options={FIGURE_OPTIONS}
                    value={currentFigure}
                    onChange={(e) => { setCurrentFigure(e.target.value); previewDecision(); }}
                    hint="Only override if auto-detection is incorrect"
                  />
                </CardContent>
              </Card>

              {submitError && <Alert variant="error">{submitError}</Alert>}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previewDecision}
                  loading={previewLoading}
                >
                  Preview Decision
                </Button>
                <Button type="submit" loading={submitLoading} disabled={!hpvResult}>
                  Submit Results
                </Button>
              </div>
            </form>
          )}

          {/* Success state */}
          {submitted && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Results Submitted Successfully</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Clinical decision recorded and pathway updated.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="mt-4" onClick={resetForm}>
                  Enter results for another patient
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Decision Preview ── */}
        <div className="lg:sticky lg:top-6">
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Decision</p>
          </div>
          <DecisionPreviewPanel decision={decision} isPreview={!submitted} />
        </div>
      </div>
    </div>
  );
}
