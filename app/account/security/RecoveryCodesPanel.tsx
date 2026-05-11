"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function RecoveryCodesPanel({
  recoveryCodeCount,
}: {
  recoveryCodeCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  async function generateCodes() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account/2fa/recovery-codes", {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        recoveryCodes?: string[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate recovery codes");
      }

      setGeneratedCodes(payload.recoveryCodes ?? []);
      setMessage(
        payload.message ??
          "Recovery codes generated. Store them somewhere safe; each code works once."
      );
      router.refresh();
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate recovery codes"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={recoveryCodeCount > 0 ? "low" : "high"}>
          {recoveryCodeCount > 0
            ? `${recoveryCodeCount} recovery code${recoveryCodeCount === 1 ? "" : "s"} stored`
            : "No recovery codes stored"}
        </Badge>
        <Badge variant="default">One-time backup codes</Badge>
      </div>

      <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Recovery codes are for emergencies, such as losing access to your authenticator app. Each
        code can be used once instead of the 6-digit authenticator code.
      </div>

      <Button type="button" loading={loading} variant="outline" onClick={generateCodes}>
        {recoveryCodeCount > 0 ? "Regenerate recovery codes" : "Generate recovery codes"}
      </Button>

      {generatedCodes.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4">
          <div className="text-sm font-medium text-warn">
            Save these codes now
          </div>
          <p className="mt-1 text-xs text-foreground">
            They are shown only once. Regenerating codes invalidates any previous set.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {generatedCodes.map((code) => (
              <div
                key={code}
                className="rounded-lg border border-warn/30 bg-white px-3 py-2 font-mono text-sm text-foreground"
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <div className="text-xs text-success">{message}</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
