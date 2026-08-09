import {
  ClinicalRuleSnapshotSchema,
  isExecutableExpression,
  type ClinicalRuleSnapshot,
} from "./schema";
import { EXECUTABLE_CONFORMANCE_TEST_IDS } from "./compiled-v2-1";

export type RuleValidationSeverity = "ERROR" | "WARNING" | "INFO";
export type RuleValidationCategory = "SCHEMA" | "STRUCTURAL" | "CLINICAL_SAFETY" | "COVERAGE";

export type RuleValidationIssue = {
  code: string;
  severity: RuleValidationSeverity;
  category: RuleValidationCategory;
  message: string;
  ruleId?: string;
  nodeId?: string;
  edgeId?: string;
  viewKey?: string;
};

export type RuleValidationReport = {
  valid: boolean;
  generatedAt: string;
  counts: {
    rules: number;
    nodes: number;
    edges: number;
    views: number;
    errors: number;
    warnings: number;
    information: number;
  };
  issues: RuleValidationIssue[];
};

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function pushDuplicates(
  issues: RuleValidationIssue[],
  values: string[],
  code: string,
  label: string
) {
  for (const value of duplicateValues(values)) {
    issues.push({
      code,
      severity: "ERROR",
      category: "STRUCTURAL",
      message: `Duplicate ${label}: ${value}.`,
    });
  }
}

