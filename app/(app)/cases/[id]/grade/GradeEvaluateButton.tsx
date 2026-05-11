"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GradeEvaluateButton({
  caseId,
  disabledReason,
}: {
  caseId: string;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/rules/evaluate`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Rule evaluation failed");
      }
      router.refresh();
    } catch (evaluateError) {
      setError(
        evaluateError instanceof Error
          ? evaluateError.message
          : "Rule evaluation failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleEvaluate}
        loading={loading}
        disabled={Boolean(disabledReason)}
      >
        {!loading && <ShieldCheck className="h-4 w-4" />}
        Evaluate rules
      </Button>
      {error && <div className="text-xs text-destructive max-w-64 text-right">{error}</div>}
    </div>
  );
}
