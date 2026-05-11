"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

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

export function CreateUserForm({
  practices,
}: {
  practices: Array<{
    id: string;
    name: string;
    hpiNumber: string | null;
  }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("GP");
  const [gpPracticeId, setGpPracticeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          role,
          gpPracticeId: gpPracticeId || null,
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create user");
      }

      setMessage(payload.message ?? "User created.");
      setName("");
      setEmail("");
      setRole("GP");
      setGpPracticeId("");
      setPassword("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create user"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Create a new account here for a clinician, coordinator, or integration user. The initial
        password is temporary. On first sign-in, the user will be required to set a personal
        password before they can continue into the platform.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Dr. Example User"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@cs.nz"
          required
        />
        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number]["value"])}
          options={roleOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <Input
          label="Temporary password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Minimum 8 characters. The user will replace it at first sign-in."
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_auto] md:items-end">
        <Select
          label="Linked practice"
          value={gpPracticeId}
          onChange={(event) => setGpPracticeId(event.target.value)}
          placeholder="No linked practice"
          options={practices.map((practice) => ({
            value: practice.id,
            label: practice.hpiNumber ? `${practice.name} (${practice.hpiNumber})` : practice.name,
          }))}
        />
        <Button type="submit" loading={loading}>
          Create user
        </Button>
      </div>

      {message && <div className="text-xs text-success">{message}</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </form>
  );
}
