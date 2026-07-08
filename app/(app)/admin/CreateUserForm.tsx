"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Wand2, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";

const roleOptions = [
  { value: "GP", label: "GP", help: "Refers patients and enters cervical results; sees their own workspace only." },
  { value: "COORDINATOR", label: "Coordinator", help: "Pulls cases and manages the referral queue." },
  { value: "SMO_REVIEWER", label: "SMO Reviewer", help: "Senior sign-off on colposcopy/gynaecology grading." },
  { value: "COLPOSCOPIST", label: "Colposcopist", help: "Reviews and confirms colposcopy cases." },
  { value: "COLPO_CNS", label: "Colposcopy CNS", help: "Colposcopy clinical nurse specialist review." },
  { value: "GYNAE_GRADER", label: "Gynaecology Grader", help: "Grades gynaecology referrals." },
  { value: "INTEGRATION_ADMIN", label: "Integration Admin", help: "Manages integrations, runtime and security — no user management." },
  { value: "ADMIN", label: "Admin", help: "Full platform administration, including user management." },
] as const;

const PRACTICE_LINKED_ROLES = new Set(["GP", "COORDINATOR"]);

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

export function CreateUserForm({
  practices,
}: {
  practices: Array<{ id: string; name: string; hpiNumber: string | null }>;
}) {
  const router = useRouter();
  const { copy } = useCopyToClipboard("Temporary password copied");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("GP");
  const [gpPracticeId, setGpPracticeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const roleHelp = roleOptions.find((o) => o.value === role)?.help;
  const showPractice = PRACTICE_LINKED_ROLES.has(role);

  function reset() {
    setName("");
    setEmail("");
    setRole("GP");
    setGpPracticeId("");
    setPassword("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          gpPracticeId: showPractice ? gpPracticeId || null : null,
          password,
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to create user");
      toast.success(payload.message ?? `User ${email} created.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Create an account for a clinician, coordinator, or integration user. The initial password is
        temporary — the user sets a personal password at first sign-in.
      </p>
      <Button type="button" icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Add user
      </Button>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add user" subtitle="Create a new account" width="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Example User"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@cs.nz"
            required
          />
          <div>
            <Select
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof roleOptions)[number]["value"])}
              options={roleOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
            {roleHelp && <p className="mt-1 text-xs text-muted-foreground">{roleHelp}</p>}
          </div>

          {showPractice && (
            <Select
              label="Linked practice"
              value={gpPracticeId}
              onChange={(e) => setGpPracticeId(e.target.value)}
              placeholder="No linked practice"
              options={practices.map((p) => ({
                value: p.id,
                label: p.hpiNumber ? `${p.name} (${p.hpiNumber})` : p.name,
              }))}
            />
          )}

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Temporary password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  hint="The user replaces it at first sign-in."
                  required
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Wand2 className="h-3.5 w-3.5" />}
                onClick={() => setPassword(generatePassword())}
              >
                Generate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Copy className="h-3.5 w-3.5" />}
                disabled={!password}
                onClick={() => copy(password)}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create user
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
