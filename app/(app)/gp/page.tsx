"use client";
import { useState, useCallback } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionPanel } from "@/components/clinical/DecisionPanel";
import { PathwayIndicator, RiskLegend } from "@/components/clinical/PathwayIndicator";
import type { ClinicalDecision } from "@/lib/engine/types";

const HPV_OPTIONS = [
  { value: "", label: "Select HPV result…" },
  { value: "NOT_DETECTED", label: "HPV Not Detected" },
  { value: "HPV_16_18", label: "HPV 16 or 18 Detected" },
  { value: "HPV_OTHER", label: "HPV Other Detected" },
  { value: "INADEQUATE", label: "Inadequate Sample" },
];

// Structured vocabulary per report recommendation
const CYTOLOGY_OPTIONS = [
  { value: "", label: "Select cytology result…" },
  { value: "NEGATIVE", label: "Negative" },
  { value: "ASC_US", label: "ASC-US (Atypical squamous cells, undetermined)" },
  { value: "LSIL", label: "LSIL (Low-grade squamous intraepithelial lesion)" },
  { value: "ASC_H", label: "ASC-H (Atypical squamous cells, cannot exclude HSIL)" },
  { value: "HSIL", label: "HSIL (High-grade squamous intraepithelial lesion)" },
  { value: "SCC", label: "SCC (Squamous cell carcinoma)" },
  { value: "AG1", label: "AG1 (Atypical glandular cells, NOS)" },
  { value: "AG2", label: "AG2 (Atypical endometrial cells)" },
  { value: "AG3", label: "AG3 (Atypical glandular cells, favour neoplasia)" },
  { value: "AG4", label: "AG4 (AIS — Adenocarcinoma in situ)" },
  { value: "AG5", label: "AG5 (Adenocarcinoma)" },
  { value: "AC1", label: "AC1 (Atypical endocervical cells, NOS)" },
  { value: "AC2", label: "AC2 (Atypical endocervical cells, favour neoplasia)" },
  { value: "AC3", label: "AC3 (AIS endocervical type)" },
  { value: "AC4", label: "AC4 (Adenocarcinoma, endocervical type)" },
  { value: "UNSATISFACTORY", label: "Unsatisfactory" },
];

const SAMPLE_OPTIONS = [
  { value: "", label: "Select sample type…" },
  { value: "LBC", label: "LBC (Liquid Based Cytology)" },
  { value: "SWAB", label: "SWAB" },
];

