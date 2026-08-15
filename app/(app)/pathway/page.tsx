"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckCircle2,
  CircleDot,
  ArrowRight,
  User,
  Building2,
  Calendar,
  Fingerprint,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PageIntro } from "@/components/layout/PageIntro";
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
  mode?: "clean" | "import" | "resume";
  resumed?: boolean;
  confidence: "complete" | "partial" | "none";
  summary: string[];
  detectedFigure?: string;
  isComplete: boolean;
  autoFilledCount: number;
};

function ConfidenceBanner({ confidence }: { confidence: StartResult["confidence"] }) {
  if (confidence === "complete") {
    return (
      <Alert variant="success">
        <strong>All data available — Auto-analysis ready.</strong> Existing patient records provide all inputs needed for a clinical decision.
      </Alert>
    );
  }
  if (confidence === "partial") {
    return (
      <Alert variant="warning">
        <strong>Partial data — Wizard pre-filled.</strong> Some answers were pre-filled from existing records. You will only need to answer unanswered questions.
      </Alert>
    );
  }
  return (
    <Alert variant="info">
      <strong>No existing data — Guided wizard.</strong> Answer all questions to reach a clinical decision.
    </Alert>
  );
}

export default function PathwayWizardStartPage() {
  const router = useRouter();
  const [nhiInput, setNhiInput] = useState("");
  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [startResult, setStartResult] = useState<StartResult | null>(null);
  const [startingMode, setStartingMode] = useState<"clean" | "import" | "resume" | null>(null);
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
    async (mode: "clean" | "import" | "resume") => {
      if (!patient) return;
      setStartingMode(mode);
      setStartError("");

      try {
        const res = await fetch("/api/pathway/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: patient.id, mode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start session");

        setStartResult(data);
        router.push(`/pathway/${data.sessionId}`);
      } catch (e: unknown) {
        setStartError(e instanceof Error ? e.message : "Failed to start wizard");
      } finally {
        setStartingMode(null);
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
    <div className="min-h-full bg-background">
      <div className="page-aura border-b border-border bg-card px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-4">
          <PageIntro
            eyebrow="Clinical pathway tool"
            title="Cervical Pathway Wizard"
            description="Manual validation tool — not the primary enterprise referral workflow. Use the guided wizard when you need step-by-step cervical pathway support; enterprise referral grading starts from cases."
            trailing={
              <>
                <Link href="/cases">
                  <Button variant="outline" size="sm">Enterprise cases</Button>
                </Link>
                <Link href="/guidelines">
                  <Button variant="outline" size="sm">Guidelines</Button>
                </Link>
              </>
            }
          />
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Workflow: find the patient, start a clean new assessment, resume an incomplete assessment, or explicitly import existing history when that is clinically intended.
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* NHI Search Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-muted-foreground" />
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
              <Alert variant="error">{searchError}</Alert>
            )}
          </CardContent>
        </Card>

        {/* Patient Details Card */}
        {patient && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-muted-foreground" />
                Patient Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Demographics grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <User className="h-3 w-3" /> Name
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {patient.firstName} {patient.lastName}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Fingerprint className="h-3 w-3" /> NHI
                  </p>
                  <p className="font-mono text-sm font-semibold text-foreground">{patient.nhi}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date of Birth
                  </p>
                  <p className="text-sm font-semibold text-foreground">{dob}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Practice
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {patient.gpPractice?.name ?? "—"}
                  </p>
                </div>
              </div>

              {/* Clinical Flags */}
              <div className="flex flex-wrap gap-2">
                {patient.isFirstTimeHPVTransition && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-medium px-3 py-1">
                    <ShieldCheck className="h-3 w-3" />
                    HPV Transition
                  </span>
                )}
                {patient.isPostHysterectomy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 text-info border border-info/20 text-xs font-medium px-3 py-1">
                    <ClipboardList className="h-3 w-3" />
                    Post-Hysterectomy
                  </span>
                )}
                {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground border border-border text-xs font-medium px-3 py-1">
                    <CircleDot className="h-3 w-3" />
                    Routine Screening
                  </span>
                )}
              </div>

              {/* Auto-fill confidence (shown after session starts) */}
              {startResult && (
                <div className="space-y-3 border-t border-border pt-4">
                  <ConfidenceBanner confidence={startResult.confidence} />

                  {startResult.summary.length > 0 && (
                    <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        Detected from existing records
                      </p>
                      <ul className="space-y-1.5">
                        {startResult.summary.map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {startError && <Alert variant="error">{startError}</Alert>}

              {/* Action */}
              <div className="pt-1">
                <div className="grid gap-2">
                  <Button
                    variant="primary"
                    onClick={() => handleStart("clean")}
                    disabled={startingMode !== null}
                    loading={startingMode === "clean"}
                    className={cn("w-full", startingMode === "clean" && "opacity-80")}
                  >
                    {startingMode !== "clean" && <ArrowRight className="h-4 w-4" />}
                    {startingMode === "clean" ? "Starting…" : "Start new assessment"}
                  </Button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleStart("resume")}
                      disabled={startingMode !== null}
                      loading={startingMode === "resume"}
                    >
                      Resume incomplete assessment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStart("import")}
                      disabled={startingMode !== null}
                      loading={startingMode === "import"}
                    >
                      Start with history pre-fill
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Start new assessment begins with empty answers. History pre-fill and resume are explicit actions and are recorded in audit.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!patient && !searching && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-card p-12 text-center space-y-3 animate-fade-in">
              <div className="flex justify-center">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-muted ring-1 ring-border/70 before:absolute before:inset-0 before:-z-10 before:rounded-[1.4rem] before:bg-accent-color/10 before:blur-xl">
                <ClipboardList className="h-7 w-7 text-accent-color" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Search for a patient by NHI to begin</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                The wizard guides you through all clinical questions step-by-step and generates a decision at the end.
              </p>
            </div>
            <div className="flex justify-center gap-6 pt-2">
              {[
                { icon: Search, label: "Find patient" },
                { icon: ClipboardList, label: "Answer questions" },
                { icon: CheckCircle2, label: "Get decision" },
              ].map(({ icon: Icon, label }, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg chip-gradient-brand text-white shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
