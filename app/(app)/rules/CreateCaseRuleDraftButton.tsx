"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function CreateCaseRuleDraftButton({
  serviceLine,
  label,
}: {
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/case-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceLine }),
      });

      const payload = (await response.json()) as { error?: string; id?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create rule draft");
      }

      if (payload.id) {
        router.push(`/rules/${payload.id}`);
        return;
      }

      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create rule draft"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        loading={loading}
        onClick={handleClick}
      >
        {label}
      </Button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