const FIGURE_OPTIONS = [
  { value: "", label: "Auto-detect (recommended)" },
  { value: "FIGURE_1", label: "Figure 1 — HPV Transition (cytology-negative)" },
  { value: "FIGURE_2", label: "Figure 2 — HPV Transition (previously abnormal)" },
  { value: "FIGURE_3", label: "Figure 3 — Primary HPV Screening" },
  { value: "FIGURE_4", label: "Figure 4 — Colposcopy & Histology" },
  { value: "FIGURE_5", label: "Figure 5 — High-grade Lesion Management" },
  { value: "FIGURE_6", label: "Figure 6 — Test of Cure" },
  { value: "FIGURE_7", label: "Figure 7 — Post-abnormal Management" },
  { value: "FIGURE_8", label: "Figure 8 — Post-hysterectomy" },
  { value: "FIGURE_9", label: "Figure 9 — Extended Post-abnormal" },
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

export default function GPPortalPage() {
  // Patient lookup
  const [nhiSearch, setNhiSearch] = useState("");
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Form fields
  const [hpvResult, setHpvResult] = useState("");
  const [cytologyResult, setCytologyResult] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [labId, setLabId] = useState("");
  const [currentFigure, setCurrentFigure] = useState("");

  // Preview state
  const [decision, setDecision] = useState<ClinicalDecision | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Lookup patient by NHI
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
        setLookupError("No patient found with that NHI. Check NHI and try again.");
      } else {
        setPatient(data.patients[0]);
      }
    } catch {
      setLookupError("Network error. Try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  // Preview decision (real-time, no save)
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

  // Submit results (saves to DB)
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

  const cytologyRequiredWarning =
    hpvResult === "HPV_16_18" && !cytologyResult
      ? "HPV 16/18 detected — cytology result required to determine final pathway per Figure 3"
      : hpvResult === "HPV_OTHER" && !cytologyResult
      ? "HPV Other detected — cytology result required per Figure 3 pathway"
      : null;

  const swabWarning =
    sampleType === "SWAB"
      ? "Swab sample taken: return visit with clinical examination required per Figure 3 guidelines"
      : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Enter Screening Results</h1>
        <p className="text-sm text-gray-500 mt-1">GP Portal — NZ Cervical Screening Programme</p>
      </div>

      {/* Risk legend */}
      <RiskLegend />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: form */}
        <div className="space-y-6">
          {/* Patient lookup */}
          <Card>
            <CardHeader>
              <CardTitle>1. Patient Lookup</CardTitle>
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
                <div className="flex items-end">
                  <Button type="submit" disabled={lookupLoading} size="md">
                    {lookupLoading ? "Searching…" : "Search"}
                  </Button>
                </div>
              </form>
              {lookupError && (
                <div role="alert" className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {lookupError}
                </div>
              )}
              {patient && (
                <div className="mt-4 bg-[#0D9488]/5 border border-[#0D9488]/20 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#1E3A5F] text-base">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-500 font-mono mt-0.5">NHI: {patient.nhi}</p>
                      <p className="text-sm text-gray-500">
                        DOB: {new Date(patient.dateOfBirth).toLocaleDateString("en-NZ")}
                      </p>
                      {patient.gpPractice && (
                        <p className="text-sm text-gray-500">{patient.gpPractice.name}</p>
                      )}
                    </div>
                    <div className="space-y-1 text-right">
                      {patient.isFirstTimeHPVTransition && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                          HPV Transition Patient
                        </span>
                      )}
                      {patient.isPostHysterectomy && (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                          Post-Hysterectomy
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results form */}
          {patient && !submitted && (
            <form onSubmit={submitResults} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>2. Test Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    placeholder="Optional lab reference"
                  />
                  <Select
                    label="Sample Type"
                    options={SAMPLE_OPTIONS}
                    value={sampleType}
                    onChange={(e) => { setSampleType(e.target.value); }}
                    hint="LBC is standard. Swab requires return visit."
                  />
                  {swabWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700">⚠ {swabWarning}</p>
                    </div>
                  )}
                  <Select
                    label="HPV Result"
                    options={HPV_OPTIONS}
                    value={hpvResult}
                    onChange={(e) => { setHpvResult(e.target.value); previewDecision(); }}
                    hint="HPV result is required for Figure 3 Primary HPV Screening pathway"
                  />
                  <Select
                    label="Cytology Result"
                    options={CYTOLOGY_OPTIONS}
                    value={cytologyResult}
                    onChange={(e) => { setCytologyResult(e.target.value); previewDecision(); }}
                    hint="Structured vocabulary per NZ Cervical Screening guidelines"
                  />
                  {cytologyRequiredWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700">⚠ {cytologyRequiredWarning}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Pathway Override (Optional)</CardTitle>
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
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previewDecision}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Previewing…" : "Preview Decision"}
                </Button>
                <Button type="submit" disabled={submitLoading || !hpvResult}>
                  {submitLoading ? "Submitting…" : "Submit Results"}
                </Button>
              </div>
            </form>
          )}

          {submitted && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Results Submitted</p>
                    <p className="text-sm text-green-600">
                      Decision recorded and pathway updated.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setPatient(null);
                    setNhiSearch("");
                    setHpvResult("");
                    setCytologyResult("");
                    setSampleType("");
                    setLabId("");
                    setCurrentFigure("");
                    setDecision(null);
                    setSubmitted(false);
                  }}
                >
                  Enter results for another patient
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: decision preview */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Clinical Decision
            </h2>
            {decision && (
              <PathwayIndicator
                figure={decision.figure}
                riskLevel={decision.riskLevel}
              />
            )}
          </div>
          <DecisionPanel decision={decision} isPreview={!submitted} />
        </div>
      </div>
    </div>
  );
}
