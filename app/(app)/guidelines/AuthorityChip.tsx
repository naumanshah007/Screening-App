import { CircleCheck, FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GuidelineAuthority } from "@/lib/clinical-rules/current-guidelines";

/**
 * Authority is derived from rule-set activations at request time, so this chip
 * changes on its own when the governed engine is promoted. Nothing here is
 * hard-coded to "legacy" or "canonical".
 */
export function AuthorityChip({
  authority,
  className,
}: {
  authority: GuidelineAuthority;
  className?: string;
}) {
  const live = authority.decidesRecommendations;
  const Icon = live ? CircleCheck : FlaskConical;
  return (
    <span
      title={authority.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        live
          ? "border-success/30 bg-success/10 text-foreground"
          : "border-info/30 bg-info/10 text-foreground",
        className
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", live ? "text-success" : "text-info")}
        aria-hidden
      />
      {authority.label}
    </span>
  );
}
