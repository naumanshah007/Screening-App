"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SecurityResponseActions({
  userId,
  locked,
  hasFailedAttempts,
  twoFAEnabled,
  canManageUsers,
}: {
  userId: string;
  locked: boolean;
  hasFailedAttempts: boolean;
  twoFAEnabled: boolean;
  canManageUsers: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clearLock() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unlockAccount: true,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to clear lock");
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to clear lock"
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetTwoFactor() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/2fa/reset`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset 2FA");
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to reset 2FA"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!canManageUsers) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || (!locked && !hasFailedAttempts)}
          onClick={clearLock}
        >
          Clear lock
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || !twoFAEnabled}
          onClick={resetTwoFactor}
        >
          Reset 2FA
        </Button>
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
