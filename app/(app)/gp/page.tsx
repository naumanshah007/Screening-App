"use client";
import { useState, useCallback } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge } from "@/components/ui/badge";
import { getFigureLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ClinicalDecision } from "@/lib/engine/types";
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
  { value: "AG1",            label: "AG1 — atypical glandular, NOS" },
  { value: "AG2",            label: "AG2 — atypical endometrial" },
  { value: "AG3",            label: "AG3 — favour neoplasia" },
  { value: "AG4",            label: "AG4 — AIS" },
  { value: "AG5",            label: "AG5 — adenocarcinoma" },
  { value: "AC1",            label: "AC1 — atypical endocervical, NOS" },
  { value: "AC2",            label: "AC2 — atypical endocervical, favour neoplasia" },
  { value: "AC3",            label: "AC3 — AIS endocervical" },
  { value: "AC4",            label: "AC4 — adenocarcinoma, endocervical" },
  { value: "UNSATISFACTORY", label: "Unsatisfactory" },
];

const SAMPLE_OPTIONS = [
  { value: "", label: "Select sample type…" },
  { value: "LBC",  label: "LBC — Liquid Based Cytology" },
  { value: "SWAB", label: "SWAB — Self-collected vaginal swab" },
];

const FIGURE_OPTIONS = [
  { value: "", label: "Auto-detect (recommended)" },
  { value: "FIGURE_1",  label: "Figure 1 — HPV Transition (cytology-negative)" },
  { value: "FIGURE_2",  label: "Figure 2 — HPV Transition (previously abnormal)" },
  { value: "FIGURE_3",  label: "Figure 3 — Primary HPV Screening" },
  { value: "FIGURE_4",  label: "Figure 4 — Colposcopy & Histology" },
  { value: "FIGURE_5",  label: "Figure 5 — High-grade Lesion Management" },
  { value: "FIGURE_6",  label: "Figure 6 — Test of Cure" },
  { value: "FIGURE_7",  label: "Figure 7 — Post-abnormal Management" },
  { value: "FIGURE_8",  label: "Figure 8 — Post-hysterectomy" },
  { value: "FIGURE_9",  label: "Figure 9 — Extended Post-abnormal" },
  { value: "FIGURE_10", label: "Figure 10 — Post-hysterectomy Follow-up" },
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
  URGENT: "border-l-red-500 bg-red-50",
  HIGH:   "border-l-amber-500 bg-amber-50",
  MEDIUM: "border-l-violet-500 bg-violet-50",
  LOW:    "border-l-emerald-500 bg-emerald-50",
};

// ─── Decision Panel (redesigned) ─────────────────────────────────────────────

function DecisionPreviewPanel({ decision, isPreview }: { decision: ClinicalDecision | null; isPreview: boolean }) {
  if (!decision) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
          <FlaskConical className="h-6 w-6 text-slate-400" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-slate-600 mb-1">No decision yet</p>
        <p className="text-xs text-slate-400">Enter test results to see a clinical decision preview</p>
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
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Active Pathway</p>
            <p className="font-semibold text-sm text-slate-900">{getFigureLabel(decision.figure)}</p>
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
          <p className="text-sm text-slate-700 font-medium leading-relaxed">{decision.recommendation}</p>
          {decision.recommendationCode && (
            <p className="text-xs text-slate-400 mt-1.5 font-mono">{decision.recommendationCode}</p>
          )}
          {decision.nextAction && (
            <div className="mt-3 flex items-start gap-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
              <ChevronRight className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-brand-700 uppercase tracking-wider">Next Action</p>
                <p className="text-xs text-brand-800 mt-0.5">{decision.nextAction}</p>
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
              {decision.referralType && <span className="text-sm text-slate-600">{decision.referralType}</span>}
            </div>
            {decision.referralReason && (
              <p className="text-xs text-slate-500 leading-relaxed">{decision.referralReason}</p>
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
            <p className="text-sm text-slate-700">
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Clinical Warnings
          </p>
          <ul className="space-y-1.5">
            {decision.clinicalWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guideline reference */}
      {decision.guidelineReference && (
        <div className="flex items-start gap-2 text-xs text-slate-400 border-t border-slate-100 pt-3">
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{decision.guidelineReference}</span>
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
      ? "HPV Other detected — cytology result required per Figure 3 pathway"
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
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enter Screening Results</h1>
        <p className="text-sm text-slate-500 mt-0.5">GP Portal — NZ Cervical Screening Programme</p>
      </div>

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
                <div role="alert" className="mt-3 flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{lookupError}</p>
                </div>
              )}
              {patient && (
                <div className="mt-4 bg-brand-50 border border-brand-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-base">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-slate-500 font-mono mt-0.5">NHI: {patient.nhi}</p>
                      <p className="text-sm text-slate-500">
                        DOB: {new Date(patient.dateOfBirth).toLocaleDateString("en-NZ")}
                      </p>
                      {patient.gpPractice && (
                        <p className="text-xs text-slate-400 mt-0.5">{patient.gpPractice.name}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {patient.isFirstTimeHPVTransition && (
                        <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">
                          HPV Transition
                        </span>
                      )}
                      {patient.isPostHysterectomy && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
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
                  {swabWarning && (
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{swabWarning}</p>
                    </div>
                  )}
                  <Select
                    label="HPV Result"
                    options={HPV_OPTIONS}
                    value={hpvResult}
                    onChange={(e) => { setHpvResult(e.target.value); previewDecision(); }}
                    hint="Required for Figure 3 Primary HPV Screening pathway"
                  />
                  <Select
                    label="Cytology Result"
                    options={CYTOLOGY_OPTIONS}
                    value={cytologyResult}
                    onChange={(e) => { setCytologyResult(e.target.value); previewDecision(); }}
                    hint="Structured vocabulary per NZ Cervical Screening guidelines"
                  />
                  {cytologyWarning && (
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{cytologyWarning}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-brand-600" />
                    3. Pathway Override
                    <span className="ml-1 text-[10px] font-medium text-slate-400 normal-case tracking-normal">Optional</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    label="Clinical Figure"
                    options={FIGURE_OPTIONS}
                    value={currentFigure}
                    onChange={(e) => { setCurrentFigure(e.target.value); previewDecision(); }}
                    hint="Only override if auto-detection is incorrect"
                  />
                </CardContent>
              </Card>

              {submitError && (
                <div role="alert" className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

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
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800">Results Submitted Successfully</p>
                    <p className="text-sm text-emerald-600 mt-0.5">
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clinical Decision</p>
          </div>
          <DecisionPreviewPanel decision={decision} isPreview={!submitted} />
        </div>
      </div>
    </div>
  );
}
