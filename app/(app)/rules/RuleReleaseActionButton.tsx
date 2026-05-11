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
    if (disabled) {
      setError(disabledReason ?? "Action is currently unavailable");
      return;
    }

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
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant={variant}
        size="sm"
        loading={loading}
        disabled={disabled}
        onClick={handleClick}
      >
        {label}
      </Button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
