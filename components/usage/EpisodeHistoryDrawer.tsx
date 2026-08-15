"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import {
  DetailDrawer,
  DrawerDisclosure,
  DrawerFields,
  DrawerSection,
  Timeline,
} from "@/components/system";
import { Badge } from "@/components/ui/badge";
import type { EpisodeHistory } from "@/lib/usage/usage-activity";
import { formatAppDate, formatAppDateTime } from "@/lib/usage/usage-date-range";

const subscribeToDocument = () => () => undefined;

export function EpisodeHistoryDrawer({ history }: { history: EpisodeHistory | null }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    subscribeToDocument,
    () => true,
    () => false
  );
  if (!mounted) return null;

  return createPortal(
    <DetailDrawer
      open={Boolean(history)}
      onClose={() => router.back()}
      title="Episode history"
      subtitle={history?.episodeReference}
      width="xl"
    >
      {history ? (
        <>
          <DrawerSection title="Episode">
            <DrawerFields
              fields={[
                { label: "Reference", value: history.episodeReference },
                { label: "Source", value: history.sourceFacility ?? "Not recorded" },
                { label: "Test type", value: history.testType ?? "Not recorded" },
                { label: "Collected", value: formatAppDate(history.collectedOn) },
              ]}
            />
          </DrawerSection>
          <DrawerSection title="Recorded activity">
            <Timeline
              events={history.events.map((event) => ({
                ...event,
                timestamp: formatAppDateTime(event.timestamp),
              }))}
            />
          </DrawerSection>
          <DrawerDisclosure
            title="Evaluation history"
            caption="Earlier evaluations remain preserved; a later evaluation does not replace them."
          >
            {history.evaluations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No linked evaluation was recorded.</p>
            ) : (
              <div className="space-y-2">
                {history.evaluations.map((evaluation, index) => (
                  <div key={evaluation.id} className="rounded-lg border border-border bg-surface-raised p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Evaluation {index + 1}
                        </span>
                        <Badge variant={evaluation.previousEvaluationId ? "info" : "default"}>
                          {evaluation.previousEvaluationId ? "Linked successor" : "Initial"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatAppDateTime(evaluation.evaluatedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ruleset {evaluation.rulesetVersion} · {evaluation.evaluationMode.replaceAll("_", " ").toLowerCase()}
                    </p>
                    {evaluation.regradeReason && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {evaluation.regradeReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DrawerDisclosure>
        </>
      ) : null}
    </DetailDrawer>,
    document.body
  );
}
