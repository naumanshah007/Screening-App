"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function RuleReleaseEditForm({
  releaseId,
  initialName,
  initialDescription,
  initialChangeNotes,
  initialDefinitionJson,
}: {
  releaseId: string;
  initialName: string;
  initialDescription: string;
  initialChangeNotes: string;
  initialDefinitionJson: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [changeNotes, setChangeNotes] = useState(initialChangeNotes);
  const [definitionJson, setDefinitionJson] = useState(initialDefinitionJson);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/case-rules/${releaseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          changeNotes,
          definitionJson,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save release draft");
      }

      setMessage("Draft saved. Review state has been cleared until it is re-reviewed.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save release draft"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="Release name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Colposcopy Draft 2026.03.21.colpo.2"
      />
      <Textarea
        label="Description"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Describe what this release changes."
      />
      <Textarea
        label="Change notes"
        rows={4}
        value={changeNotes}
        onChange={(event) => setChangeNotes(event.target.value)}
        placeholder="Summarise the rule, threshold, or policy changes for reviewers."
        hint="Saving a draft clears the existing review stamp so the release must be reviewed again before activation."
      />
      <Textarea
        label="Definition JSON"
        rows={24}
        value={definitionJson}
        onChange={(event) => setDefinitionJson(event.target.value)}
        placeholder='{"releaseKind":"coded-enterprise-v2"}'
        className="font-mono text-xs"
        hint="The JSON must match the structured enterprise case-rule schema for this service."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="success" loading={loading}>
          Save draft
        </Button>
      </div>

      {message && <div className="text-sm text-success">{message}</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
