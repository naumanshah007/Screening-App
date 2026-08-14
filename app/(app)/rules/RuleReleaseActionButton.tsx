"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function RuleReleaseActionButton({
  releaseId,
  action,
  label,
  variant = "outline",
  disabled = false,
  disabledReason,
}: {
  releaseId: string;
  action: "review" | "publish";
  label: string;
  variant?: "outline" | "success";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/case-rules/${releaseId}/${action}`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to ${action} release`);
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `Unable to ${action} release`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant={variant}
        size="sm"
        loading={loading}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={handleClick}
      >
        {label}
      </Button>
      {/*
        The caller has always computed a precise reason — "Review is required
        before publish", "Regression suite must pass before publish" — but it
        was only set from the click handler, and a disabled button never fires
        one. The reason was therefore unreachable in the UI it was written for.
        It is now shown whenever the control is unavailable.
      */}
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
