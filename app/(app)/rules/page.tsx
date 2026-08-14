import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, ShieldCheck, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { PageShell, PageHeader, Panel, DrawerDisclosure } from "@/components/system";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { Badge, ServiceLineBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { canManageCaseRuleReleases } from "@/lib/cases/rule-governance";
import {
  describeCaseRuleDefinition,
  parseCaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";
import { runCaseRuleRegression } from "@/lib/cases/rule-regression";
import { listCaseRuleSetReleases } from "@/lib/cases/rule-releases";
import { isFeatureEnabled } from "@/lib/features";
import { formatDateTime } from "@/lib/utils";
import { CreateCaseRuleDraftButton } from "./CreateCaseRuleDraftButton";
import { RuleReleaseActionButton } from "./RuleReleaseActionButton";

export default async function RulesPage() {
  if (!isFeatureEnabled("casesV2")) {
    redirect("/dashboard");
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!canManageCaseRuleReleases(user?.role)) {
    redirect("/dashboard");
  }

  const releases = await listCaseRuleSetReleases();
  const currentRuleset = await getCurrentGovernedRuleset().catch(() => null);
  // Draft authoring follows the existing page entitlement — no new permission.
  const canAuthorDrafts = user?.role === "ADMIN" || user?.role === "INTEGRATION_ADMIN";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Service operations"
        title="Local Referral & Booking Rules"
        description="Local colposcopy and gynaecology triage and booking rules that support service operations."
      />

      {/*
        States the relationship explicitly.

        These COL/GYN rules sit beside the national governed screening rules, and
        a page of authoritative-looking rule releases with no context invited the
        reading that they were a competing clinical authority. They are an
        operational overlay; the governed screening rules are named here so the
        distinction is unmissable.
      */}
      <Panel className="px-4 py-3.5">
        <p className="text-sm font-semibold text-foreground">Operational service overlay</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These local triage and booking rules support service operations. They do
          not replace the current governed NCSP screening rules.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Current governed screening rules
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {currentRuleset?.displayVersion ?? "Not configured"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Local operational overlay
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">
              Colposcopy / gynaecology service rules
            </dd>
          </div>
        </dl>
      </Panel>

      {/* Draft creation is an authoring action, not part of the normal view. */}
      {canAuthorDrafts && (
        <DrawerDisclosure title="Advanced actions" caption="Create a new service rule draft">
          <div className="flex flex-wrap gap-2">
            <CreateCaseRuleDraftButton serviceLine="COLPOSCOPY" label="New colposcopy draft" />
            <CreateCaseRuleDraftButton serviceLine="GYNAECOLOGY" label="New gynaecology draft" />
          </div>
        </DrawerDisclosure>
      )}

      {releases.length === 0 ? (
        <Card>
          <EmptyState
            icon={GitBranch}
            title="No case rule releases"
            description="Create the first enterprise case-rule release to start deterministic governance."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const definition = parseCaseRuleReleaseDefinition({
              serviceLine: release.serviceLine,
              definitionJson: release.definitionJson,
            });
            const regression = runCaseRuleRegression({
              serviceLine: release.serviceLine,
              definition,
            });
            const publishDisabledReason = release.isActive
              ? "This release is already active"
              : !release.reviewedAt
                ? "Review is required before publish"
                : regression.failed > 0
                  ? "Regression suite must pass before publish"
                : undefined;

            return (
              <Card key={release.id}>
                <CardHeader>
                  <div>
                    <CardTitle>{release.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {release.description ?? "No description provided"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ServiceLineBadge serviceLine={release.serviceLine} />
                    <Badge variant="info">v{release.version}</Badge>
                    <Badge variant={release.isActive ? "low" : "default"}>
                      {release.isActive ? "Active" : "Draft"}
                    </Badge>
                    {release.reviewedAt && (
                      <Badge variant="high">Reviewed</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Schema version</div>
                      <div className="font-medium text-foreground">
                        {release.schemaVersion}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reviewed</div>
                      <div className="font-medium text-foreground">
                        {release.reviewedAt
                          ? `${release.reviewedBy?.name ?? release.reviewedBy?.email ?? "Unknown"} · ${formatDateTime(release.reviewedAt)}`
                          : "Pending review"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Published</div>
                      <div className="font-medium text-foreground">
                        {release.publishedAt
                          ? `${release.publishedBy?.name ?? release.publishedBy?.email ?? "Unknown"} · ${formatDateTime(release.publishedAt)}`
                          : "Not published"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Regression</div>
                      <div className="font-medium text-foreground">
                        {regression.passed}/{regression.total} fixtures passing
                      </div>
                    </div>
                  </div>

                  {release.changeNotes && (
                    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {release.changeNotes}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Rule Codes
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {definition.rules.length > 0 ? (
                          definition.rules.map((rule) => (
                            <Badge key={rule.code} variant="default">
                              {rule.code}
                            </Badge>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No codes declared
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Default Outcome
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div>
                          <Badge variant="info">
                            {definition.defaultRecommendation.priority}
                          </Badge>
                        </div>
                        <div>{definition.defaultRecommendation.category}</div>
                        <div>{definition.defaultRecommendation.outcome}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Source Of Truth
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {definition.sourceOfTruth.length > 0 ? (
                          definition.sourceOfTruth.map((source) => (
                            <div key={source}>• {source}</div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No source metadata declared
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Regression Suite
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <Badge variant={regression.failed === 0 ? "low" : "urgent"}>
                          {regression.failed === 0 ? "Passing" : `${regression.failed} failing`}
                        </Badge>
                        <div>{regression.passed} of {regression.total} fixtures matched expected outcomes</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Release Notes
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {definition.notes.length > 0 ? (
                          definition.notes.map((note) => (
                            <div key={note}>• {note}</div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No release notes declared
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">
                        Rule Logic Summary
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                        {definition.rules.map((rule) => (
                          <div key={rule.code} className="rounded-lg border border-border bg-muted/40 px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default">{rule.code}</Badge>
                              <span className="font-medium text-foreground">{rule.title}</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{rule.impact}</div>
                            <div className="mt-2 text-muted-foreground">
                              {describeCaseRuleDefinition(rule)}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="info">
                                {rule.recommendation.priority}
                              </Badge>
                              <span>{rule.recommendation.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start gap-3">
                    <Link
                      href={`/rules/${release.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/40"
                    >
                      {release.isActive ? "Open release" : "Edit draft"}
                    </Link>
                    <RuleReleaseActionButton
                      releaseId={release.id}
                      action="review"
                      label={release.reviewedAt ? "Re-review release" : "Mark reviewed"}
                    />
                    <RuleReleaseActionButton
                      releaseId={release.id}
                      action="publish"
                      label={release.isActive ? "Published" : "Publish release"}
                      variant="success"
                      disabled={Boolean(publishDisabledReason)}
                      disabledReason={publishDisabledReason}
                    />
                    {release.isActive && (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        Used for new deterministic grading decisions
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
