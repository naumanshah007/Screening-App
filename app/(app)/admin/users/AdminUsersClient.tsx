"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Power,
  FlaskConical,
  ShieldCheck,
  Unlock,
  SlidersHorizontal,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  DetailDrawer,
  DrawerDisclosure,
  DrawerFields,
  DrawerSection,
} from "@/components/system";
import { formatDate } from "@/lib/utils";

/**
 * Roles an administrator may assign.
 *
 * Mirrors the `allowedRoles` list the PATCH route validates against. The server
 * remains the authority — an invalid value is rejected there — but offering
 * only assignable roles means the control cannot produce a request that is
 * guaranteed to fail.
 */
const ASSIGNABLE_ROLES = [
  "ADMIN",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COORDINATOR",
  "GP",
  "INTEGRATION_ADMIN",
] as const;

type AuditEntry = {
  id: string;
  action: string;
  at: string;
  actor: string;
  details: string | null;
};

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
  const [manageId, setManageId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requireChange, setRequireChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRole, setPendingRole] = useState("");
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [auditError, setAuditError] = useState("");

  // Read the row from `users` rather than holding a copy: after any action the
  // page revalidates, and a snapshot taken at open time would show the drawer
  // the pre-change state while the table behind it showed the new one.
  const manageUser = users.find((row) => row.id === manageId) ?? null;

  function closeDialog() {
    setResetTarget(null);
    setNewPassword("");
    setConfirmPassword("");
    setRequireChange(true);
    setError("");
  }

  async function call(url: string, body: unknown, method: "POST" | "PATCH" = "POST") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
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

  const loadAudit = useCallback(async (userId: string) => {
    setAudit(null);
    setAuditError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/audit`);
      const payload = (await response.json().catch(() => null)) as {
        entries?: AuditEntry[];
        error?: string;
      } | null;
      if (!response.ok) {
        setAuditError(payload?.error ?? "Unable to load account history.");
        return;
      }
      setAudit(payload?.entries ?? []);
    } catch {
      setAuditError("Unable to load account history.");
    }
  }, []);

  // Reload history whenever the drawer opens on a different account, and after
  // an action reports a result — an administrator who has just reset a password
  // should see that event without reopening the drawer.
  useEffect(() => {
    if (!manageId) return;
    void loadAudit(manageId);
  }, [manageId, notice, loadAudit]);

  function openManage(user: AdminUserRow) {
    setManageId(user.id);
    setPendingRole(user.role);
    setError("");
  }

  function closeManage() {
    setManageId(null);
    setAudit(null);
    setAuditError("");
    setError("");
  }

  async function submitRoleChange() {
    if (!manageUser || pendingRole === manageUser.role) return;
    await call(`/api/admin/users/${manageUser.id}`, { role: pendingRole }, "PATCH");
  }

  async function unlockAccount(user: AdminUserRow) {
    await call(`/api/admin/users/${user.id}`, { unlockAccount: true }, "PATCH");
  }

  async function resetTwoFactor(user: AdminUserRow) {
    await call(`/api/admin/users/${user.id}/2fa/reset`, {});
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
                      {/*
                        One entry point per row.

                        Three competing buttons on every row made the riskiest
                        action (disable) as prominent as the routine one, and
                        left no room for role change, unlock or account history.
                        Those all now live in a single drawer, grouped by what
                        they affect.
                      */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openManage(user)}
                        >
                          <SlidersHorizontal
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden
                          />
                          Manage
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

      <DetailDrawer
        open={Boolean(manageUser)}
        onClose={closeManage}
        title={manageUser?.name ?? manageUser?.email ?? "Manage user"}
        subtitle={manageUser?.email}
      >
        {manageUser && (
          <>
            {error && !resetTarget && <Alert variant="error">{error}</Alert>}

            <DrawerSection title="User">
              <DrawerFields
                fields={[
                  { label: "Name", value: manageUser.name ?? "—" },
                  { label: "Email", value: manageUser.email },
                  { label: "Current role", value: manageUser.role },
                  {
                    label: "Account type",
                    value: manageUser.isDemoAccount
                      ? "Demonstration account"
                      : "Standard account",
                  },
                  {
                    label: "Created",
                    value: formatDate(new Date(manageUser.createdAt)),
                  },
                  {
                    label: "Last login",
                    value: manageUser.lastLoginAt
                      ? formatDate(new Date(manageUser.lastLoginAt))
                      : "Never",
                  },
                ]}
              />
            </DrawerSection>

            <DrawerSection title="Access">
              <div className="space-y-3 rounded-lg border border-border/70 bg-surface-raised p-3">
                <div className="flex items-end gap-2">
                  <Select
                    label="Role"
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value)}
                    options={ASSIGNABLE_ROLES.map((role) => ({
                      value: role,
                      label: role,
                    }))}
                  />
                  <Button
                    size="sm"
                    disabled={busy || pendingRole === manageUser.role}
                    onClick={submitRoleChange}
                  >
                    Save role
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Changing a role changes what this person can see and do
                  immediately. The last remaining administrator cannot be
                  demoted.
                </p>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || manageUser.id === currentUserId}
                    title={
                      manageUser.id === currentUserId
                        ? "You cannot disable your own account"
                        : undefined
                    }
                    onClick={() => toggleEnabled(manageUser)}
                  >
                    <Power className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {manageUser.isActive ? "Disable account" : "Enable account"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {manageUser.isActive
                      ? "Disabling takes effect at the next sign-in attempt."
                      : "This account cannot sign in."}
                  </span>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="Security">
              <div className="space-y-3 rounded-lg border border-border/70 bg-surface-raised p-3">
                <DrawerFields
                  columns={1}
                  className="border-0 bg-transparent p-0"
                  fields={[
                    {
                      label: "Password",
                      value: `${passwordStatus(manageUser).label}${
                        manageUser.passwordChangedAt
                          ? ` · last changed ${formatDate(
                              new Date(manageUser.passwordChangedAt)
                            )}`
                          : ""
                      }`,
                    },
                    {
                      label: "Lockout",
                      value: manageUser.lockedUntil
                        ? `Locked until ${formatDate(
                            new Date(manageUser.lockedUntil)
                          )}`
                        : "Not locked",
                    },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      setResetTarget({ user: manageUser, mode: "custom" })
                    }
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Reset password
                  </Button>
                  {demoMode && manageUser.isDemoAccount && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        setResetTarget({ user: manageUser, mode: "demo" })
                      }
                    >
                      <FlaskConical className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Reset to demo password
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !manageUser.lockedUntil}
                    title={
                      manageUser.lockedUntil
                        ? undefined
                        : "This account is not locked"
                    }
                    onClick={() => unlockAccount(manageUser)}
                  >
                    <Unlock className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Unlock
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => resetTwoFactor(manageUser)}
                  >
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Reset authenticator
                  </Button>
                </div>
                {demoMode && manageUser.isDemoAccount && (
                  <p className="text-xs text-muted-foreground">
                    Two-factor enforcement is disabled for demonstration
                    accounts, so resetting the authenticator has no effect until
                    DEMO_MODE is off.
                  </p>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="Audit">
              {auditError && <Alert variant="error">{auditError}</Alert>}
              {!auditError && audit === null && (
                <p className="text-sm text-muted-foreground">
                  Loading account history…
                </p>
              )}
              {audit?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No account administration events have been recorded for this
                  user.
                </p>
              )}
              {audit && audit.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border/70 bg-surface-raised">
                  {audit.map((entry) => (
                    <li key={entry.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {entry.action.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(new Date(entry.at))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by {entry.actor}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {audit && audit.length > 0 && (
                <DrawerDisclosure
                  title="Recorded detail"
                  caption="The exact immutable payload, as stored in the audit log."
                >
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {audit
                      .map((entry) => `${entry.action}\n${entry.details ?? "—"}`)
                      .join("\n\n")}
                  </pre>
                </DrawerDisclosure>
              )}
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

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
