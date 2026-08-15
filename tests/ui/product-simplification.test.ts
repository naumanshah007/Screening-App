import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SIDEBAR = read("components/layout/Sidebar.tsx");
const GOVERNANCE = read("app/(app)/governance/clinical/page.tsx");
const RULE_VERSIONS = read("app/(app)/rules/clinical/page.tsx");
const RULE_VERSION = read("app/(app)/rules/clinical/[id]/page.tsx");
const VERSION_ACTIONS = read("components/clinical-rules/ClinicalRuleVersionActions.tsx");
const PATHWAYS = read("components/pathway/PathwayCatalogue.tsx");
const PATHWAY_DETAIL = read("components/pathway/PathwayDetailPanel.tsx");
const PERMISSIONS = read("lib/auth/permissions.ts");

test("the final navigation advertises only current product workflows", () => {
  for (const label of [
    "Command Centre",
    "Pull Cases",
    "Review Queue",
    "Completed Decisions",
    "Guidelines",
    "Analytics",
    "Usage & Activity",
    "Audit Trail",
    "Users & Access",
    "Integration Centre",
    "Rule Studio",
    "Clinical Governance",
    "System Operations",
  ]) {
    assert.match(SIDEBAR, new RegExp(`"${label}"`), `missing ${label}`);
  }
  for (const retired of [
    "Deployment Readiness",
    "Manual Cases",
    "Patient Registry",
    "Pathway Wizard",
    "GP Referral",
    "Legacy Referral Queue",
    "Intake Sessions",
  ]) {
    assert.doesNotMatch(SIDEBAR, new RegExp(`"${retired}"`));
  }
});

test("hiding navigation leaves route enforcement unchanged", () => {
  for (const prefix of [
    "/readiness",
    "/patients",
    "/batch",
    "/governance/clinical",
    "/admin/integrations",
    "/admin",
    "/rules",
  ]) {
    assert.match(PERMISSIONS, new RegExp(`prefix: "${prefix.replaceAll("/", "\\/")}"`));
  }
});

test("Clinical Governance opens with a concise truthful summary", () => {
  for (const label of [
    "Clinical Governance",
    "Current governed rules",
    "Production governance",
    "Clinical interpretations",
    "Independent approvals",
    "Operational gates",
    "Current review version",
    "No draft under review",
    "View detailed governance register",
  ]) {
    assert.match(GOVERNANCE, new RegExp(label));
  }
  assert.match(GOVERNANCE, /<DrawerDisclosure[\s\S]*<ClinicalGovernanceReviewWorkspace/);
  assert.match(GOVERNANCE, /<DrawerDisclosure[\s\S]*<ActivationGovernancePanel/);
  assert.doesNotMatch(GOVERNANCE, /title=\{`\$\{version\.displayVersion\} approval centre`\}/);
});

test("the immutable current-version and successor workflow are explicit", () => {
  assert.match(RULE_VERSIONS, /title="Rules version workflow"/);
  assert.match(RULE_VERSIONS, /The active version is immutable/);
  assert.match(RULE_VERSIONS, /Historical cases retain their original ruleset and authority/);
  assert.match(RULE_VERSION, /Current governed version · read-only/);
  assert.match(RULE_VERSION, /Choose Create new version/);
  assert.match(VERSION_ACTIONS, />Create new version<\/Button>/);
  assert.match(VERSION_ACTIONS, /Number\(match\[4\]\) \+ 1/);
});

test("Pathway Views cards open the shared governed graph renderer", () => {
  assert.match(RULE_VERSION, /<PathwayCatalogue/);
  assert.match(PATHWAYS, /listPathwaySummaries\(snapshot\)/);
  assert.match(PATHWAYS, /buildPathwayGraph\(snapshot, selectedKey\)/);
  assert.match(PATHWAYS, /Open pathway/);
  assert.match(PATHWAYS, /All pathways/);
  assert.match(PATHWAYS, /<PathwayViewer/);
  assert.match(PATHWAYS, /Complete Governed Decision Tree/);
  assert.match(PATHWAYS, /Projection version/);
  assert.doesNotMatch(PATHWAYS, /layout only is view-specific/i);
});

test("Rule Studio node details expose technical evidence without changing the graph", () => {
  for (const label of [
    "Rule ID",
    "Node ID",
    "Clinical condition",
    "Outcome",
    "Source references",
    "Predicate / AST",
    "Controlling source",
    "Technical provenance",
  ]) {
    assert.match(PATHWAY_DETAIL, new RegExp(label));
  }
});
