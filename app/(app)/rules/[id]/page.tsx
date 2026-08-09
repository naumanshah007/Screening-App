import Link from "next/link";

import { PageShell } from "@/components/system";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Badge, ServiceLineBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { canManageCaseRuleReleases } from "@/lib/cases/rule-governance";
import {
  describeCaseRuleDefinition,
  formatCaseRuleReleaseDefinitionJson,
  parseCaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";
import { runCaseRuleRegression } from "@/lib/cases/rule-regression";
import { getCaseRuleSetReleaseById } from "@/lib/cases/rule-releases";
import { isFeatureEnabled } from "@/lib/features";
import { formatDateTime } from "@/lib/utils";

import { RuleReleaseActionButton } from "../RuleReleaseActionButton";
import { RuleCardEditor } from "@/components/rules/RuleCardEditor";

export default async function CaseRuleReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!canManageCaseRuleReleases(user?.role)) {
    redirect("/dashboard");
  }

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
  const publishDisabledReason = release.isActive
    ? "This release is already active"
    : !release.reviewedAt
      ? "Review is required before publish"
      : regression.failed > 0
        ? "Regression suite must pass before publish"
      : undefined;

  return (
    <PageShell>
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
              <div className="text-muted-foreground">Published</div>
              <div className="font-medium text-foreground">
                {release.publishedAt
                  ? `${release.publishedBy?.name ?? release.publishedBy?.email ?? "Unknown"} · ${formatDateTime(release.publishedAt)}`
                  : "Not published"}
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

          <div className="flex flex-wrap items-start gap-3">
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isEditableDraft ? "Edit Draft" : "Release Definition"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditableDraft ? (
              <RuleCardEditor
                releaseId={release.id}
                initialName={release.name}
                initialDescription={release.description ?? ""}
                initialChangeNotes={release.changeNotes ?? ""}
                baseDefinition={definition}
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Active and published releases are read-only. Create a new draft to make further policy changes.
                </div>
                <pre className="overflow-x-auto rounded-xl border border-border bg-slate-950 p-4 text-xs text-slate-100">
                  {formatCaseRuleReleaseDefinitionJson(definition)}
                </pre>
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
    </PageShell>
  );
}
