"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Power, FlaskConical } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  isDemoAccount: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  passwordChangeRequired: boolean;
  passwordChangedAt: string | null;
  lockedUntil: string | null;
};

type ResetTarget = { user: AdminUserRow; mode: "custom" | "demo" };

function passwordStatus(user: AdminUserRow): {
  label: string;
  variant: "low" | "high" | "medium";
} {
  if (user.passwordChangeRequired) {
    return { label: "Change required", variant: "high" };
  }
  if (!user.passwordChangedAt) {
    return { label: "Never set by user", variant: "medium" };
  }
  return { label: "Set", variant: "low" };
}

export function AdminUsersClient({
  users,
  demoMode,
  currentUserId,
}: {
  users: AdminUserRow[];
  demoMode: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requireChange, setRequireChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function closeDialog() {
    setResetTarget(null);
    setNewPassword("");
    setConfirmPassword("");
    setRequireChange(true);
    setError("");
  }

  async function call(url: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "The request failed.");
        return false;
      }
      setNotice(payload?.message ?? "Done.");
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    if (!resetTarget) return;

    if (resetTarget.mode === "demo") {
      if (await call(`/api/admin/users/${resetTarget.user.id}/demo-password`, {})) {
        closeDialog();
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    const ok = await call(`/api/admin/users/${resetTarget.user.id}/password`, {
      password: newPassword,
      requirePasswordChange: requireChange,
    });
    if (ok) closeDialog();
  }

  async function toggleEnabled(user: AdminUserRow) {
    await call(`/api/admin/users/${user.id}/status`, {
      isActive: !user.isActive,
    });
  }

  return (
    <div className="space-y-4">
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && !resetTarget && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-border bg-surface-subtle">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Password</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const status = passwordStatus(user);
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="align-middle">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {user.name ?? "—"}
                      </span>
                      {user.isDemoAccount && (
                        <Badge variant="medium" className="ml-2">
                          Demo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.role}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? "low" : "high"}>
                        {user.isActive ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.lastLoginAt
                        ? formatDate(new Date(user.lastLoginAt))
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(new Date(user.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            setResetTarget({ user, mode: "custom" })
                          }
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Reset password
                        </Button>
                        {demoMode && user.isDemoAccount && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              setResetTarget({ user, mode: "demo" })
                            }
                          >
                            <FlaskConical
                              className="mr-1 h-3.5 w-3.5"
                              aria-hidden
                            />
                            Reset to demo
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || isSelf}
                          title={
                            isSelf
                              ? "You cannot disable your own account"
                              : undefined
                          }
                          onClick={() => toggleEnabled(user)}
                        >
                          <Power className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {user.isActive ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-5">
              <div>
                <h2
                  id="reset-dialog-title"
                  className="text-base font-semibold text-foreground"
                >
                  {resetTarget.mode === "demo"
                    ? "Reset to demo password"
                    : "Reset password"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resetTarget.user.name ?? resetTarget.user.email}
                </p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              {resetTarget.mode === "demo" ? (
                <Alert variant="warning">
                  Reset this user&apos;s password to the shared demo password?
                  The account will remain immediately reusable for
                  demonstrations.
                </Alert>
              ) : (
                <>
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={requireChange}
                      onChange={(e) => setRequireChange(e.target.checked)}
                    />
                    <span>
                      Require password change at next login
                      <span className="block text-xs text-muted-foreground">
                        Recommended for real accounts — you know the value you
                        just set.
                      </span>
                    </span>
                  </label>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={closeDialog}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button onClick={submitReset} loading={busy}>
                  {resetTarget.mode === "demo"
                    ? "Reset to demo password"
                    : "Reset password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
