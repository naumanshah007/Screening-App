"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordChangeForm({
  requiresImmediateChange,
}: {
  requiresImmediateChange: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (newPassword.trim().length < 8) {
        throw new Error("New password must be at least 8 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match");
      }

      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update password");
      }

      setMessage(
        payload.message ??
          "Password updated. Sign in again with your new password."
      );
      await signOut({
        callbackUrl: "/login?passwordUpdated=1",
        redirect: true,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        {requiresImmediateChange
          ? "This account is using a temporary or expired password. Set a new personal password before continuing."
          : "Use this page to rotate your password. After saving, you will be asked to sign in again with the new password."}
      </div>

      <div className="grid gap-4">
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          hint="Use at least 8 characters."
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {message && <div className="text-xs text-success">{message}</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}

      <Button type="submit" loading={loading} size="lg" className="w-full">
        {requiresImmediateChange ? "Set new password" : "Update password"}
      </Button>
    </form>
  );
}
