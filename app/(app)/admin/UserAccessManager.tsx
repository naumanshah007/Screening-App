"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { getPasswordLifecycleSummary } from "@/lib/auth/password-policy";
import { requiresTwoFactorForRole } from "@/lib/auth/two-factor-policy";
import type { AdminUserRecord } from "@/lib/admin/user-management";

const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "SMO_REVIEWER", label: "SMO Reviewer" },
  { value: "COLPOSCOPIST", label: "Colposcopist" },
  { value: "COLPO_CNS", label: "Colposcopy CNS" },
  { value: "GYNAE_GRADER", label: "Gynaecology Grader" },
  { value: "COORDINATOR", label: "Coordinator" },
  { value: "GP", label: "GP" },
  { value: "INTEGRATION_ADMIN", label: "Integration Admin" },
] as const;

function roleBadgeVariant(role: string) {
  switch (role) {
    case "ADMIN":
      return "urgent";
    case "SMO_REVIEWER":
      return "high";
    case "COLPO_CNS":
    case "COLPOSCOPIST":
    case "GYNAE_GRADER":
      return "info";
    case "INTEGRATION_ADMIN":
      return "medium";
    default:
      return "default";
  }
}

function accountState(user: AdminUserRecord) {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return {
      label: "Locked",
      variant: "urgent" as const,
    };
  }

  if (user.failedAttempts > 0) {
    return {
      label: `${user.failedAttempts} failed attempt${user.failedAttempts === 1 ? "" : "s"}`,
      variant: "high" as const,
    };
  }

  return {
    label: "Normal",
    variant: "low" as const,
  };
}

function UserRow({
  user,
  currentUserId,
  focused,
}: {
  user: AdminUserRecord;
  currentUserId?: string;
  focused?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = accountState(user);
  const passwordLifecycle = getPasswordLifecycleSummary(user);
  const twoFactorRequired = requiresTwoFactorForRole(user.role);
  const isSelf = currentUserId === user.id;

  async function saveAccess(update: { role?: string; unlockAccount?: boolean }) {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update access");
      }

      setMessage(payload.message ?? "Access updated.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update access"
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: temporaryPassword,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset password");
      }

      setTemporaryPassword("");
      setMessage(payload.message ?? "Password reset.");
      router.refresh();
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Unable to reset password"
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetTwoFactor() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/2fa/reset`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset 2FA");
      }

      setMessage(payload.message ?? "2FA reset.");
      router.refresh();
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Unable to reset 2FA"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      id={`user-${user.id}`}
      className={`rounded-xl border px-4 py-4 ${
        focused
          ? "border-brand-300 bg-brand-50/40 shadow-sm"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {focused && (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              Focused from security analytics
            </div>
          )}
          <div className="text-sm font-semibold text-foreground">
            {user.name ?? user.email}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
          <Badge variant={state.variant}>{state.label}</Badge>
          <Badge variant={twoFactorRequired ? "high" : "default"}>
            {twoFactorRequired ? "2FA required" : "2FA optional"}
          </Badge>
          <Badge variant={user.twoFAEnabled ? "low" : twoFactorRequired ? "urgent" : "default"}>
            {user.twoFAEnabled ? "2FA enabled" : twoFactorRequired ? "2FA not enrolled" : "2FA not set"}
          </Badge>
          <Badge variant={passwordLifecycle.variant}>{passwordLifecycle.label}</Badge>
          {isSelf && <Badge variant="info">Your account</Badge>}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
        <div>
          <span className="font-medium text-muted-foreground">Practice:</span>{" "}
          {user.gpPractice?.name ?? "No practice linked"}
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Last login:</span>{" "}
          {user.lastLoginAt ? user.lastLoginAt.toLocaleString("en-NZ") : "Never"}
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Lock expires:</span>{" "}
          {user.lockedUntil ? user.lockedUntil.toLocaleString("en-NZ") : "Not locked"}
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Password rotation:</span>{" "}
          {user.passwordExpiresAt
            ? user.passwordExpiresAt.toLocaleDateString("en-NZ")
            : "Set after first personal password"}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        <div>{passwordLifecycle.detail}</div>
        <div className="mt-1">
          {twoFactorRequired
            ? "This role also requires an authenticator app before sensitive workflows can continue."
            : "Authenticator setup is optional for this role, but it can still be enabled from Account security."}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,260px)_auto_auto] md:items-end">
        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof user.role)}
          options={roleOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <Button
          type="button"
          loading={loading}
          disabled={loading || role === user.role}
          onClick={() => saveAccess({ role })}
        >
          Save role
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !(user.lockedUntil || user.failedAttempts > 0)}
          onClick={() => saveAccess({ unlockAccount: true })}
        >
          Clear lock / reset attempts
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,260px)_auto_auto] md:items-end">
        <Input
          label="Temporary password"
          type="password"
          value={temporaryPassword}
          onChange={(event) => setTemporaryPassword(event.target.value)}
          placeholder="At least 8 characters"
          hint="This becomes a temporary password. The user must set a personal password at next sign-in."
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || temporaryPassword.trim().length < 8}
          onClick={resetPassword}
        >
          Reset password
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || (!user.twoFAEnabled && !twoFactorRequired)}
          onClick={resetTwoFactor}
        >
          Reset 2FA
        </Button>
      </div>

      {message && <div className="mt-3 text-xs text-success">{message}</div>}
      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
    </div>
  );
}

export function UserAccessManager({
  users,
  currentUserId,
  focusUserId,
}: {
  users: AdminUserRecord[];
  currentUserId?: string;
  focusUserId?: string;
}) {
  const orderedUsers = [
    ...users.filter((user) => user.id === focusUserId),
    ...users.filter((user) => user.id !== focusUserId),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Use this panel to manage role-based access and recover locked accounts. Role changes affect
        what the user can see and do after their next session refresh. Temporary passwords force a
        first-login password update and also clear existing lockouts.
      </div>

      {orderedUsers.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          currentUserId={currentUserId}
          focused={user.id === focusUserId}
        />
      ))}
    </div>
  );
}
