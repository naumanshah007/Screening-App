import { z } from "zod";

export const CLINICAL_RULE_SNAPSHOT_SCHEMA_VERSION = "3.0" as const;
export const CLINICAL_RULE_ENGINE_CONTRACT_VERSION = "canonical-graph-v1" as const;

export const SafetyPrioritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export type SafetyPriority = z.infer<typeof SafetyPrioritySchema>;

export const ReviewerRequirementSchema = z.enum([
  "MANDATORY_CLINICIAN_CONFIRMATION",
  "CLINICIAN_REVIEW",
  "MDM_REVIEW",
  "SPECIALIST_REVIEW",
]);
export type ReviewerRequirement = z.infer<typeof ReviewerRequirementSchema>;

export const FactOperatorSchema = z.enum([
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "EXISTS",
  "MISSING",
  "CONTAINS",
]);

export type ScalarFactValue = string | number | boolean | null;

export type ConditionExpression =
  | {
      type: "FACT";
      fact: string;
      operator: z.infer<typeof FactOperatorSchema>;
      value?: ScalarFactValue | ScalarFactValue[];
    }
  | { type: "ALL"; expressions: ConditionExpression[] }
  | { type: "ANY"; expressions: ConditionExpression[] }
  | { type: "NOT"; expression: ConditionExpression }
  | { type: "ALWAYS" }
  | {
      type: "SOURCE_TEXT";
      text: string;
      executable: false;
      reviewReason: string;
    };

export const ConditionExpressionSchema: z.ZodType<ConditionExpression> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("FACT"),
      fact: z.string().trim().min(1).max(160),
      operator: FactOperatorSchema,
      value: z
        .union([
          z.string(),
          z.number().finite(),
          z.boolean(),
          z.null(),
          z.array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).max(100),
        ])
        .optional(),
    }),
    z.object({
      type: z.literal("ALL"),
      expressions: z.array(ConditionExpressionSchema).min(1).max(100),
    }),
    z.object({
      type: z.literal("ANY"),
      expressions: z.array(ConditionExpressionSchema).min(1).max(100),
    }),
    z.object({ type: z.literal("NOT"), expression: ConditionExpressionSchema }),
    z.object({ type: z.literal("ALWAYS") }),
    z.object({
      type: z.literal("SOURCE_TEXT"),
      text: z.string().trim().min(1).max(4_000),
      executable: z.literal(false),
      reviewReason: z.string().trim().min(1).max(1_000),
    }),
  ])
);

export const SourceReferenceSchema = z.object({
  document: z.string().trim().min(1),
  reference: z.string().trim().min(1),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const RuleDefinitionSchema = z.object({
  stableRuleId: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]*$/),
  section: z.string().trim().min(1),
  pathwayStage: z.string().trim().min(1),
  conditionExpression: ConditionExpressionSchema,
  sourceConditionText: z.string().trim().min(1),
  requiredFacts: z.array(z.string().trim().min(1)).min(1),
  missingDataBehaviour: z.string().trim().min(1),
  provisionalOutcome: z.string().trim().min(1),
  timingDestination: z.string(),
  careSetting: z.string().trim().min(1),
  automationBoundary: z.string().trim().min(1),
  reviewerRequirement: ReviewerRequirementSchema,
  sourceReferences: z.array(SourceReferenceSchema).min(1),
  updateStatus: z.string().trim().min(1),
  implementationNote: z.string().trim().min(1),
  safetyPriority: SafetyPrioritySchema,
  executableTestIds: z.array(z.string().trim().min(1)),
});
export type RuleDefinition = z.infer<typeof RuleDefinitionSchema>;

