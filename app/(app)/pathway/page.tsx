"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const handleStart = useCallback(async (mode: "auto" | "guided") => {
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
        // Complete the session immediately and go to result
        const completeRes = await fetch(`/api/pathway/sessions/${data.sessionId}/complete`, {
          method: "POST",
        });
        if (completeRes.ok) {
          router.push(`/pathway/${data.sessionId}/result`);
          return;
        }
      }

      setStartResult(data);
      // For guided mode or non-complete auto, go to wizard
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
  }, [patient, router]);

  const confidenceBanner = (confidence: StartResult["confidence"]) => {
    if (confidence === "complete") {
      return (
        <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <span className="text-green-600 text-lg mt-0.5">●</span>
          <div>
            <p className="text-sm font-semibold text-green-800">All data available — Auto-analysis ready</p>
            <p className="text-xs text-green-700 mt-0.5">Existing patient records provide all inputs needed for a clinical decision.</p>
          </div>
        </div>
      );
    }
    if (confidence === "partial") {
      return (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="text-amber-600 text-lg mt-0.5">▲</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Partial data available — Wizard pre-filled</p>
            <p className="text-xs text-amber-700 mt-0.5">Some answers were pre-filled from existing records. You will only need to answer unanswered questions.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
        <span className="text-gray-400 text-lg mt-0.5">○</span>
        <div>
          <p className="text-sm font-semibold text-gray-700">No existing data — Guided wizard</p>
          <p className="text-xs text-gray-500 mt-0.5">Answer all questions to reach a clinical decision.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>
          ◎ Pathway Wizard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Guided clinical decision support — one question at a time.
        </p>
      </div>

      {/* NHI Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find Patient</CardTitle>
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
              >
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          {searchError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {searchError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Card */}
      {patient && (
        <Card>
          <CardHeader>
            <CardTitle>Patient Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Demographics */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-semibold text-gray-900">{patient.firstName} {patient.lastName}</p>
              </div>
              <div>
                <span className="text-gray-500">NHI</span>
                <p className="font-mono font-semibold text-gray-900">{patient.nhi}</p>
              </div>
              <div>
                <span className="text-gray-500">Date of Birth</span>
                <p className="font-semibold text-gray-900">
                  {new Date(patient.dateOfBirth).toLocaleDateString("en-NZ", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Practice</span>
                <p className="font-semibold text-gray-900">{patient.gpPractice?.name ?? "—"}</p>
              </div>
            </div>

            {/* Clinical Flags */}
            <div className="flex flex-wrap gap-2 pt-1">
              {patient.isFirstTimeHPVTransition && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium px-3 py-1">
                  ✦ HPV Transition
                </span>
              )}
              {patient.isPostHysterectomy && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1">
                  ◈ Post-Hysterectomy
                </span>
              )}
              {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1">
                  ● Routine Screening
                </span>
              )}
            </div>

            {/* Auto-fill preview (loaded after start is triggered) */}
            {startResult && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                {confidenceBanner(startResult.confidence)}

                {startResult.summary.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Detected from existing records:</p>
                    <ul className="space-y-1">
                      {startResult.summary.map((s, i) => (
                        <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                          <span className="text-teal-500 mt-0.5">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {startError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {startError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => handleStart("guided")}
                disabled={starting}
                className="flex-1"
              >
                {starting ? "Starting…" : "▶ Start Guided Wizard"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStart("auto")}
                disabled={starting}
                className="flex-1"
              >
                ⚡ Auto-Analyse
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              <strong>Guided Wizard</strong> asks questions one at a time. &nbsp;
              <strong>Auto-Analyse</strong> uses existing records to skip straight to the decision.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instructions when no patient selected */}
      {!patient && !searching && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400 space-y-2">
          <div className="text-3xl">◎</div>
          <p className="text-sm font-medium">Search for a patient by NHI to begin</p>
          <p className="text-xs">The wizard guides you through all clinical questions step-by-step and generates a decision at the end.</p>
        </div>
      )}
    </div>
  );
}
