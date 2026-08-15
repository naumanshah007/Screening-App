import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const APP_LAYOUT = read("app/(app)/layout.tsx");
const ROOT_LAYOUT = read("app/layout.tsx");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const SESSION = read("lib/auth/server-session.ts");
const PROXY = read("proxy.ts");
const NAV_COUNTS = read("app/api/navigation/review-counts/route.ts");
const REVIEW_PAGE = read("app/(app)/review/page.tsx");
const REVIEW_DATA = read("lib/batch/persistence.ts");
const DECISIONS_PAGE = read("app/(app)/decisions/page.tsx");
const DECISIONS_DATA = read("lib/decisions/completed-decisions.ts");
const INTEGRATIONS = read("lib/integrations/connections.ts");
const INTEGRATION_ROUTE = read("app/api/admin/integrations/[id]/route.ts");
const INTEGRATION_CLIENT = read("components/integrations/IntegrationCentreClient.tsx");
const INDEX_MIGRATION = read("prisma/migrations/20260816100000_performance_read_indexes/migration.sql");
const GRAPH_STUDIO = read("components/clinical-rules/ClinicalRuleGraphStudio.tsx");
const PATHWAY_VIEWER = read("components/pathway/PathwayViewer.tsx");

test("priority navigation prefetches and reports an immediate pending state", () => {
  assert.match(SIDEBAR, /prefetch=\{primary \? true : "auto"\}/);
  assert.match(SIDEBAR, /useLinkStatus\(\)/);
  assert.match(SIDEBAR, /data-navigation-feedback/);
  assert.match(SIDEBAR, /role="status"/);
  assert.match(SIDEBAR, /primary=\{section\.id === "triage"\}/);
});

test("responsive navigation keeps a mobile drawer and a desktop-only sidebar", () => {
  assert.match(SIDEBAR, /aria-label="Open navigation"/);
  assert.match(SIDEBAR, /fixed inset-0 z-40 xl:hidden/);
  assert.match(SIDEBAR, /aria-label="Close navigation"/);
  assert.match(SIDEBAR, /hidden xl:flex flex-col/);
});

test("the decorative Review Queue badge does not block the authenticated layout", () => {
  assert.doesNotMatch(APP_LAYOUT, /getReviewQueueCounts/);
  assert.match(SIDEBAR, /fetch\("\/api\/navigation\/review-counts"/);
  assert.match(SIDEBAR, /setInterval\(\(\) => void load\(\), 30_000\)/);
  assert.match(NAV_COUNTS, /await auth\(\)/);
  assert.match(NAV_COUNTS, /isAuthorizedForRoute\("\/review", role\)/);
  assert.match(NAV_COUNTS, /private, max-age=10, stale-while-revalidate=20/);
});

test("request deduplication never becomes cross-request security caching", () => {
  assert.match(SESSION, /cache\(\(\) => auth\(\)\)/);
  assert.match(SESSION, /proxy still validates every request independently/i);
  assert.match(PROXY, /export default auth\(\(req\) =>/);
  assert.doesNotMatch(PROXY, /getServerSession/);
});

test("high-frequency lists are bounded and server-paginated", () => {
  assert.match(REVIEW_PAGE, /REVIEW_QUEUE_PAGE_SIZE = 50/);
  assert.match(REVIEW_DATA, /LIMIT \$\{pageSize\} OFFSET \$\{offset\}/);
  assert.match(REVIEW_DATA, /where: \{ id: \{ in: ids \} \}/);
  assert.match(DECISIONS_PAGE, /COMPLETED_DECISIONS_PAGE_SIZE = 50/);
  assert.match(DECISIONS_PAGE, /skip: \(page - 1\) \* COMPLETED_DECISIONS_PAGE_SIZE/);
  const listProjection = DECISIONS_DATA.slice(
    DECISIONS_DATA.indexOf("const completedDecisionListSelect"),
    DECISIONS_DATA.indexOf("export type CompletedDecisionListRecord")
  );
  assert.doesNotMatch(listProjection, /ruleEvaluation/);
});

test("the measured queue filters have additive read indexes", () => {
  assert.match(INDEX_MIGRATION, /IF NOT EXISTS/);
  assert.match(INDEX_MIGRATION, /disposition[\s\S]*reviewRequired[\s\S]*createdAt/);
  assert.match(INDEX_MIGRATION, /disposition[\s\S]*reviewedAt/);
  assert.doesNotMatch(INDEX_MIGRATION, /DROP|DELETE|UPDATE/);
});

test("Integration Centre defers immutable evidence until a drawer is opened", () => {
  const dashboard = INTEGRATIONS.slice(
    INTEGRATIONS.indexOf("export async function getIntegrationDashboard"),
    INTEGRATIONS.indexOf("export async function getIntegrationConnectionEvidence")
  );
  assert.doesNotMatch(dashboard, /auditLog\.findMany/);
  assert.match(INTEGRATION_ROUTE, /export async function GET/);
  assert.match(INTEGRATION_ROUTE, /getIntegrationConnectionEvidence/);
  assert.match(INTEGRATION_CLIENT, /openEvidence/);
  assert.match(INTEGRATION_CLIENT, /request\(`\/api\/admin\/integrations\/\$\{connection\.id\}`/);
});

test("loading shells exist for the high-frequency routes", () => {
  for (const path of [
    "app/(app)/dashboard/loading.tsx",
    "app/(app)/batch/loading.tsx",
    "app/(app)/review/loading.tsx",
    "app/(app)/decisions/loading.tsx",
    "app/(app)/guidelines/loading.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /Skeleton|data-navigation-feedback|role="status"/, path);
  }
});

test("React Flow styles stay with graph routes instead of the global layout", () => {
  assert.doesNotMatch(ROOT_LAYOUT, /@xyflow\/react\/dist\/style\.css/);
  assert.match(GRAPH_STUDIO, /@xyflow\/react\/dist\/style\.css/);
  assert.match(PATHWAY_VIEWER, /@xyflow\/react\/dist\/style\.css/);
});
