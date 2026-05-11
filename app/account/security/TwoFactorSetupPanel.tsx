"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TwoFactorSetupPanel({
  required,
  enabled,
}: {
  required: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingEnable, setLoadingEnable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepareSetup() {
    setLoadingSetup(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account/2fa/setup", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        qrDataUrl?: string;
        manualEntryKey?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to prepare authenticator setup");
      }

      setQrDataUrl(payload.qrDataUrl ?? null);
      setManualEntryKey(payload.manualEntryKey ?? null);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Unable to prepare authenticator setup"
      );
    } finally {
      setLoadingSetup(false);
    }
  }

  async function enableTwoFactor() {
    setLoadingEnable(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account/2fa/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: verificationCode,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to enable authenticator access");
      }

      setMessage(
        payload.message ??
          "Authenticator setup complete. The account now satisfies two-factor requirements."
      );
      setVerificationCode("");
      router.refresh();
    } catch (enableError) {
      setError(
        enableError instanceof Error
          ? enableError.message
          : "Unable to enable authenticator access"
      );
    } finally {
      setLoadingEnable(false);
    }
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <Badge variant="low">Authenticator active</Badge>
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-4 text-sm text-foreground">
          Two-factor authentication is already enabled for this account. You will be asked for a
          6-digit authenticator code whenever you sign in.
        </div>
        {required && (
          <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
            This role requires 2FA before grading, administration, or restricted-integration work
            can continue.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={required ? "high" : "info"}>
          {required ? "Required for this role" : "Recommended"}
        </Badge>
        <Badge variant="default">Authenticator app</Badge>
      </div>

      <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        {required
          ? "This role must use an authenticator app before the rest of the platform can be used."
          : "You can strengthen this account by adding an authenticator app now."}
      </div>

      {!qrDataUrl ? (
        <Button type="button" loading={loadingSetup} onClick={prepareSetup}>
          Prepare authenticator setup
        </Button>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-muted/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Authenticator QR code"
                className="mx-auto h-[220px] w-[220px]"
              />
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">How to set this up</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Open Microsoft Authenticator, Google Authenticator, or a compatible app.</li>
                  <li>Scan the QR code, or type the manual key if scanning is not available.</li>
                  <li>Enter the 6-digit code from the app to finish setup.</li>
                </ol>
              </div>
              <div className="rounded-xl border border-slate-200 bg-muted/40 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Manual entry key
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {manualEntryKey}
                </div>
              </div>
              <Input
                label="Authenticator code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <Button
                type="button"
                loading={loadingEnable}
                disabled={loadingEnable || verificationCode.trim().length < 6}
                onClick={enableTwoFactor}
              >
                Enable authenticator access
              </Button>
            </div>
          </div>
        </div>
      )}

      {message && <div className="text-xs text-success">{message}</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
