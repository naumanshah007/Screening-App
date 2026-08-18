import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Badge, ServiceLineBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import {
  canActivateCaseRuleReleases,
  canEditCaseRuleDrafts,
  canReviewCaseRuleReleases,
  canViewCaseRuleReleases,
} from "@/lib/cases/rule-governance";
import {
  describeCaseRuleDefinition,
  parseCaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";
import { runCaseRuleRegression } from "@/lib/cases/rule-regression";
import { getCaseRuleSetReleaseById, getActiveCaseRuleSetRelease } from "@/lib/cases/rule-releases";
import { getRuleVocabulary } from "@/lib/cases/rule-vocabulary";
import { diffRuleReleases } from "@/lib/cases/rule-diff";
import { isFeatureEnabled } from "@/lib/features";
import { formatDateTime } from "@/lib/utils";

import { RuleReleaseActionButton } from "../RuleReleaseActionButton";
import { RuleStudioEditor } from "@/components/rules/RuleStudioEditor";

export default async function CaseRuleReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!canViewCaseRuleReleases(user?.role)) {
    redirect("/dashboard");
  }
  const canEditDrafts = canEditCaseRuleDrafts(user?.role);
  const canReviewReleases = canReviewCaseRuleReleases(user?.role);
  const canActivateReleases = canActivateCaseRuleReleases(user?.role);

  const { id } = await params;
  const release = await getCaseRuleSetReleaseById(id);
  if (!release) {
    notFound();
  }

  const definition = parseCaseRuleReleaseDefinition({
    serviceLine: release.serviceLine,
    definitionJson: release.definitionJson,
  });
  const regression = runCaseRuleRegression({
    serviceLine: release.serviceLine,
    definition,
  });
  const isEditableDraft = !release.isActive && !release.publishedAt;
  const canEditThisDraft = isEditableDraft && canEditDrafts;
  const vocabulary = getRuleVocabulary(release.serviceLine);

  // Diff against the currently-active release (what would change on activation).
  const activeRelease = await getActiveCaseRuleSetRelease(release.serviceLine);
  const diff =
    activeRelease && activeRelease.id !== release.id
      ? diffRuleReleases(
          parseCaseRuleReleaseDefinition({
            serviceLine: activeRelease.serviceLine,
            definitionJson: activeRelease.definitionJson,
          }),
          definition
        )
      : null;
  const activateDisabledReason = release.isActive
    ? "This release is already active"
    : !release.reviewedAt
      ? "Clinical review is required before activation"
      : release.reviewedByUserId === user?.id
        ? "Activation must be completed by a different user than the reviewer"
      : regression.failed > 0
        ? "Regression suite must pass before activation"
      : undefined;
  const reviewDisabledReason = !isEditableDraft
    ? "Only editable drafts can be reviewed"
    : regression.failed > 0
      ? "Regression suite must pass before review"
      : undefined;
  const workflowSteps = [
    {
      label: "Draft",
      state: isEditableDraft ? "current" : "done",
    },
    {
      label: "Validate",
      state: regression.failed === 0 ? "done" : "blocked",
    },
    {
      label: "Review",
      state: release.isActive || release.reviewedAt ? "done" : "pending",
    },
    {
      label: "Active",
      state: release.isActive ? "done" : "pending",
    },
  ];

  return (
    <div className="page-aura p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/rules" className="text-sm text-brand-600 hover:underline">
          ← Rule releases
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm text-muted-foreground">{release.version}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {release.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {release.description ?? "No description provided"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ServiceLineBadge serviceLine={release.serviceLine} />
          <Badge variant="info">v{release.version}</Badge>
          <Badge variant={release.isActive ? "low" : "default"}>
            {release.isActive ? "Active" : "Draft"}
          </Badge>
          {release.reviewedAt && <Badge variant="high">Reviewed</Badge>}
          {!release.isActive && !release.reviewedAt && (
            <Badge variant="info">Needs review</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release Governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-muted-foreground">Schema version</div>
              <div className="font-medium text-foreground">{release.schemaVersion}</div>
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
              <div className="text-muted-foreground">Activated</div>
              <div className="font-medium text-foreground">
                {release.publishedAt
                  ? `${release.publishedBy?.name ?? release.publishedBy?.email ?? "Unknown"} · ${formatDateTime(release.publishedAt)}`
                  : release.isActive
                    ? "Baseline active"
                    : "Not activated"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Editability</div>
              <div className="font-medium text-foreground">
                {isEditableDraft ? "Draft is editable" : "Immutable release"}
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

          <div className="grid gap-3 md:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step.label}
                className="rounded-lg border border-border bg-muted/25 px-3 py-3"
              >
                <div className="text-xs text-muted-foreground">
                  Step {index + 1}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {step.label}
                  </span>
                  <Badge
                    variant={
                      step.state === "done"
                        ? "low"
                        : step.state === "blocked"
                          ? "urgent"
                          : step.state === "current"
                            ? "info"
                            : "default"
                    }
                  >
                    {step.state === "done"
                      ? "Complete"
                      : step.state === "blocked"
                        ? "Blocked"
                        : step.state === "current"
                          ? "Current"
                          : "Pending"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {canReviewReleases && isEditableDraft && !release.reviewedAt && (
              <RuleReleaseActionButton
                releaseId={release.id}
                action="review"
                label="Mark reviewed"
                disabled={Boolean(reviewDisabledReason)}
                disabledReason={reviewDisabledReason}
              />
            )}
            {canActivateReleases && !release.isActive && (
              <RuleReleaseActionButton
                releaseId={release.id}
                action="activate"
                label="Activate release"
                variant="primary"
                disabled={Boolean(activateDisabledReason)}
                disabledReason={activateDisabledReason}
                confirmMessage="Activate this rule release for new deterministic grading decisions?"
              />
            )}
            {release.isActive && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-foreground">
                <ShieldCheck className="h-4 w-4" />
                Used for new deterministic grading decisions
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {diff && (
        <Card>
          <CardHeader>
            <CardTitle>Changes vs Active Release</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!diff.hasChanges ? (
              <div className="text-muted-foreground">Identical to the active release.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="low">{diff.added.length} added</Badge>
                  <Badge variant="urgent">{diff.removed.length} removed</Badge>
                  <Badge variant="high">{diff.changed.length} changed</Badge>
                  {diff.reordered && <Badge variant="info">reordered</Badge>}
                </div>
                {diff.added.map((e) => (
                  <div key={e.code} className="rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                    <Badge variant="low">Added</Badge> <span className="font-mono">{e.code}</span> — {e.title}
                  </div>
                ))}
                {diff.removed.map((e) => (
                  <div key={e.code} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <Badge variant="urgent">Removed</Badge> <span className="font-mono">{e.code}</span> — {e.title}
                  </div>
                ))}
                {diff.changed.map((e) => (
                  <div key={e.code} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div><Badge variant="high">Changed</Badge> <span className="font-mono">{e.code}</span> — {e.title}</div>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {e.changes.map((c) => (
                        <li key={c.field}>
                          <span className="font-medium text-foreground">{c.field}:</span>{" "}
                          <span className="line-through">{c.from}</span> → <span className="text-foreground font-medium">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
          <CardTitle>{canEditThisDraft ? "Edit Draft" : "Release Definition"}</CardTitle>
          </CardHeader>
          <CardContent>
            {canEditThisDraft ? (
              <RuleStudioEditor
                releaseId={release.id}
                factLabels={vocabulary.factLabels}
                thresholdLabels={vocabulary.thresholdLabels}
                initialName={release.name}
                initialDescription={release.description ?? ""}
                initialChangeNotes={release.changeNotes ?? ""}
                initialDefinition={definition}
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  {isEditableDraft
                    ? "This draft is read-only for your role. Admin users can edit drafts; clinical reviewers can review them after validation passes."
                    : "Active releases are read-only. Create a new draft to make further policy changes."}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>
                <Badge variant="info">{definition.defaultRecommendation.priority}</Badge>
              </div>
              <div>{definition.defaultRecommendation.category}</div>
              <div>{definition.defaultRecommendation.outcome}</div>
              <div className="text-muted-foreground">
                {definition.defaultRecommendation.rationale}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source Of Truth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {definition.sourceOfTruth.length > 0 ? (
                definition.sourceOfTruth.map((source) => <div key={source}>• {source}</div>)
              ) : (
                <div className="text-muted-foreground">No source metadata declared</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rule Logic Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {definition.rules.length > 0 ? (
                definition.rules.map((rule) => (
                  <div
                    key={rule.code}
                    className="rounded-lg border border-border bg-muted/40 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{rule.code}</Badge>
                      <span className="font-medium text-foreground">{rule.title}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">{rule.impact}</div>
                    <div className="mt-2 text-muted-foreground">
                      {describeCaseRuleDefinition(rule)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="info">{rule.recommendation.priority}</Badge>
                      <span>{rule.recommendation.category}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No rules declared</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regression Fixtures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={regression.failed === 0 ? "low" : "urgent"}>
                  {regression.failed === 0 ? "Passing" : `${regression.failed} failing`}
                </Badge>
                <span>
                  {regression.passed} of {regression.total} source-derived fixtures are passing.
                </span>
              </div>
              {regression.fixtures.map((fixture) => (
                <div
                  key={fixture.id}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={fixture.passed ? "low" : "urgent"}>
                      {fixture.passed ? "Pass" : "Fail"}
                    </Badge>
                    <span className="font-medium text-foreground">{fixture.title}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{fixture.sourceNote}</div>
                  {!fixture.passed && (
                    <div className="mt-2 text-muted-foreground">
                      Expected {fixture.expected.priority} / {fixture.expected.category} /{" "}
                      {fixture.expected.matchedRuleCode ?? "default"}, got{" "}
                      {fixture.actual.priority} / {fixture.actual.category} /{" "}
                      {fixture.actual.matchedRuleCode ?? "default"}.
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
