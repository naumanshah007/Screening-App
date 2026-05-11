"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function CreateSecurityIncidentButton({
  title,
  summary,
  severity,
  auditHref,
}: {
  title: string;
  summary: string;
  severity: "URGENT" | "HIGH" | "INFO";
  auditHref?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createIncident() {
    setLoading(true);
    setError(null);

    try {
      const query = auditHref?.split("?")[1];
      const params = new URLSearchParams(query ?? "");
      const response = await fetch("/api/admin/security-incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          summary,
          severity,
          sourcePreset: params.get("preset"),
          sourceEntity: params.get("entity"),
          sourceAction: params.get("action"),
          sourceUserId: params.get("userId"),
          auditFilterJson: query ? JSON.stringify(Object.fromEntries(params.entries())) : null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to open incident");
      }

      router.push("/admin#security-incidents");
      router.refresh();
    } catch (incidentError) {
      setError(
        incidentError instanceof Error
          ? incidentError.message
          : "Unable to open incident"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        loading={loading}
        onClick={createIncident}
      >
        Open incident
      </Button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
