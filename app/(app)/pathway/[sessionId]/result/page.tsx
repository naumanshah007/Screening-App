"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DecisionCard } from "@/components/clinical/DecisionCard";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicalDecision = {
  figure: string;
  riskLevel: string;
  recommendation: string;
  recommendationCode: string;
  nextAction?: string;
  referralRequired?: boolean;
  referralType?: string;
  referralPriority?: string;
  referralReason?: string;
  recallRequired?: boolean;
  recallIntervalMonths?: number;
  clinicalWarnings?: string[];
  guidelineReference?: string;
  rationale?: string;
};

type PatientInfo = {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email?: string | null;
};

type SessionResult = {
  decision: ClinicalDecision;
  patient: PatientInfo & { name: string };
  screeningSessionId: string;
  referral?: { id: string; priority: string; type: string } | null;
  recall?: { id: string; dueDate: string } | null;
  alreadyComplete?: boolean;
};

// ─── Notification Button ──────────────────────────────────────────────────────

function NotifyButton({
  label,
  icon,
  onClick,
  disabled,
  sent,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled: boolean;
  sent: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || sent}
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
        sent
          ? "border-green-200 bg-green-50 text-green-700 cursor-default"
          : "border-gray-200 bg-white text-gray-700 hover:border-[#0D9488] hover:text-[#0D9488] hover:shadow-sm"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span>{sent ? "✓" : icon}</span>
      {sent ? `${label} notified` : `Notify ${label}`}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WizardResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { data: authSession } = useSession();

  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  // Notification state
  const [notifying, setNotifying] = useState(false);
  const [sentChannels, setSentChannels] = useState<Set<string>>(new Set());

  // Load or complete the wizard session
  useEffect(() => {
    const loadResult = async () => {
      try {
        // First try to get from wizard session (already complete)
        const sessionRes = await fetch(`/api/pathway/sessions/${sessionId}`);
        const sessionData = await sessionRes.json();

        if (sessionData.session?.status === "COMPLETE" && sessionData.session?.decisionJson) {
          // Already complete — parse stored decision
          setResult({
            decision: sessionData.session.decisionJson,
            patient: {
              ...sessionData.patient,
              name: `${sessionData.patient.firstName} ${sessionData.patient.lastName}`,
            },
            screeningSessionId: sessionData.session.screeningSessionId ?? "",
            alreadyComplete: true,
          });
          setLoading(false);
          return;
        }

        // Not yet complete — call complete endpoint
        setCompleting(true);
        const completeRes = await fetch(`/api/pathway/sessions/${sessionId}/complete`, {
          method: "POST",
        });
        const completeData = await completeRes.json();

        if (!completeRes.ok) throw new Error(completeData.error ?? "Failed to complete session");

        setResult({
          decision: completeData.decision,
          patient: completeData.patient,
          screeningSessionId: completeData.screeningSessionId,
          referral: completeData.referral,
          recall: completeData.recall,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load decision");
      } finally {
        setLoading(false);
        setCompleting(false);
      }
    };

    loadResult();
  }, [sessionId]);

  const handleNotify = async (channel: "patient" | "gp" | "coordinator") => {
    setNotifying(true);
    try {
      const res = await fetch(`/api/pathway/sessions/${sessionId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyPatient: channel === "patient",
          notifyGP: channel === "gp",
          notifyCoordinator: channel === "coordinator",
        }),
      });
      const data = await res.json();
      if (res.ok && data.sent?.length > 0) {
        setSentChannels((prev) => new Set([...prev, ...data.sent]));
      }
    } catch {
      // non-fatal
    } finally {
      setNotifying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || completing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-[#0D9488] animate-spin" />
        <p className="text-sm text-gray-500">
          {completing ? "Generating clinical decision…" : "Loading result…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <div className="text-3xl text-red-400">⚠</div>
        <p className="text-gray-700 font-medium">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/pathway/${sessionId}`)}>
          ← Back to Wizard
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const { decision, patient } = result;
  const preparedByName = authSession?.user?.name ?? authSession?.user?.email ?? "Clinical Staff";

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { padding: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 print-full">
        {/* Action bar — hidden when printing */}
        <div className="no-print flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>
              Clinical Decision
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pathway assessment complete for{" "}
              <span className="font-medium text-gray-700">{patient.name}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/pathway/${sessionId}`)}>
              ← Review Answers
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              🖨 Print
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/patients/${patient.id}`)}
            >
              View Patient →
            </Button>
          </div>
        </div>

        {/* Decision Card */}
        <DecisionCard
          decision={decision}
          patient={patient}
          preparedBy={preparedByName}
          practiceName="Auckland City Medical Centre"
          referenceId={sessionId}
          assessmentDate={new Date()}
        />

        {/* Notifications panel — hidden when printing */}
        <div className="no-print rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#1E3A5F" }}>
              Send Notifications
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Notify relevant parties about this clinical decision.
              {!result.referral && " (Coordinator notifications require a referral.)"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <NotifyButton
              label="Patient"
              icon="👤"
              onClick={() => handleNotify("patient")}
              disabled={notifying || !patient.email}
              sent={sentChannels.has("patient")}
            />
            <NotifyButton
              label="GP"
              icon="🩺"
              onClick={() => handleNotify("gp")}
              disabled={notifying}
              sent={sentChannels.has("gp")}
            />
            <NotifyButton
              label="Coordinator"
              icon="📋"
              onClick={() => handleNotify("coordinator")}
              disabled={notifying || !decision.referralRequired}
              sent={sentChannels.has("coordinator")}
            />
          </div>

          {!patient.email && (
            <p className="text-xs text-amber-600">
              ⚠ No email address on file for this patient — patient notification unavailable.
            </p>
          )}
          {!decision.referralRequired && (
            <p className="text-xs text-gray-400">
              ℹ Coordinator notification is only available when a referral is required.
            </p>
          )}
        </div>

        {/* Quick links */}
        <div className="no-print grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/pathway")}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left hover:border-[#0D9488] hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-gray-800">◎ New Pathway Wizard</p>
            <p className="text-xs text-gray-500 mt-0.5">Start a wizard for another patient</p>
          </button>
          <button
            onClick={() => router.push("/coordinator")}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left hover:border-[#0D9488] hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-gray-800">📋 Referral Queue</p>
            <p className="text-xs text-gray-500 mt-0.5">View and manage referrals</p>
          </button>
        </div>
      </div>
    </>
  );
}
