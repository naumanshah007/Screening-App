"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Copy, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import { ManagerShell } from "@/components/admin/ManagerShell";
import { useConfirm } from "@/lib/hooks/useConfirm";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
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
    return { label: "Locked", variant: "urgent" as const };
  }
  if (user.failedAttempts > 0) {
    return {
      label: `${user.failedAttempts} failed attempt${user.failedAttempts === 1 ? "" : "s"}`,
      variant: "high" as const,
    };
  }
  return { label: "Normal", variant: "low" as const };
}

function initialsOf(user: AdminUserRecord) {
  const source = user.name ?? user.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const specials = "!@#$%&*";
  const rand = new Uint32Array(14);
  crypto.getRandomValues(rand);
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[rand[i] % chars.length];
  out += specials[rand[12] % specials.length];
  out += String(10 + (rand[13] % 89));
  return out;
}

function isLocked(user: AdminUserRecord) {
  return Boolean((user.lockedUntil && user.lockedUntil.getTime() > Date.now()) || user.failedAttempts > 0);
}

// ── Compact list row ────────────────────────────────────────────────────────
function UserListRow({
  user,
  isSelf,
  onManage,
}: {
  user: AdminUserRecord;
  isSelf: boolean;
  onManage: () => void;
}) {
  const state = accountState(user);
  const twoFactorRequired = requiresTwoFactorForRole(user.role);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-600 to-navy-800 text-xs font-semibold text-white">
        {initialsOf(user)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{user.name ?? user.email}</span>
          {isSelf && <Badge variant="info">You</Badge>}
        </div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
        <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
        <Badge variant={state.variant}>{state.label}</Badge>
        {twoFactorRequired && !user.twoFAEnabled && <Badge variant="urgent">2FA gap</Badge>}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onManage} className="flex-shrink-0">
        Manage
      </Button>
    </div>
  );
}

