"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Search,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
  ArrowRight,
  Zap,
  User,
  Building2,
  Calendar,
  Fingerprint,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PatientResult = {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isFirstTimeHPVTransition: boolean;
  isPostHysterectomy: boolean;
  gpPractice?: { name: string } | null;
};

type StartResult = {
  sessionId: string;
  confidence: "complete" | "partial" | "none";
  summary: string[];
  detectedFigure?: string;
  isComplete: boolean;
  autoFilledCount: number;
};

function ConfidenceBanner({ confidence }: { confidence: StartResult["confidence"] }) {
  if (confidence === "complete") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">All data available — Auto-analysis ready</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Existing patient records provide all inputs needed for a clinical decision.
          </p>
        </div>
      </div>
    );
  }
  if (confidence === "partial") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Partial data available — Wizard pre-filled</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Some answers were pre-filled from existing records. You will only need to answer unanswered questions.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
      <CircleDot className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-slate-700">No existing data — Guided wizard</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Answer all questions to reach a clinical decision.
        </p>
      </div>
    </div>
  );
}

export default function PathwayWizardStartPage() {
  const router = useRouter();
  const [nhiInput, setNhiInput] = useState("");
  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [startResult, setStartResult] = useState<StartResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const handleSearch = useCallback(async () => {
    const nhi = nhiInput.trim().toUpperCase();
    if (!nhi) return;
    setSearching(true);
    setSearchError("");
    setPatient(null);
    setStartResult(null);

    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(nhi)}&limit=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      const found = data.patients?.[0] ?? null;
      if (!found) setSearchError("No patient found with that NHI.");
      else setPatient(found);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [nhiInput]);

  const handleStart = useCallback(
    async (mode: "auto" | "guided") => {
      if (!patient) return;
      setStarting(true);
      setStartError("");

      try {
        const res = await fetch("/api/pathway/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: patient.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start session");

        if (mode === "auto" && data.isComplete) {
          const completeRes = await fetch(
            `/api/pathway/sessions/${data.sessionId}/complete`,
            { method: "POST" }
          );
          if (completeRes.ok) {
            router.push(`/pathway/${data.sessionId}/result`);
            return;
          }
        }

        setStartResult(data);
        if (mode === "guided" || !data.isComplete) {
          router.push(`/pathway/${data.sessionId}`);
        } else {
          router.push(`/pathway/${data.sessionId}/result`);
        }
      } catch (e: unknown) {
        setStartError(e instanceof Error ? e.message : "Failed to start wizard");
      } finally {
        setStarting(false);
      }
    },
    [patient, router]
  );

  const dob = patient
    ? new Date(patient.dateOfBirth).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-full bg-surface">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/10">
            <GitBranch className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-navy-800">Pathway Wizard</h1>
            <p className="text-sm text-slate-500">
              Guided clinical decision support — one question at a time
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* NHI Search Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-slate-400" />
              Find Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="NHI Number"
                  value={nhiInput}
                  onChange={(e) => setNhiInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ZZZ0002"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  onClick={handleSearch}
                  disabled={!nhiInput.trim() || searching}
                  loading={searching}
                >
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>

            {searchError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {searchError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Details Card */}
        {patient && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-slate-400" />
                Patient Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Demographics grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <User className="h-3 w-3" /> Name
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Fingerprint className="h-3 w-3" /> NHI
                  </p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{patient.nhi}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date of Birth
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{dob}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Practice
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {patient.gpPractice?.name ?? "—"}
                  </p>
                </div>
              </div>

              {/* Clinical Flags */}
              <div className="flex flex-wrap gap-2">
                {patient.isFirstTimeHPVTransition && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium px-3 py-1">
                    <ShieldCheck className="h-3 w-3" />
                    HPV Transition
                  </span>
                )}
                {patient.isPostHysterectomy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1">
                    <ClipboardList className="h-3 w-3" />
                    Post-Hysterectomy
                  </span>
                )}
                {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium px-3 py-1">
                    <CircleDot className="h-3 w-3" />
                    Routine Screening
                  </span>
                )}
              </div>

              {/* Auto-fill confidence (shown after session starts) */}
              {startResult && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <ConfidenceBanner confidence={startResult.confidence} />

                  {startResult.summary.length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                        Detected from existing records
                      </p>
                      <ul className="space-y-1.5">
                        {startResult.summary.map((s, i) => (
                          <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {startError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {startError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="primary"
                  onClick={() => handleStart("guided")}
                  disabled={starting}
                  loading={starting}
                  className={cn("flex-1", starting && "opacity-80")}
                >
                  {!starting && <ArrowRight className="h-4 w-4" />}
                  {starting ? "Starting…" : "Start Guided Wizard"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStart("auto")}
                  disabled={starting}
                  className="flex-1"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Auto-Analyse
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                <strong>Guided Wizard</strong> asks questions one at a time. &nbsp;
                <strong>Auto-Analyse</strong> uses existing records to skip straight to the decision.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!patient && !searching && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3 animate-fade-in">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <GitBranch className="h-7 w-7 text-slate-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Search for a patient by NHI to begin</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                The wizard guides you through all clinical questions step-by-step and generates a decision at the end.
              </p>
            </div>
            <div className="flex justify-center gap-6 pt-2">
              {[
                { icon: Search, label: "Find patient" },
                { icon: GitBranch, label: "Answer questions" },
                { icon: CheckCircle2, label: "Get decision" },
              ].map(({ icon: Icon, label }, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10">
                    <Icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
