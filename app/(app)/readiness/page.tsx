import { redirect } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Flag,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { PageIntro } from "@/components/layout/PageIntro";
import { PageShell } from "@/components/system";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { getProductReadinessReport, type ProductReadinessOwner, type ProductReadinessState } from "@/lib/ops/product-readiness";
import { getWorkspaceContext } from "@/lib/workspace/context";

function stateVariant(state: ProductReadinessState) {
  switch (state) {
    case "ready":
      return "low" as const;
    case "warning":
      return "high" as const;
    case "blocked":
      return "urgent" as const;
  }
}

function ownerVariant(owner: ProductReadinessOwner) {
  switch (owner) {
    case "product":
      return "info" as const;
    case "shared":
      return "medium" as const;
    case "customer":
      return "default" as const;
  }
}

function ownerLabel(owner: ProductReadinessOwner) {
  switch (owner) {
    case "product":
      return "Product owned";
    case "shared":
      return "Shared";
    case "customer":
      return "Customer / external";
  }
}

export default async function ReadinessPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!isAuthorizedForRoute("/readiness", user?.role)) {
    redirect("/dashboard");
  }

  const workspace = getWorkspaceContext(user?.role, true);
  const report = await getProductReadinessReport();
  const readyCount = report.steps.filter((step) => step.state === "ready").length;
  const pendingCount = report.steps.filter((step) => step.state === "warning").length;
  const blockedCount = report.steps.filter((step) => step.state === "blocked").length;

  return (
    <PageShell>
        <PageIntro
          eyebrow={workspace.label}
          title="Launch Readiness"
          description="This page is the stop line for the product. It shows what is already finished in the repo, what still needs customer or environment input, and which try the project is currently in."
          actions={[
            { href: "/cases", label: "Open cases" },
            { href: "/admin", label: "Open admin" },
          ]}
        />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Current Try"
          value={report.currentTry.replace("_", " ")}
          subtext="Shortest path to closure"
          variant={report.currentTry === "TRY_1" ? "warning" : report.currentTry === "TRY_2" ? "default" : "success"}
          icon={<Flag className="h-5 w-5" />}
        />
        <StatCard
          label="Ready Steps"
          value={readyCount}
          subtext="Already closed"
          variant="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Pending Steps"
          value={pendingCount}
          subtext="Needs shared follow-through"
          variant="warning"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          label="Blocked Steps"
          value={blockedCount}
          subtext="External dependency"
          variant={blockedCount > 0 ? "urgent" : "default"}
          icon={<TriangleAlert className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-600" />
              Next Real Action
            </CardTitle>
            <Badge variant={stateVariant(report.overallState)}>
              {report.overallState === "ready"
                ? "Ready"
                : report.overallState === "warning"
                  ? "In closure"
                  : "Blocked by external dependencies"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{report.nextAction}</p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Stop rule</div>
              <p className="mt-1">
                Do not reopen broad feature work. The product should only move through:
                clinical validation, environment activation, and pilot sign-off.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Closure Meaning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The repo is already feature-complete enough for validation. What remains is mostly
              sign-off, live configuration, and controlled rollout.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Product-side build work</span>
                <Badge variant="low">Essentially complete</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>External activation work</span>
                <Badge variant="high">Still required</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Clinical / pilot sign-off</span>
                <Badge variant="high">Still required</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {report.steps.map((step, index) => (
          <Card key={step.id}>
            <CardHeader>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{`Step ${index + 1}`}</Badge>
                  <Badge variant={stateVariant(step.state)}>
                    {step.state === "ready"
                      ? "Ready"
                      : step.state === "warning"
                        ? "Pending"
                        : "Blocked"}
                  </Badge>
                  <Badge variant={ownerVariant(step.owner)}>{ownerLabel(step.owner)}</Badge>
                </div>
                <CardTitle>{step.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{step.summary}</p>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Already done
                </div>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {step.doneItems.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Still needed
                </div>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {step.remainingItems.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warn flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
