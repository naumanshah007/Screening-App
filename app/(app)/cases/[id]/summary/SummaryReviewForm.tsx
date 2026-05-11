"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function SummaryReviewForm({
  caseId,
  initialMarkdown,
  initialStatus,
}: {
  caseId: string;
  initialMarkdown: string;
  initialStatus: "DRAFT" | "REVIEWED" | "APPROVED";
}) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [status, setStatus] = useState(initialStatus);
  const [loadingAction, setLoadingAction] = useState<"review" | "approve" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: "review" | "approve") {
    setLoadingAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/summary/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          renderedMarkdown: markdown,
        }),
      });

      const payload = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update summary");
      }

      setStatus(
        (payload.status as typeof initialStatus | undefined) ??
          (action === "approve" ? "APPROVED" : "REVIEWED")
      );
      setMessage(
        action === "approve"
          ? "Summary approved for downstream grading."
          : "Summary review draft saved."
      );
      router.refresh();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to update summary"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        label="Clinician-reviewed summary"
        rows={18}
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        placeholder="Edit the one-page summary before approval"
        hint={
          status === "APPROVED"
            ? "Editing without re-approving will move the summary back out of approved state."
            : "Save review to keep edits without approving yet, or approve when ready."
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          loading={loadingAction === "review"}
          onClick={() => submit("review")}
        >
          Save review
        </Button>
        <Button
          type="button"
          variant="success"
          loading={loadingAction === "approve"}
          onClick={() => submit("approve")}
        >
          Approve summary
        </Button>
      </div>

      {message && <div className="text-sm text-success">{message}</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
