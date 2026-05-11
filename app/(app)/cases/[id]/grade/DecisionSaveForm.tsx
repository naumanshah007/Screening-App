"use client";

import type { TriagePriority } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const priorityOptions: { value: TriagePriority; label: string }[] = [
  { value: "P1", label: "P1 Urgent" },
  { value: "P1_HSC", label: "P1 HSC" },
  { value: "P2", label: "P2 High" },
  { value: "P2_HSC", label: "P2 HSC" },
  { value: "P3", label: "P3 Standard" },
  { value: "P5", label: "P5 Virtual" },
  { value: "REJECT", label: "Reject" },
  { value: "DECLINE", label: "Decline" },
  { value: "INFO_REQUIRED", label: "Info Required" },
];

type RecommendationSeed = {
  priority?: TriagePriority | null;
  category?: string | null;
  outcome?: string | null;
};

type ExistingDecisionSeed = {
  finalPriority?: TriagePriority | null;
  finalCategory?: string | null;
  finalOutcome?: string | null;
  overrideReason?: string | null;
  notes?: string | null;
};

export function DecisionSaveForm({
  caseId,
  recommendation,
  existingDecision,
}: {
  caseId: string;
  recommendation?: RecommendationSeed | null;
  existingDecision?: ExistingDecisionSeed | null;
}) {
  const router = useRouter();
  const [finalPriority, setFinalPriority] = useState<TriagePriority | "">(
    existingDecision?.finalPriority ?? recommendation?.priority ?? ""
  );
  const [finalCategory, setFinalCategory] = useState(
    existingDecision?.finalCategory ?? recommendation?.category ?? ""
  );
  const [finalOutcome, setFinalOutcome] = useState(
    existingDecision?.finalOutcome ?? recommendation?.outcome ?? ""
  );
  const [overrideReason, setOverrideReason] = useState(
    existingDecision?.overrideReason ?? ""
  );
  const [notes, setNotes] = useState(existingDecision?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const differsFromRecommendation =
    Boolean(recommendation?.priority || recommendation?.category || recommendation?.outcome) &&
    (recommendation?.priority !== finalPriority ||
      (recommendation?.category ?? "") !== finalCategory.trim() ||
      (recommendation?.outcome ?? "") !== finalOutcome.trim());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!finalPriority) {
      setError("Final priority is required.");
      return;
    }

    if (!finalOutcome.trim()) {
      setError("Final outcome is required.");
      return;
    }

    if (differsFromRecommendation && !overrideReason.trim()) {
      setError("Override reason is required when changing the provisional recommendation.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          finalPriority,
          finalCategory,
          finalOutcome,
          overrideReason,
          notes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save clinician decision");
      }

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save clinician decision"
      );
    } finally {
      setLoading(false);
    }
  }

  function applyRecommendation() {
    setFinalPriority(recommendation?.priority ?? "");
    setFinalCategory(recommendation?.category ?? "");
    setFinalOutcome(recommendation?.outcome ?? "");
    setOverrideReason("");
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Select
        label="Final priority"
        value={finalPriority}
        onChange={(event) => setFinalPriority(event.target.value as TriagePriority | "")}
        placeholder="Select final priority"
        options={priorityOptions}
      />

      <Input
        label="Final category"
        value={finalCategory}
        onChange={(event) => setFinalCategory(event.target.value)}
        placeholder="Enter service category"
      />

      <Textarea
        label="Final outcome"
        rows={3}
        value={finalOutcome}
        onChange={(event) => setFinalOutcome(event.target.value)}
        placeholder="Describe the approved grading outcome"
      />

      <Textarea
        label="Override reason"
        rows={3}
        value={overrideReason}
        onChange={(event) => setOverrideReason(event.target.value)}
        placeholder="Required when the clinician decision differs from the provisional recommendation"
        hint={
          differsFromRecommendation
            ? "The current form values differ from the provisional rule recommendation."
            : "Leave blank when accepting the provisional recommendation unchanged."
        }
      />

      <Textarea
        label="Clinician notes"
        rows={4}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional notes for booking, follow-up, or service coordination"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={loading} variant="success">
          Save clinician decision
        </Button>
        {recommendation && (
          <Button
            type="button"
            variant="outline"
            onClick={applyRecommendation}
            disabled={loading}
          >
            Apply provisional recommendation
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
