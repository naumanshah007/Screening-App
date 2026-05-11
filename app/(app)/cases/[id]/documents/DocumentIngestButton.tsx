"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocumentIngestButton({
  caseId,
  documentId,
  label = "Run ingest",
  disabled = false,
}: {
  caseId: string;
  documentId: string;
  label?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (disabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/cases/${caseId}/documents/${documentId}/ingest`,
        {
          method: "POST",
        }
      );

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Ingest failed");
      }

      router.refresh();
    } catch (ingestError) {
      setError(
        ingestError instanceof Error ? ingestError.message : "Ingest failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="outline"
        size="sm"
        loading={loading}
        disabled={disabled}
        onClick={handleClick}
      >
        {!loading && <ScanSearch className="h-4 w-4" />}
        {label}
      </Button>
      {error && <div className="text-xs text-destructive max-w-48 text-right">{error}</div>}
    </div>
  );
}