// ── Slide-over editor ───────────────────────────────────────────────────────
function UserEditor({
  user,
  isSelf,
  confirm,
  onClose,
}: {
  user: AdminUserRecord;
  isSelf: boolean;
  confirm: (o: { title?: string; description: string; confirmLabel?: string; variant?: "danger" | "primary" }) => Promise<boolean>;
  onClose: () => void;
}) {
  const router = useRouter();
  const { copy } = useCopyToClipboard("Temporary password copied");
  const [role, setRole] = useState(user.role);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const state = accountState(user);
  const passwordLifecycle = getPasswordLifecycleSummary(user);
  const twoFactorRequired = requiresTwoFactorForRole(user.role);

  async function call(url: string, method: string, body?: unknown, successFallback = "Done.") {
    setLoading(true);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Request failed");
      toast.success(payload.message ?? successFallback);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveRole() {
    if (isSelf && user.role === "ADMIN" && role !== "ADMIN") {
      toast.error("You cannot remove your own admin access.");
      return;
    }
    const touchingAdmin = role === "ADMIN" || user.role === "ADMIN";
    if (touchingAdmin) {
      const ok = await confirm({
        title: "Change admin access?",
        description:
          role === "ADMIN"
            ? `Grant full ADMIN access to ${user.name ?? user.email}?`
            : `Remove ADMIN access from ${user.name ?? user.email}?`,
        confirmLabel: "Change role",
      });
      if (!ok) return;
    }
    await call(`/api/admin/users/${user.id}`, "PATCH", { role }, "Role updated.");
  }

  async function clearLock() {
    await call(`/api/admin/users/${user.id}`, "PATCH", { unlockAccount: true }, "Lock cleared.");
  }

  async function resetPassword() {
    const ok = await confirm({
      title: "Reset password?",
      description: `Set a temporary password for ${user.name ?? user.email}? They must set a personal password at next sign-in.`,
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    const done = await call(
      `/api/admin/users/${user.id}/password`,
      "POST",
      { password: temporaryPassword },
      "Password reset."
    );
    if (done) setTemporaryPassword("");
  }

  async function resetTwoFactor() {
    const ok = await confirm({
      title: "Reset 2FA?",
      description: `Remove the current authenticator for ${user.name ?? user.email}? They will re-enrol at next sign-in.`,
      confirmLabel: "Reset 2FA",
    });
    if (!ok) return;
    await call(`/api/admin/users/${user.id}/2fa/reset`, "POST", undefined, "2FA reset.");
  }

  return (
    <div className="space-y-5">
      {/* Status badges */}
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
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div><span className="font-medium">Practice:</span> {user.gpPractice?.name ?? "None"}</div>
        <div><span className="font-medium">Last login:</span> {user.lastLoginAt ? user.lastLoginAt.toLocaleString("en-NZ") : "Never"}</div>
        <div><span className="font-medium">Lock expires:</span> {user.lockedUntil ? user.lockedUntil.toLocaleString("en-NZ") : "Not locked"}</div>
        <div><span className="font-medium">Password rotation:</span> {user.passwordExpiresAt ? user.passwordExpiresAt.toLocaleDateString("en-NZ") : "After first personal password"}</div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        {passwordLifecycle.detail}
      </div>

      {/* Role */}
      <div className="space-y-2">
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof user.role)}
          options={roleOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" loading={loading} disabled={loading || role === user.role} onClick={saveRole}>
            Save role
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={loading || !isLocked(user)} onClick={clearLock}>
            Clear lock
          </Button>
        </div>
      </div>

      {/* Temporary password */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Temporary password"
              type="text"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="At least 8 characters"
              hint="User must set a personal password at next sign-in. This also clears any lockout."
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Wand2 className="h-3.5 w-3.5" />}
            onClick={() => setTemporaryPassword(generatePassword())}
          >
            Generate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Copy className="h-3.5 w-3.5" />}
            disabled={!temporaryPassword}
            onClick={() => copy(temporaryPassword)}
          >
            Copy
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={loading || temporaryPassword.trim().length < 8}
          onClick={resetPassword}
        >
          Reset password
        </Button>
      </div>

      {/* 2FA */}
      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {twoFactorRequired
            ? "This role requires an authenticator app for sensitive workflows."
            : "Authenticator setup is optional for this role."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={loading || (!user.twoFAEnabled && !twoFactorRequired)}
          onClick={resetTwoFactor}
        >
          Reset 2FA
        </Button>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
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
  const { confirm, ConfirmComponent } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(focusUserId ?? null);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  function matchesFilter(user: AdminUserRecord, id: string) {
    switch (id) {
      case "locked":
        return isLocked(user);
      case "2fa-gap":
        return requiresTwoFactorForRole(user.role) && !user.twoFAEnabled;
      case "admin":
        return user.role === "ADMIN";
      default:
        return true;
    }
  }

  return (
    <>
      <ManagerShell
        items={users}
        getKey={(u) => u.id}
        searchText={(u) => `${u.name ?? ""} ${u.email} ${u.role}`}
        searchPlaceholder="Search by name, email, or role"
        filters={[
          { id: "locked", label: "Locked / failed" },
          { id: "2fa-gap", label: "2FA gap" },
          { id: "admin", label: "Admins" },
        ]}
        matchesFilter={matchesFilter}
        emptyIcon={Users}
        emptyTitle="No users match"
        emptyDescription="Try a different search or filter."
        intro={
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Manage role-based access and recover locked accounts. Role changes take effect at the
            user&apos;s next session refresh. A temporary password forces a first-login reset and clears lockouts.
          </div>
        }
        renderRow={(u) => (
          <UserListRow
            user={u}
            isSelf={currentUserId === u.id}
            onManage={() => setSelectedId(u.id)}
          />
        )}
      />

      <SlideOver
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? selected?.email ?? "User"}
        subtitle={selected?.email}
        width="lg"
      >
        {selected && (
          <UserEditor
            key={selected.id}
            user={selected}
            isSelf={currentUserId === selected.id}
            confirm={confirm}
            onClose={() => setSelectedId(null)}
          />
        )}
      </SlideOver>

      {ConfirmComponent}
    </>
  );
}