export const GraphNodeTypeSchema = z.enum([
  "START",
  "ROUTER",
  "DECISION",
  "ACTION",
  "REPEAT_TIMER",
  "SAFETY_STOP",
  "CLINICIAN_REVIEW",
  "MDM_REVIEW",
  "SPECIALIST_REFERRAL",
  "SUBFLOW_LINK",
  "TERMINAL",
  "INFORMATION",
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const GraphNodeSchema = z.object({
  stableNodeId: z.string().trim().min(1),
  nodeType: GraphNodeTypeSchema,
  label: z.string().trim().min(1),
  shortLabel: z.string().trim().min(1),
  description: z.string(),
  linkedRuleIds: z.array(z.string().trim().min(1)),
  requiredFacts: z.array(z.string().trim().min(1)),
  sourceReferences: z.array(SourceReferenceSchema),
  icon: z.string().trim().min(1),
  visualCategory: z.string().trim().min(1),
  clinicalRisk: SafetyPrioritySchema,
  reviewerRequirement: ReviewerRequirementSchema,
  governance: z.object({
    classification: z.enum(["NATIONAL_SOURCE", "LOCAL_OPERATIONAL", "LOCAL_CLINICAL_FORK"]),
    reason: z.string(),
    parentRuleIds: z.array(z.string().trim().min(1)),
    locallyModified: z.boolean(),
  }),
  provisionalOutcome: z.string().optional(),
  timingDestination: z.string().optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  stableEdgeId: z.string().trim().min(1),
  fromNodeId: z.string().trim().min(1),
  toNodeId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  conditionExpression: ConditionExpressionSchema,
  priority: z.number().int().min(0).max(10_000),
  branchOrder: z.number().int().min(0).max(10_000),
  isDefault: z.boolean(),
  isSafetyOverride: z.boolean(),
  allowsCycle: z.boolean(),
  sourceRuleIds: z.array(z.string().trim().min(1)),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const GraphViewSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  viewType: z.enum(["MASTER", "PATHWAY", "OVERLAY"]),
  includedNodeIds: z.array(z.string().trim().min(1)).min(1),
  includedEdgeIds: z.array(z.string().trim().min(1)),
  layout: z.record(z.string(), GraphPositionSchema),
  defaultZoom: z.number().positive(),
  minimumZoom: z.number().positive(),
  maximumZoom: z.number().positive(),
  fitViewPadding: z.number().min(0),
  displayOrder: z.number().int().min(0),
  legendConfiguration: z.object({
    show: z.boolean(),
    categories: z.array(z.string().trim().min(1)),
    labels: z.record(z.string(), z.string().trim().min(1)).optional(),
  }),
  visualSource: z
    .object({
      packageVersion: z.string().trim().min(1),
      sourceViewId: z.string().trim().min(1),
      verificationStatus: z.string().trim().min(1),
      sourceFiles: z.array(z.string().trim().min(1)),
      coordinateSystem: z.string().trim().min(1),
    })
    .optional(),
  annotations: z.array(z.string().trim().min(1)).optional(),
});
export type GraphView = z.infer<typeof GraphViewSchema>;

export const ClinicalSourceSchema = z.object({
  priority: z.number().int().positive(),
  document: z.string().trim().min(1),
  version: z.string().trim().min(1),
  published: z.string().trim().min(1),
  role: z.string().trim().min(1),
  file: z.string().trim().min(1),
  notes: z.string(),
});

export const ImmuneClassifierEntrySchema = z.object({
  classification: z.string().trim().min(1),
  conditionOrMedication: z.string().trim().min(1),
  thresholdOrDuration: z.string(),
  softwareResult: z.string().trim().min(1),
  notes: z.string(),
});

export const ClinicalRuleSnapshotSchema = z.object({
  schemaVersion: z.literal(CLINICAL_RULE_SNAPSHOT_SCHEMA_VERSION),
  engineContractVersion: z.literal(CLINICAL_RULE_ENGINE_CONTRACT_VERSION),
  productRuleSet: z.object({
    key: z.string().trim().min(1),
    displayVersion: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
  sourcePackage: z.object({
    version: z.string().trim().min(1),
    generated: z.string().trim().min(1),
    status: z.string().trim().min(1),
    sourceJsonSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  safetyNotices: z.array(z.string().trim().min(1)).min(5),
  rules: z.array(RuleDefinitionSchema).min(1),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema).min(1),
  views: z.array(GraphViewSchema).min(1),
  sources: z.array(ClinicalSourceSchema).min(1),
  immuneClassifier: z.array(ImmuneClassifierEntrySchema),
  sourcePageRegister: z.array(
    z.object({
      sourceItem: z.string().trim().min(1),
      printedPage: z.number().int().positive(),
      pdfPageNumber1Based: z.number().int().positive(),
    })
  ),
  qaClosure: z.record(z.string(), z.literal("closed")),
  importEvidence: z.object({
    expectedRuleCount: z.literal(203),
    table1RuleCount: z.literal(21),
    treeCoverageRuleIds: z.array(z.string().trim().min(1)),
    sourceFiles: z.array(z.string().trim().min(1)),
    visualPackageVersion: z.string().trim().min(1).optional(),
    visualVerificationStatus: z.string().trim().min(1).optional(),
    visualPackageFiles: z.array(z.string().trim().min(1)).optional(),
  }),
});
export type ClinicalRuleSnapshot = z.infer<typeof ClinicalRuleSnapshotSchema>;

export function isExecutableExpression(expression: ConditionExpression): boolean {
  switch (expression.type) {
    case "SOURCE_TEXT":
      return false;
    case "ALL":
    case "ANY":
      return expression.expressions.every(isExecutableExpression);
    case "NOT":
      return isExecutableExpression(expression.expression);
    default:
      return true;
  }
}

export function parseSnapshot(value: unknown): ClinicalRuleSnapshot {
  return ClinicalRuleSnapshotSchema.parse(value);
}
