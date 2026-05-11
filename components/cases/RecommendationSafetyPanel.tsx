import { TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatClinicalReferenceText } from "@/lib/utils";

type RecommendationSafetyPanelProps = {
  safetyOutcome?: string | null;
  missingInformation?: string[] | null;
  externalDependencies?: string[] | null;
  nextActions?: string[] | null;
};

export function RecommendationSafetyPanel({
  safetyOutcome,
  missingInformation,
  externalDependencies,
  nextActions,
}: RecommendationSafetyPanelProps) {
  const missing = missingInformation?.filter(Boolean) ?? [];
  const external = externalDependencies?.filter(Boolean) ?? [];
  const actions = nextActions?.filter(Boolean) ?? [];

  if (!safetyOutcome && missing.length === 0 && external.length === 0) {
    return null;
  }

  const hasExternal = external.length > 0 || safetyOutcome === "EXTERNAL_HISTORY_REQUIRED";

  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-warn" />
        <div className="font-semibold text-foreground text-sm">
          Safety stop
        </div>
        {safetyOutcome && <Badge variant="high">{safetyOutcome}</Badge>}
      </div>
      <p className="mt-3 text-sm text-foreground">
        {hasExternal
          ? "External history is required before this pathway can be completed. This may require NCSR or local clinical history review."
          : "The pathway cannot be safely completed because required information is missing. The system has not guessed this branch."}
      </p>
      {missing.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Missing facts
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((item) => (
              <Badge key={item} variant="default">
                {formatClinicalReferenceText(item)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {external.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            External dependencies
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {external.map((item) => (
              <Badge key={item} variant="info">
                {formatClinicalReferenceText(item)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {actions.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next action / owner
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {actions.map((action) => (
              <li key={action}>• {formatClinicalReferenceText(action)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