function detectUnexpectedCycles(snapshot: ClinicalRuleSnapshot): RuleValidationIssue[] {
  const adjacency = new Map<string, Array<{ to: string; edgeId: string; allowsCycle: boolean }>>();
  for (const edge of snapshot.edges) {
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push({ to: edge.toNodeId, edgeId: edge.stableEdgeId, allowsCycle: edge.allowsCycle });
    adjacency.set(edge.fromNodeId, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const issues: RuleValidationIssue[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (visiting.has(edge.to) && !edge.allowsCycle) {
        issues.push({
          code: "UNEXPECTED_CYCLE",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `Edge ${edge.edgeId} creates a cycle but is not declared as a repeat-pathway cycle.`,
          edgeId: edge.edgeId,
        });
        continue;
      }
      visit(edge.to);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of snapshot.nodes) visit(node.stableNodeId);
  return issues;
}

function rulesMentioning(snapshot: ClinicalRuleSnapshot, text: string) {
  const target = text.toLowerCase();
  return snapshot.rules.filter((rule) =>
    `${rule.sourceConditionText} ${rule.provisionalOutcome}`.toLowerCase().includes(target)
  );
}

export function validateClinicalRuleSnapshot(value: unknown): RuleValidationReport {
  const generatedAt = new Date().toISOString();
  const parsed = ClinicalRuleSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    const issues: RuleValidationIssue[] = parsed.error.issues.map((issue) => ({
      code: "SNAPSHOT_SCHEMA_INVALID",
      severity: "ERROR",
      category: "SCHEMA",
      message: `${issue.path.join(".") || "snapshot"}: ${issue.message}`,
    }));
    return {
      valid: false,
      generatedAt,
      counts: {
        rules: 0,
        nodes: 0,
        edges: 0,
        views: 0,
        errors: issues.length,
        warnings: 0,
        information: 0,
      },
      issues,
    };
  }

  const snapshot = parsed.data;
  const issues: RuleValidationIssue[] = [];
  const ruleIds = snapshot.rules.map((rule) => rule.stableRuleId);
  const nodeIds = snapshot.nodes.map((node) => node.stableNodeId);
  const edgeIds = snapshot.edges.map((edge) => edge.stableEdgeId);
  const viewKeys = snapshot.views.map((view) => view.key);
  const ruleSet = new Set(ruleIds);
  const nodeSet = new Set(nodeIds);
  const edgeSet = new Set(edgeIds);

  pushDuplicates(issues, ruleIds, "DUPLICATE_RULE_ID", "stable rule ID");
  pushDuplicates(issues, nodeIds, "DUPLICATE_NODE_ID", "stable node ID");
  pushDuplicates(issues, edgeIds, "DUPLICATE_EDGE_ID", "stable edge ID");
  pushDuplicates(issues, viewKeys, "DUPLICATE_VIEW_KEY", "view key");

  for (const node of snapshot.nodes) {
    for (const ruleId of node.linkedRuleIds) {
      if (!ruleSet.has(ruleId)) {
        issues.push({
          code: "NODE_RULE_UNRESOLVED",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `Node ${node.stableNodeId} links unknown rule ${ruleId}.`,
          nodeId: node.stableNodeId,
          ruleId,
        });
      }
    }
    if (
      ["TERMINAL", "SAFETY_STOP", "REPEAT_TIMER", "SPECIALIST_REFERRAL"].includes(node.nodeType) &&
      !node.provisionalOutcome?.trim()
    ) {
      issues.push({
        code: "TERMINAL_OUTCOME_MISSING",
        severity: "ERROR",
        category: "STRUCTURAL",
        message: `Terminal/action node ${node.stableNodeId} has no provisional outcome.`,
        nodeId: node.stableNodeId,
      });
    }
    const linkedRule = node.linkedRuleIds.length === 1
      ? snapshot.rules.find((rule) => rule.stableRuleId === node.linkedRuleIds[0])
      : undefined;
    if (linkedRule && node.nodeType === "DECISION" && node.label !== linkedRule.sourceConditionText) {
      issues.push({
        code: "DECISION_RULE_DRIFT",
        severity: "ERROR",
        category: "STRUCTURAL",
        message: `Decision node ${node.stableNodeId} has drifted from rule ${linkedRule.stableRuleId}.`,
        nodeId: node.stableNodeId,
        ruleId: linkedRule.stableRuleId,
      });
    }
    if (
      linkedRule &&
      node.stableNodeId.startsWith("node:outcome:") &&
      node.label !== linkedRule.provisionalOutcome
    ) {
      issues.push({
        code: "OUTCOME_RULE_DRIFT",
        severity: "ERROR",
        category: "STRUCTURAL",
        message: `Outcome node ${node.stableNodeId} has drifted from rule ${linkedRule.stableRuleId}.`,
        nodeId: node.stableNodeId,
        ruleId: linkedRule.stableRuleId,
      });
    }
    if (
      ["ACTION", "REPEAT_TIMER", "SAFETY_STOP", "CLINICIAN_REVIEW", "MDM_REVIEW", "SPECIALIST_REFERRAL", "TERMINAL"].includes(node.nodeType) &&
      node.sourceReferences.length === 0 &&
      !node.governance.reason.trim()
    ) {
      issues.push({
        code: "CLINICAL_ACTION_GOVERNANCE_MISSING",
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `Clinical action node ${node.stableNodeId} requires a source or explicit local-governance reason.`,
        nodeId: node.stableNodeId,
      });
    }
    if (
      node.governance.classification === "LOCAL_CLINICAL_FORK" &&
      (!node.governance.locallyModified || !node.governance.reason.trim())
    ) {
      issues.push({
        code: "LOCAL_CLINICAL_FORK_UNGOVERNED",
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `Locally modified node ${node.stableNodeId} requires an explicit governance reason.`,
        nodeId: node.stableNodeId,
      });
    }
  }

  const inboundCount = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  for (const edge of snapshot.edges) {
    if (!nodeSet.has(edge.fromNodeId) || !nodeSet.has(edge.toNodeId)) {
      issues.push({
        code: "DANGLING_EDGE",
        severity: "ERROR",
        category: "STRUCTURAL",
        message: `Edge ${edge.stableEdgeId} has an unresolved endpoint.`,
        edgeId: edge.stableEdgeId,
      });
    } else {
      inboundCount.set(edge.toNodeId, (inboundCount.get(edge.toNodeId) ?? 0) + 1);
    }
    for (const ruleId of edge.sourceRuleIds) {
      if (!ruleSet.has(ruleId)) {
        issues.push({
          code: "EDGE_RULE_UNRESOLVED",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `Edge ${edge.stableEdgeId} references unknown rule ${ruleId}.`,
          edgeId: edge.stableEdgeId,
          ruleId,
        });
      }
    }
  }

  for (const node of snapshot.nodes) {
    if (node.nodeType !== "START" && (inboundCount.get(node.stableNodeId) ?? 0) === 0) {
      issues.push({
        code: "ORPHAN_NODE",
        severity: "ERROR",
        category: "STRUCTURAL",
        message: `Node ${node.stableNodeId} has no inbound route.`,
        nodeId: node.stableNodeId,
      });
    }
  }
  issues.push(...detectUnexpectedCycles(snapshot));

  for (const view of snapshot.views) {
    for (const nodeId of view.includedNodeIds) {
      if (!nodeSet.has(nodeId)) {
        issues.push({
          code: "VIEW_NODE_UNRESOLVED",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `View ${view.key} contains unknown node ${nodeId}.`,
          viewKey: view.key,
          nodeId,
        });
      }
      if (!view.layout[nodeId]) {
        issues.push({
          code: "VIEW_LAYOUT_MISSING",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `View ${view.key} has no layout position for ${nodeId}.`,
          viewKey: view.key,
          nodeId,
        });
      }
    }
    for (const edgeId of view.includedEdgeIds) {
      if (!edgeSet.has(edgeId)) {
        issues.push({
          code: "VIEW_EDGE_UNRESOLVED",
          severity: "ERROR",
          category: "STRUCTURAL",
          message: `View ${view.key} contains unknown edge ${edgeId}.`,
          viewKey: view.key,
          edgeId,
        });
      }
    }
  }

  const masterView = snapshot.views.find((view) => view.viewType === "MASTER");
  if (!masterView) {
    issues.push({
      code: "MASTER_VIEW_MISSING",
      severity: "ERROR",
      category: "COVERAGE",
      message: "A master graph view is required.",
    });
  } else {
    const masterRuleIds = new Set(
      snapshot.nodes
        .filter((node) => masterView.includedNodeIds.includes(node.stableNodeId))
        .flatMap((node) => node.linkedRuleIds)
    );
    for (const ruleId of ruleIds) {
      if (!masterRuleIds.has(ruleId)) {
        issues.push({
          code: "MASTER_RULE_MISSING",
          severity: "ERROR",
          category: "COVERAGE",
          message: `Rule ${ruleId} is absent from the master view.`,
          ruleId,
        });
      }
    }
  }

  const pathwayViews = snapshot.views.filter((view) => view.viewType !== "MASTER");
  const pathwayRuleIds = new Set(
    snapshot.nodes
      .filter((node) =>
        pathwayViews.some((view) => view.includedNodeIds.includes(node.stableNodeId))
      )
      .flatMap((node) => node.linkedRuleIds)
  );
  for (const rule of snapshot.rules) {
    if (!pathwayRuleIds.has(rule.stableRuleId)) {
      issues.push({
        code: "PATHWAY_RULE_MISSING",
        severity: "ERROR",
        category: "COVERAGE",
        message: `Rule ${rule.stableRuleId} is absent from every pathway view.`,
        ruleId: rule.stableRuleId,
      });
    }
    if (rule.sourceReferences.length === 0) {
      issues.push({
        code: "SOURCE_REFERENCE_MISSING",
        severity: "ERROR",
        category: "COVERAGE",
        message: `Rule ${rule.stableRuleId} has no source reference.`,
        ruleId: rule.stableRuleId,
      });
    }
    if (["CRITICAL", "HIGH"].includes(rule.safetyPriority)) {
      if (!isExecutableExpression(rule.conditionExpression)) {
        issues.push({
          code: "HIGH_RISK_RULE_NOT_EXECUTABLE",
          severity: "ERROR",
          category: "COVERAGE",
          message: `Rule ${rule.stableRuleId} is ${rule.safetyPriority} but still contains source text rather than a governed typed expression.`,
          ruleId: rule.stableRuleId,
        });
      }
      if (rule.executableTestIds.length === 0) {
        issues.push({
          code: "HIGH_RISK_TEST_MISSING",
          severity: "ERROR",
          category: "COVERAGE",
          message: `Rule ${rule.stableRuleId} is ${rule.safetyPriority} and has no executable conformance-test identifier.`,
          ruleId: rule.stableRuleId,
        });
      }
      const unknownTestIds = rule.executableTestIds.filter(
        (testId) => !EXECUTABLE_CONFORMANCE_TEST_IDS.has(testId)
      );
      if (unknownTestIds.length > 0) {
        issues.push({
          code: "HIGH_RISK_TEST_UNREGISTERED",
          severity: "ERROR",
          category: "COVERAGE",
          message: `Rule ${rule.stableRuleId} references unregistered executable conformance tests: ${unknownTestIds.join(", ")}.`,
          ruleId: rule.stableRuleId,
        });
      }
    }
    if (!/unknown|missing|request|review|stop/i.test(rule.missingDataBehaviour)) {
      issues.push({
        code: "MISSING_DATA_ROUTE_UNCLEAR",
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `Rule ${rule.stableRuleId} does not declare an explicit missing-data safety behaviour.`,
        ruleId: rule.stableRuleId,
      });
    }
  }

  if (snapshot.rules.length !== 203) {
    issues.push({
      code: "SOURCE_RULE_COUNT_MISMATCH",
      severity: "ERROR",
      category: "COVERAGE",
      message: `Expected 203 source rules; found ${snapshot.rules.length}.`,
    });
  }
  const tableRules = snapshot.rules.filter((rule) => rule.stableRuleId.startsWith("T1-"));
  if (tableRules.length !== 21) {
    issues.push({
      code: "TABLE_1_COUNT_MISMATCH",
      severity: "ERROR",
      category: "CLINICAL_SAFETY",
      message: `Expected all 21 Table 1 combinations; found ${tableRules.length}.`,
    });
  }

  const rulesById = new Map(snapshot.rules.map((rule) => [rule.stableRuleId, rule]));
  const requireSafetyInvariant = (
    ruleId: string,
    conditionPattern: RegExp,
    outcomePattern: RegExp,
    code: string,
    description: string
  ) => {
    const rule = rulesById.get(ruleId);
    if (!rule || !conditionPattern.test(rule.sourceConditionText) || !outcomePattern.test(rule.provisionalOutcome)) {
      issues.push({
        code,
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `${description} Controlling rule ${ruleId} is missing or no longer preserves the governed condition/outcome invariant.`,
        ruleId,
      });
    }
  };

  requireSafetyInvariant("F3-03", /HPV\s*16\s*(?:or|\/)\s*18/i, /colposcopy/i, "HPV_16_18_COLPOSCOPY_INVARIANT", "HPV 16/18 must not route to routine recall.");
  requireSafetyInvariant("F3-09", /repeat.*HPV\s*16\s*(?:or|\/)\s*18/i, /colposcopy/i, "HPV_16_18_REPEAT_COLPOSCOPY_INVARIANT", "Repeat-stage HPV 16/18 must route to colposcopy.");
  requireSafetyInvariant("F3-16", /70\s*-\s*74.*HPV detected any type/i, /colposcopy/i, "EXIT_TEST_DETECTED_COLPOSCOPY_INVARIANT", "An age 70–74 exit test with any HPV detected must route to colposcopy.");
  requireSafetyInvariant("F6-03", /two consecutive co-tests.*HPV not detected.*cytology negative/i, /Test of Cure complete/i, "TOC_SEQUENCE_INVARIANT", "Test of Cure cannot complete without two qualifying consecutive co-tests.");
  requireSafetyInvariant("F8-11", /two consecutive.*12 months apart/i, /cease screening/i, "VAULT_TOC_CESSATION_INVARIANT", "A successful vault Test of Cure must end in screening cessation.");
  requireSafetyInvariant("F3-20", /invasive cervical cancer/i, /urgent.*two weeks/i, "MALIGNANT_CYTOLOGY_URGENCY_INVARIANT", "Cytology suspicious or definite for invasive cervical cancer requires urgent routing.");
  requireSafetyInvariant("F7-17", /invasive adenocarcinoma|invasive glandular cancer/i, /urgent.*oncology/i, "GLANDULAR_CANCER_URGENCY_INVARIANT", "Suspected invasive glandular cancer requires urgent specialist/oncology routing.");
  requireSafetyInvariant("F3-22", /initial.*first-repeat.*second-repeat/i, /every repeat stage/i, "PRIMARY_REPEAT_OVERLAY_INVARIANT", "Validity, adequacy, and endometrial overlays must apply at every primary-screening repeat stage.");
  requireSafetyInvariant("F4-16", /12- or 24-month event/i, /before ordinary Figure 4 branch/i, "LOW_GRADE_REPEAT_OVERLAY_INVARIANT", "Validity and specialist overlays must precede every Figure 4 repeat branch.");
  requireSafetyInvariant("F6-16", /Any ToC event/i, /before counting or completing/i, "TOC_REPEAT_OVERLAY_INVARIANT", "Validity and specialist overlays must run before counting any Test-of-Cure event.");

  for (const cancerRule of rulesMentioning(snapshot, "cancer")) {
    if (/routine recall/i.test(cancerRule.provisionalOutcome) && /suspect|suspicion|concern/i.test(cancerRule.sourceConditionText)) {
      issues.push({
        code: "SUSPECTED_CANCER_ROUTINE_RECALL",
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `Rule ${cancerRule.stableRuleId} appears to route suspected cancer to routine recall.`,
        ruleId: cancerRule.stableRuleId,
      });
    }
  }

  const clinicianOnlyNodes = snapshot.nodes.filter((node) =>
    ["CLINICIAN_REVIEW", "MDM_REVIEW", "SPECIALIST_REFERRAL", "SAFETY_STOP"].includes(node.nodeType)
  );
  for (const node of clinicianOnlyNodes) {
    if (node.reviewerRequirement !== "MANDATORY_CLINICIAN_CONFIRMATION" && node.reviewerRequirement !== "CLINICIAN_REVIEW" && node.reviewerRequirement !== "MDM_REVIEW" && node.reviewerRequirement !== "SPECIALIST_REVIEW") {
      issues.push({
        code: "CLINICIAN_ONLY_AUTONOMOUS",
        severity: "ERROR",
        category: "CLINICAL_SAFETY",
        message: `Clinician-only node ${node.stableNodeId} lacks a reviewer requirement.`,
        nodeId: node.stableNodeId,
      });
    }
  }

  issues.push({
    code: "SOFTWARE_VALIDATION_SCOPE",
    severity: "INFO",
    category: "CLINICAL_SAFETY",
    message:
      "This report verifies the software snapshot and declared safeguards only. It is not clinical validation, pilot approval, or production readiness.",
  });

  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  const warnings = issues.filter((issue) => issue.severity === "WARNING").length;
  const information = issues.filter((issue) => issue.severity === "INFO").length;
  return {
    valid: errors === 0,
    generatedAt,
    counts: {
      rules: snapshot.rules.length,
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      views: snapshot.views.length,
      errors,
      warnings,
      information,
    },
    issues,
  };
}
