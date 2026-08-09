import { createHash } from "node:crypto";

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)])
    );
  }

  return value;
}

export function deterministicJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

export function calculateRuleSnapshotChecksum(value: unknown): string {
  return createHash("sha256").update(deterministicJson(value)).digest("hex");
}
