import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import Papa from "papaparse";
import { z } from "zod";

import {
  CLINICAL_RULE_ENGINE_CONTRACT_VERSION,
  CLINICAL_RULE_SNAPSHOT_SCHEMA_VERSION,
  type ClinicalRuleSnapshot,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type GraphView,
  type ReviewerRequirement,
  type RuleDefinition,
} from "./schema";
import {
  IMPORTED_PRODUCT_VERSION,
  NATIONAL_RULE_SET_KEY,
  REQUIRED_SAFETY_NOTICES,
} from "./constants";
import { compileGovernedHighRiskRule } from "./compiled-v2-1";

const REQUIRED_PACKAGE_FILES = [
  "CerviGrade_NCSP_Master_Rules_v2_1.json",
  "CerviGrade_NCSP_Master_Rules_v2_1.csv",
  "CerviGrade_NCSP_Master_Rulebook_v2_1.xlsx",
  "CerviGrade_NCSP_Master_Rulebook_v2_1.md",
  "CerviGrade_NCSP_Master_Decision_Tree_v2_1_poster.svg",
  "CerviGrade_NCSP_Master_Decision_Tree_v2_1_poster.png",
  "CerviGrade_NCSP_Rule_Tree_Coverage_v2_1.csv",
  "CerviGrade_Master_Rulebook_v2_1_QA_Closure.md",
] as const;

const SourceRuleSchema = z.object({
  section: z.string().trim().min(1),
  rule_id: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]*$/),
  pathway_stage: z.string().trim().min(1),
  condition: z.string().trim().min(1),
  required_facts: z.string().trim().min(1),
  missing_data_behavior: z.string().trim().min(1),
  provisional_outcome: z.string().trim().min(1),
  timing_destination: z.string(),
  care_setting: z.string().trim().min(1),
  automation_boundary: z.string().trim().min(1),
  reviewer_requirement: z.string().trim().min(1),
  source_document: z.string().trim().min(1),
  source_reference: z.string().trim().min(1),
  update_status: z.string().trim().min(1),
  implementation_note: z.string().trim().min(1),
  safety_priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
});

const SourcePackageSchema = z.object({
  version: z.string().trim().min(1),
  generated: z.string().trim().min(1),
  status: z.string().trim().min(1),
  rule_count: z.literal(203),
  rules: z.array(SourceRuleSchema).length(203),
  immune_classifier: z.array(
    z.object({
      classification: z.string().trim().min(1),
      condition_or_medication: z.string().trim().min(1),
      threshold_or_duration: z.string(),
      software_result: z.string().trim().min(1),
      notes: z.string(),
    })
  ),
  sources: z.array(
    z.object({
      priority: z.number().int().positive(),
      document: z.string().trim().min(1),
      version: z.string().trim().min(1),
      published: z.string().trim().min(1),
      role: z.string().trim().min(1),
      file: z.string().trim().min(1),
      notes: z.string(),
    })
  ),
  source_page_register: z.array(
    z.object({
      source_item: z.string().trim().min(1),
      printed_page: z.number().int().positive(),
      pdf_page_number_1_based: z.number().int().positive(),
    })
  ),
  qa_closure: z.record(z.string(), z.string()),
});

type SourcePackage = z.infer<typeof SourcePackageSchema>;
type SourceRule = z.infer<typeof SourceRuleSchema>;

const VERIFIED_VISUAL_PACKAGE_DIRECTORY =
  "CerviGrade_Verified_Pathway_Views_v2_1_1";

const VerifiedVisualManifestSchema = z.object({
  visualVersion: z.literal("2.1.1"),
  clinicalRuleSetVersion: z.literal("2.1"),
  master: z.object({
    dot: z.string().trim().min(1),
    svg: z.string().trim().min(1),
    png: z.string().trim().min(1),
  }),
  views: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        clusters: z.array(z.string().trim().min(1)),
        nodeCount: z.number().int().positive(),
        edgeCount: z.number().int().nonnegative(),
        ruleCount: z.number().int().positive(),
        visualVersion: z.literal("2.1.1"),
        sourceRuleSet: z.literal("2.1"),
        verificationStatus: z.string().trim().min(1),
      })
    )
    .length(10),
});

const VerifiedVisualQaSchema = z.object({
  status: z.literal("PASS"),
  visualVersion: z.literal("2.1.1"),
  clinicalRuleSetVersion: z.literal("2.1"),
  sourceRuleCount: z.literal(203),
  mappedUniqueRuleCount: z.literal(203),
  unmappedRuleIds: z.array(z.string()).length(0),
  unknownMappedRuleIds: z.array(z.string()).length(0),
  table1RuleCount: z.literal(21),
  viewCount: z.literal(10),
  criticalAssertions: z.record(z.string(), z.boolean()),
  visualPatchesApplied: z.array(z.string().trim().min(1)),
});

const VerifiedVisualMetaSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  clusters: z.array(z.string().trim().min(1)),
  nodeCount: z.number().int().positive(),
  edgeCount: z.number().int().nonnegative(),
  ruleCount: z.number().int().positive(),
  visualVersion: z.literal("2.1.1"),
  sourceRuleSet: z.literal("2.1"),
  verificationStatus: z.string().trim().min(1),
});

const GraphvizProjectionSchema = z.object({
  objects: z.array(
    z
      .object({
        name: z.string().trim().min(1),
        label: z.string().optional(),
        pos: z.string().optional(),
        fillcolor: z.string().optional(),
        color: z.string().optional(),
        shape: z.string().optional(),
      })
      .passthrough()
  ),
  edges: z.array(z.unknown()),
});

type VerifiedVisualView = {
  id: string;
  title: string;
  description: string;
  clusters: string[];
  ruleIds: string[];
  verificationStatus: string;
  graphObjects: Array<z.infer<typeof GraphvizProjectionSchema>["objects"][number]>;
  sourceFiles: string[];
};

type VerifiedVisualPackage = {
  directory: string;
  version: "2.1.1";
  verificationStatus: "PASS";
  sourceFiles: string[];
  masterFiles: string[];
  patches: string[];
  views: Map<string, VerifiedVisualView>;
};

type ViewDefinition = {
  key: string;
  title: string;
  description: string;
  sections: string[];
  viewType?: "PATHWAY" | "OVERLAY";
  verifiedViewId?: string;
};

const PATHWAY_VIEW_DEFINITIONS: ViewDefinition[] = [
  {
    key: "global-router-safety",
    title: "Global Router and Safety",
    description: "Symptoms, age, history, cervix status, Test of Cure, DES, cancer and missing-data gates.",
    sections: ["Global Router & Safety"],
    verifiedViewId: "01_global_router_safety",
  },
  {
    key: "transition-hpv-primary",
    title: "Transition to HPV Primary Screening",
    description: "Figure 1 and Figure 2 transition pathways and entry into primary HPV screening.",
    sections: ["Figure 1", "Figure 2"],
    verifiedViewId: "02_transition_to_hpv",
  },
  {
    key: "primary-hpv-screening",
    title: "Primary HPV Screening",
    description: "Figure 3, validity/adequacy, repeats, age exit, immune interval and urgent cytology routes.",
    sections: ["Figure 3", "2026 overlays"],
    verifiedViewId: "03_primary_hpv_screening",
  },
  {
    key: "low-grade-post-colposcopy",
    title: "Normal Colposcopy after Low-Grade Cytology",
    description: "Figure 4 surveillance, repeat handling, Type 3 TZ and specialist endometrial routes.",
    sections: ["Figure 4"],
    verifiedViewId: "04_normal_colposcopy_low_grade",
  },
  {
    key: "high-grade-post-colposcopy",
    title: "Normal Colposcopy after High-Grade Cytology",
    description: "Figure 5 discordance, MDM, TZ-specific observation/excision and histology routing.",
    sections: ["Figure 5"],
    verifiedViewId: "05_normal_colposcopy_high_grade",
  },
  {
    key: "hsil-treatment-test-of-cure",
    title: "HSIL Treatment and Test of Cure",
    description: "Figure 6 treatment modality, margins, longitudinal events and Test-of-Cure completion.",
    sections: ["Figure 6"],
    verifiedViewId: "06_hsil_treatment_test_of_cure",
  },
  {
    key: "glandular-ais",
    title: "Glandular Abnormalities and AIS",
    description: "Figure 7 AG/AC subtype, gynaecology/colposcopy, MDM, excision, AIS follow-up and oncology.",
    sections: ["Figure 7"],
    verifiedViewId: "07_glandular_abnormalities_ais",
  },
  {
    key: "hysterectomy-vaginal-vault",
    title: "Total Hysterectomy and Vaginal Vault",
    description: "Figure 8 plus all 21 Table 1 combinations, vault testing, colposcopy and cessation routes.",
    sections: ["Figure 8", "Table 1"],
    verifiedViewId: "08_hysterectomy_vaginal_vault",
  },
  {
    key: "pregnancy",
    title: "Pregnancy",
    description: "Figure 9 safety guard, experienced colposcopy, MDM, biopsy, oncology and postpartum timing.",
    sections: ["Figure 9"],
    verifiedViewId: "09_pregnancy",
  },
  {
    key: "bleeding-safety-overrides",
    title: "Abnormal Bleeding and Special Safety Overrides",
    description: "Figure 10 cancer suspicion, bleeding subtypes, reassessment and pregnancy/post-hysterectomy routes.",
    sections: ["Figure 10"],
    verifiedViewId: "10_abnormal_bleeding",
  },
  {
    key: "special-populations-overlays",
    title: "Special Populations and Immune-Deficiency Overlays",
    description: "Under-25, DES, cancer/CIN2 surveillance, 2026 overlays and immune-deficiency provenance.",
    sections: ["Special populations", "2026 overlays", "Immune-deficiency classifier"],
    viewType: "OVERLAY",
  },
];

function splitFacts(value: string): string[] {
  return value
    .split(";")
    .map((fact) => fact.trim())
    .filter(Boolean);
}

function reviewerRequirement(rule: SourceRule): ReviewerRequirement {
  const combined = `${rule.reviewer_requirement} ${rule.provisional_outcome}`.toLowerCase();
  if (combined.includes("mdm")) return "MDM_REVIEW";
  if (combined.includes("specialist")) return "SPECIALIST_REVIEW";
  if (combined.includes("mandatory")) return "MANDATORY_CLINICIAN_CONFIRMATION";
  return "CLINICIAN_REVIEW";
}

function outcomeNodeType(rule: SourceRule): GraphNodeType {
  const outcome = `${rule.provisional_outcome} ${rule.timing_destination}`.toLowerCase();
  if (outcome.includes("mdm")) return "MDM_REVIEW";
  if (outcome.includes("urgent") || outcome.includes("suspected cancer") || outcome.includes("oncology")) {
    return "SAFETY_STOP";
  }
  if (outcome.includes("repeat") || outcome.includes("month") || outcome.includes("week") || outcome.includes("year")) {
    return "REPEAT_TIMER";
  }
  if (outcome.includes("refer") || outcome.includes("colposcopy") || outcome.includes("gynaecology")) {
    return "SPECIALIST_REFERRAL";
  }
  if (rule.automation_boundary.toLowerCase().includes("clinician")) return "CLINICIAN_REVIEW";
  return "TERMINAL";
}

function visualCategory(nodeType: GraphNodeType): string {
  switch (nodeType) {
    case "START":
    case "ROUTER":
      return "NAVY";
    case "DECISION":
      return "TEAL";
    case "SAFETY_STOP":
      return "RED";
    case "CLINICIAN_REVIEW":
      return "AMBER";
    case "MDM_REVIEW":
    case "SPECIALIST_REFERRAL":
      return "PURPLE";
    case "REPEAT_TIMER":
      return "CYAN";
    case "TERMINAL":
      return "GREEN";
    default:
      return "BLUE";
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseGraphvizPosition(value?: string): { x: number; y: number } | undefined {
  if (!value) return undefined;
  const match = value.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

async function loadVerifiedVisualPackage(
  sourceDirectory: string,
  sourceRuleIds: Set<string>
): Promise<VerifiedVisualPackage> {
  const directory = path.join(
    path.dirname(sourceDirectory),
    VERIFIED_VISUAL_PACKAGE_DIRECTORY
  );
  await access(path.join(directory, "manifest.json"));

  const checksumText = await readFile(path.join(directory, "SHA256SUMS.txt"), "utf8");
  const checksumEntries = checksumText
    .split(/\r?\n/)
    .map((line) => line.match(/^([a-f0-9]{64})\s+\.\/(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ checksum: match[1]!, relativePath: match[2]! }));
  if (checksumEntries.length === 0) {
    throw new Error("The verified v2.1.1 visual package has no SHA-256 entries.");
  }
  for (const entry of checksumEntries) {
    const buffer = await readFile(path.join(directory, entry.relativePath));
    const actual = createHash("sha256").update(buffer).digest("hex");
    if (actual !== entry.checksum) {
      throw new Error(
        `Verified visual package checksum mismatch for ${entry.relativePath}.`
      );
    }
  }

  const manifest = VerifiedVisualManifestSchema.parse(
    JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"))
  );
  const qa = VerifiedVisualQaSchema.parse(
    JSON.parse(await readFile(path.join(directory, "QA_VERIFICATION.json"), "utf8"))
  );
  if (Object.values(qa.criticalAssertions).some((value) => value !== true)) {
    throw new Error("A critical v2.1.1 visual-package assertion is not satisfied.");
  }

  const views = new Map<string, VerifiedVisualView>();
  const mappedRuleIds = new Set<string>();
  for (const view of manifest.views) {
    const viewDirectory = path.join(directory, "views", view.id);
    const meta = VerifiedVisualMetaSchema.parse(
      JSON.parse(await readFile(path.join(viewDirectory, "_meta.json"), "utf8"))
    );
    const ruleIds = z
      .array(z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]*$/))
      .length(view.ruleCount)
      .parse(
        JSON.parse(
          await readFile(
            path.join(viewDirectory, `${view.id}_rule_ids.json`),
            "utf8"
          )
        )
      );
    const unknownRuleIds = ruleIds.filter((ruleId) => !sourceRuleIds.has(ruleId));
    if (unknownRuleIds.length > 0) {
      throw new Error(
        `${view.id} contains unknown rule IDs: ${unknownRuleIds.join(", ")}.`
      );
    }
    ruleIds.forEach((ruleId) => mappedRuleIds.add(ruleId));

    const graph = GraphvizProjectionSchema.parse(
      JSON.parse(
        await readFile(
          path.join(viewDirectory, `${view.id}_graphviz.json`),
          "utf8"
        )
      )
    );
    const sourceFiles = checksumEntries
      .map((entry) => entry.relativePath)
      .filter((relativePath) => relativePath.startsWith(`views/${view.id}/`));
    if (
      meta.id !== view.id ||
      meta.ruleCount !== ruleIds.length ||
      meta.title !== view.title ||
      meta.description !== view.description
    ) {
      throw new Error(`${view.id} metadata does not match the verified manifest.`);
    }

    views.set(view.id, {
      id: view.id,
      title: view.title,
      description: view.description,
      clusters: [...view.clusters],
      ruleIds,
      verificationStatus: view.verificationStatus,
      graphObjects: graph.objects,
      sourceFiles,
    });
  }

  const unmappedRuleIds = [...sourceRuleIds].filter((ruleId) => !mappedRuleIds.has(ruleId));
  if (mappedRuleIds.size !== 203 || unmappedRuleIds.length > 0) {
    throw new Error(
      `Verified visual membership is incomplete: mapped=${mappedRuleIds.size}, missing=${unmappedRuleIds.join(",") || "none"}.`
    );
  }

  return {
    directory,
    version: manifest.visualVersion,
    verificationStatus: qa.status,
    sourceFiles: checksumEntries.map((entry) => entry.relativePath),
    masterFiles: [manifest.master.dot, manifest.master.svg, manifest.master.png],
    patches: [...qa.visualPatchesApplied],
    views,
  };
}

function buildRuleDefinition(rule: SourceRule): RuleDefinition {
  return {
    stableRuleId: rule.rule_id,
    section: rule.section,
    pathwayStage: rule.pathway_stage,
    conditionExpression: {
      type: "SOURCE_TEXT",
      text: rule.condition,
      executable: false,
      reviewReason:
        "The v2.1 bootstrap package supplies source-derived clinical prose, not a compiled Boolean expression. Clinician review is required until this condition is governed and encoded as a typed expression.",
    },
    sourceConditionText: rule.condition,
    requiredFacts: splitFacts(rule.required_facts),
    missingDataBehaviour: rule.missing_data_behavior,
    provisionalOutcome: rule.provisional_outcome,
    timingDestination: rule.timing_destination,
    careSetting: rule.care_setting,
    automationBoundary: rule.automation_boundary,
    reviewerRequirement: reviewerRequirement(rule),
    sourceReferences: [{ document: rule.source_document, reference: rule.source_reference }],
    updateStatus: rule.update_status,
    implementationNote: rule.implementation_note,
    safetyPriority: rule.safety_priority,
    executableTestIds: [],
  };
}

function buildCanonicalGraph(rules: RuleDefinition[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes: GraphNode[] = [
    {
      stableNodeId: "node:root",
      nodeType: "START",
      label: "CerviGrade NCSP master clinical router",
      shortLabel: "NCSP start",
      description: "Canonical entry point for every projected pathway view.",
      linkedRuleIds: [],
      requiredFacts: [],
      sourceReferences: [],
      icon: "play-circle",
      visualCategory: "NAVY",
      clinicalRisk: "HIGH",
      reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
      governance: {
        classification: "NATIONAL_SOURCE",
        reason: "Canonical source-derived master router",
        parentRuleIds: [],
        locallyModified: false,
      },
    },
  ];
  const edges: GraphEdge[] = [];
  const sections = Array.from(new Set(rules.map((rule) => rule.section)));

  sections.forEach((section, sectionIndex) => {
    const sectionNodeId = `node:section:${slug(section)}`;
    nodes.push({
      stableNodeId: sectionNodeId,
      nodeType: "ROUTER",
      label: section,
      shortLabel: section,
      description: `Canonical cluster router for ${section}.`,
      linkedRuleIds: rules.filter((rule) => rule.section === section).map((rule) => rule.stableRuleId),
      requiredFacts: [],
      sourceReferences: [],
      icon: "route",
      visualCategory: "NAVY",
      clinicalRisk: "HIGH",
      reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
      governance: {
        classification: "NATIONAL_SOURCE",
        reason: `Source-derived ${section} cluster`,
        parentRuleIds: [],
        locallyModified: false,
      },
    });
    edges.push({
      stableEdgeId: `edge:root:${slug(section)}`,
      fromNodeId: "node:root",
      toNodeId: sectionNodeId,
      label: section,
      conditionExpression: { type: "ALWAYS" },
      priority: sectionIndex,
      branchOrder: sectionIndex,
      isDefault: false,
      isSafetyOverride: section === "Global Router & Safety",
      allowsCycle: false,
      sourceRuleIds: [],
    });
  });

  rules.forEach((rule, ruleIndex) => {
    const decisionNodeId = `node:rule:${rule.stableRuleId}`;
    const outcomeNodeId = `node:outcome:${rule.stableRuleId}`;
    const outcomeType = outcomeNodeType({
      section: rule.section,
      rule_id: rule.stableRuleId,
      pathway_stage: rule.pathwayStage,
      condition: rule.sourceConditionText,
      required_facts: rule.requiredFacts.join("; "),
      missing_data_behavior: rule.missingDataBehaviour,
      provisional_outcome: rule.provisionalOutcome,
      timing_destination: rule.timingDestination,
      care_setting: rule.careSetting,
      automation_boundary: rule.automationBoundary,
      reviewer_requirement: rule.reviewerRequirement,
      source_document: rule.sourceReferences[0]?.document ?? "Source required",
      source_reference: rule.sourceReferences[0]?.reference ?? "Source required",
      update_status: rule.updateStatus,
      implementation_note: rule.implementationNote,
      safety_priority: rule.safetyPriority,
    });

    nodes.push({
      stableNodeId: decisionNodeId,
      nodeType: "DECISION",
      label: rule.sourceConditionText,
      shortLabel: rule.stableRuleId,
      description: rule.pathwayStage,
      linkedRuleIds: [rule.stableRuleId],
      requiredFacts: rule.requiredFacts,
      sourceReferences: rule.sourceReferences,
      icon: "git-branch",
      visualCategory: visualCategory("DECISION"),
      clinicalRisk: rule.safetyPriority,
      reviewerRequirement: rule.reviewerRequirement,
      governance: {
        classification: "NATIONAL_SOURCE",
        reason: "Imported from the verified v2.1 source package",
        parentRuleIds: [rule.stableRuleId],
        locallyModified: false,
      },
    });
    nodes.push({
      stableNodeId: outcomeNodeId,
      nodeType: outcomeType,
      label: rule.provisionalOutcome,
      shortLabel: `${rule.stableRuleId} outcome`,
      description: rule.timingDestination || rule.careSetting,
      linkedRuleIds: [rule.stableRuleId],
      requiredFacts: rule.requiredFacts,
      sourceReferences: rule.sourceReferences,
      icon: outcomeType.toLowerCase().replace(/_/g, "-"),
      visualCategory: visualCategory(outcomeType),
      clinicalRisk: rule.safetyPriority,
      reviewerRequirement: rule.reviewerRequirement,
      governance: {
        classification: "NATIONAL_SOURCE",
        reason: "Imported from the verified v2.1 source package",
        parentRuleIds: [rule.stableRuleId],
        locallyModified: false,
      },
      provisionalOutcome: rule.provisionalOutcome,
      timingDestination: rule.timingDestination,
    });
    edges.push({
      stableEdgeId: `edge:section:${rule.stableRuleId}`,
      fromNodeId: `node:section:${slug(rule.section)}`,
      toNodeId: decisionNodeId,
      label: rule.stableRuleId,
      conditionExpression: { type: "ALWAYS" },
      priority: ruleIndex,
      branchOrder: ruleIndex,
      isDefault: false,
      isSafetyOverride: rule.safetyPriority === "CRITICAL",
      allowsCycle: false,
      sourceRuleIds: [rule.stableRuleId],
    });
    edges.push({
      stableEdgeId: `edge:condition:${rule.stableRuleId}`,
      fromNodeId: decisionNodeId,
      toNodeId: outcomeNodeId,
      label: "Source condition met",
      conditionExpression: rule.conditionExpression,
      priority: 0,
      branchOrder: 0,
      isDefault: false,
      isSafetyOverride: rule.safetyPriority === "CRITICAL",
      allowsCycle: false,
      sourceRuleIds: [rule.stableRuleId],
    });
  });

  return { nodes, edges };
}

function layoutForView(nodeIds: string[], nodesById: Map<string, GraphNode>) {
  const layout: Record<string, { x: number; y: number }> = { "node:root": { x: 0, y: 0 } };
  const sectionIds = nodeIds.filter((id) => id.startsWith("node:section:"));
  sectionIds.forEach((id, index) => {
    layout[id] = { x: index * 620, y: 180 };
    const ruleIds = nodeIds.filter((candidate) => {
      const node = nodesById.get(candidate);
      if (!node || !candidate.startsWith("node:rule:")) return false;
      return node.linkedRuleIds.some((ruleId) =>
        nodesById.get(id)?.linkedRuleIds.includes(ruleId)
      );
    });
    ruleIds.forEach((ruleId, ruleIndex) => {
      const columnOffset = Math.floor(ruleIndex / 12) * 560;
      const row = ruleIndex % 12;
      layout[ruleId] = { x: index * 620 + columnOffset, y: 360 + row * 190 };
      const stableRuleId = ruleId.replace("node:rule:", "");
      layout[`node:outcome:${stableRuleId}`] = {
        x: index * 620 + columnOffset + 280,
        y: 360 + row * 190,
      };
    });
  });
  return layout;
}

function buildViews(rules: RuleDefinition[], nodes: GraphNode[], edges: GraphEdge[]): GraphView[] {
  const nodesById = new Map(nodes.map((node) => [node.stableNodeId, node]));
  const sections = Array.from(new Set(rules.map((rule) => rule.section)));

  function createView(args: {
    key: string;
    title: string;
    description: string;
    viewType: "MASTER" | "PATHWAY" | "OVERLAY";
    includedSections: string[];
    displayOrder: number;
  }): GraphView {
    const sectionSet = new Set(args.includedSections);
    const includedRuleIds = new Set(
      rules.filter((rule) => sectionSet.has(rule.section)).map((rule) => rule.stableRuleId)
    );
    const includedNodeIds = nodes
      .filter((node) => {
        if (node.stableNodeId === "node:root") return true;
        if (node.stableNodeId.startsWith("node:section:")) {
          return args.includedSections.some(
            (section) => node.stableNodeId === `node:section:${slug(section)}`
          );
        }
        return node.linkedRuleIds.some((ruleId) => includedRuleIds.has(ruleId));
      })
      .map((node) => node.stableNodeId);
    const nodeSet = new Set(includedNodeIds);
    const includedEdgeIds = edges
      .filter((edge) => nodeSet.has(edge.fromNodeId) && nodeSet.has(edge.toNodeId))
      .map((edge) => edge.stableEdgeId);

    return {
      key: args.key,
      title: args.title,
      description: args.description,
      viewType: args.viewType,
      includedNodeIds,
      includedEdgeIds,
      layout: layoutForView(includedNodeIds, nodesById),
      defaultZoom: args.viewType === "MASTER" ? 0.2 : 0.55,
      minimumZoom: 0.05,
      maximumZoom: 2.5,
      fitViewPadding: 0.15,
      displayOrder: args.displayOrder,
      legendConfiguration: {
        show: true,
        categories: ["NAVY", "TEAL", "BLUE", "AMBER", "PURPLE", "RED", "CYAN", "GREEN"],
      },
    };
  }

  return [
    createView({
      key: "master",
      title: "NCSP Master Decision Tree",
      description: "All source-derived v2.1 rules in one canonical graph projection.",
      viewType: "MASTER",
      includedSections: sections,
      displayOrder: 0,
    }),
    ...PATHWAY_VIEW_DEFINITIONS.map((definition, index) =>
      createView({
        key: definition.key,
        title: definition.title,
        description: definition.description,
        viewType: definition.viewType ?? "PATHWAY",
        includedSections: definition.sections,
        displayOrder: index + 1,
      })
    ),
  ];
}

const VERIFIED_LEGEND_LABELS = {
  NAVY: "Start and pathway router",
  TEAL: "Decision or process",
  BLUE: "Safety stop or information request",
  AMBER: "Clinician or MDM boundary",
  PURPLE: "Endpoint or linked subflow",
  RED: "Urgent pathway",
  CYAN: "Repeat or timed step",
  GREEN: "Current overlay guidance",
} as const;

function layoutFromVerifiedProjection(args: {
  view: VerifiedVisualView;
  includedNodeIds: string[];
  rulesById: Map<string, RuleDefinition>;
}) {
  const positions = args.view.graphObjects
    .map((object) => ({ name: object.name, position: parseGraphvizPosition(object.pos) }))
    .filter(
      (entry): entry is { name: string; position: { x: number; y: number } } =>
        Boolean(entry.position) &&
        !["LEGEND", "VIEW_NOTE"].includes(entry.name) &&
        !entry.name.startsWith("cluster_")
    );
  if (positions.length === 0) {
    throw new Error(`${args.view.id} has no readable Graphviz coordinates.`);
  }

  const maximumY = Math.max(...positions.map((entry) => entry.position.y));
  const minimumX = Math.min(...positions.map((entry) => entry.position.x));
  const maximumX = Math.max(...positions.map((entry) => entry.position.x));
  const scale = 0.82;
  const layout: Record<string, { x: number; y: number }> = {
    "node:root": { x: ((minimumX + maximumX) / 2) * scale, y: 0 },
  };
  const rulePositions = new Map<string, { x: number; y: number }>();

  args.view.ruleIds.forEach((ruleId, index) => {
    const anchorIndex =
      args.view.ruleIds.length === 1
        ? 0
        : Math.round((index * (positions.length - 1)) / (args.view.ruleIds.length - 1));
    const anchor = positions[anchorIndex]!.position;
    const position = {
      x: anchor.x * scale,
      y: (maximumY - anchor.y) * scale + 360,
    };
    rulePositions.set(ruleId, position);
    layout[`node:rule:${ruleId}`] = position;
    layout[`node:outcome:${ruleId}`] = { x: position.x + 300, y: position.y };
  });

  const representedSections = new Set(
    args.view.ruleIds.map((ruleId) => args.rulesById.get(ruleId)?.section).filter(Boolean)
  );
  for (const section of representedSections) {
    if (!section) continue;
    const sectionRulePositions = args.view.ruleIds
      .filter((ruleId) => args.rulesById.get(ruleId)?.section === section)
      .map((ruleId) => rulePositions.get(ruleId))
      .filter((position): position is { x: number; y: number } => Boolean(position));
    const averageX =
      sectionRulePositions.reduce((sum, position) => sum + position.x, 0) /
      Math.max(sectionRulePositions.length, 1);
    layout[`node:section:${slug(section)}`] = { x: averageX, y: 180 };
  }

  const missingLayout = args.includedNodeIds.filter((nodeId) => !layout[nodeId]);
  missingLayout.forEach((nodeId, index) => {
    layout[nodeId] = {
      x: minimumX * scale + (index % 4) * 460,
      y: (maximumY + 520 + Math.floor(index / 4) * 190) * scale,
    };
  });
  return layout;
}

function reconcileVerifiedVisualViews(args: {
  baseViews: GraphView[];
  rules: RuleDefinition[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  visualPackage: VerifiedVisualPackage;
}): GraphView[] {
  const rulesById = new Map(args.rules.map((rule) => [rule.stableRuleId, rule]));
  const updatedPathways = new Map<string, GraphView>();

  for (const definition of PATHWAY_VIEW_DEFINITIONS) {
    if (!definition.verifiedViewId) continue;
    const sourceView = args.visualPackage.views.get(definition.verifiedViewId);
    const baseView = args.baseViews.find((view) => view.key === definition.key);
    if (!sourceView || !baseView) {
      throw new Error(`Unable to reconcile verified view ${definition.key}.`);
    }
    const includedRuleIds = new Set(sourceView.ruleIds);
    const includedNodeIds = args.nodes
      .filter((node) => {
        // Canonical section routers link every rule in their section. They are
        // intentionally excluded from a verified standalone projection so a
        // view cannot accidentally claim rules absent from its v2.1.1 mapping.
        if (
          node.stableNodeId === "node:root" ||
          node.stableNodeId.startsWith("node:section:")
        ) {
          return false;
        }
        return node.linkedRuleIds.some((ruleId) => includedRuleIds.has(ruleId));
      })
      .map((node) => node.stableNodeId);
    const nodeSet = new Set(includedNodeIds);
    const includedEdgeIds = args.edges
      .filter((edge) => nodeSet.has(edge.fromNodeId) && nodeSet.has(edge.toNodeId))
      .map((edge) => edge.stableEdgeId);
    const table1Annotation =
      sourceView.id === "08_hysterectomy_vaginal_vault"
        ? [
            "The supplementary 08b Table 1 matrix is the readable 21-cell presentation; all T1-01 through T1-21 rules remain canonical members of this view.",
          ]
        : [];

    updatedPathways.set(definition.key, {
      ...baseView,
      title: sourceView.title,
      description: sourceView.description,
      includedNodeIds,
      includedEdgeIds,
      layout: layoutFromVerifiedProjection({
        view: sourceView,
        includedNodeIds,
        rulesById,
      }),
      legendConfiguration: {
        show: true,
        categories: Object.keys(VERIFIED_LEGEND_LABELS),
        labels: { ...VERIFIED_LEGEND_LABELS },
      },
      visualSource: {
        packageVersion: args.visualPackage.version,
        sourceViewId: sourceView.id,
        verificationStatus: sourceView.verificationStatus,
        sourceFiles: sourceView.sourceFiles,
        coordinateSystem: "Graphviz v2.1.1 positions projected into React Flow coordinates",
      },
      annotations: [
        `Canonical clusters: ${sourceView.clusters.join(", ")}.`,
        "View-only navigation and annotations do not own or change executable clinical logic.",
        ...table1Annotation,
      ],
    });
  }

  const masterBase = args.baseViews.find((view) => view.viewType === "MASTER");
  if (!masterBase) throw new Error("The canonical master view is missing.");
  const masterLayout: Record<string, { x: number; y: number }> = {
    "node:root": { x: 3600, y: 0 },
  };
  const pathwayViews = PATHWAY_VIEW_DEFINITIONS.filter(
    (definition) => definition.verifiedViewId
  ).map((definition) => updatedPathways.get(definition.key)!);
  pathwayViews.forEach((view, viewIndex) => {
    const offsetX = (viewIndex % 2) * 4400;
    const offsetY = Math.floor(viewIndex / 2) * 3600 + 320;
    for (const ruleId of args.visualPackage.views.get(
      PATHWAY_VIEW_DEFINITIONS.find((definition) => definition.key === view.key)!
        .verifiedViewId!
    )!.ruleIds) {
      for (const nodeId of [`node:rule:${ruleId}`, `node:outcome:${ruleId}`]) {
        if (masterLayout[nodeId]) continue;
        const local = view.layout[nodeId];
        if (local) masterLayout[nodeId] = { x: local.x + offsetX, y: local.y + offsetY };
      }
    }
  });
  for (const rule of args.rules) {
    if (!masterLayout[`node:rule:${rule.stableRuleId}`]) {
      const index = args.rules.indexOf(rule);
      masterLayout[`node:rule:${rule.stableRuleId}`] = {
        x: (index % 8) * 500,
        y: 18500 + Math.floor(index / 8) * 190,
      };
      masterLayout[`node:outcome:${rule.stableRuleId}`] = {
        x: (index % 8) * 500 + 280,
        y: 18500 + Math.floor(index / 8) * 190,
      };
    }
  }
  for (const section of new Set(args.rules.map((rule) => rule.section))) {
    const positions = args.rules
      .filter((rule) => rule.section === section)
      .map((rule) => masterLayout[`node:rule:${rule.stableRuleId}`]);
    masterLayout[`node:section:${slug(section)}`] = {
      x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
      y: Math.max(180, Math.min(...positions.map((position) => position.y)) - 150),
    };
  }

  const master: GraphView = {
    ...masterBase,
    title: "NCSP Master Decision Tree — verified visual projection v2.1.1",
    description:
      "All 203 canonical v2.1 rules composed from the ten verified v2.1.1 pathway projections; clinical conditions and outcomes remain owned by the v2.1 JSON.",
    layout: masterLayout,
    legendConfiguration: {
      show: true,
      categories: Object.keys(VERIFIED_LEGEND_LABELS),
      labels: { ...VERIFIED_LEGEND_LABELS },
    },
    visualSource: {
      packageVersion: args.visualPackage.version,
      sourceViewId: "verified-master",
      verificationStatus: args.visualPackage.verificationStatus,
      sourceFiles: args.visualPackage.masterFiles,
      coordinateSystem:
        "Verified pathway Graphviz positions composed into master React Flow coordinates",
    },
    annotations: [...args.visualPackage.patches],
  };

  return args.baseViews.map((view) => {
    if (view.viewType === "MASTER") return master;
    const verified = updatedPathways.get(view.key);
    if (verified) return verified;
    return {
      ...view,
      annotations: [
        "This canonical overlay has no standalone v2.1.1 visual file; its rules remain represented in the verified master and mapped pathway views.",
      ],
    };
  });
}

export type SourcePackageVerification = {
  sourceDirectory: string;
  sourceJsonPath: string;
  sourceJsonSha256: string;
  ruleCount: number;
  uniqueRuleCount: number;
  table1RuleCount: number;
  qaCorrectionCount: number;
  treeCoverageCount: number;
  requiredFiles: string[];
  visualPackageDirectory: string;
  visualPackageVersion: string;
  visualVerificationStatus: string;
  visualPackageFileCount: number;
};

export type BuiltSourceSnapshot = {
  snapshot: ClinicalRuleSnapshot;
  verification: SourcePackageVerification;
};

export async function resolveSourcePackageDirectory(explicitPath?: string): Promise<string> {
  const candidates = [
    explicitPath,
    path.join(process.cwd(), "docs/clinical-rules/source-v2.1"),
    path.join(
      process.cwd(),
      "docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1"
    ),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, REQUIRED_PACKAGE_FILES[0]));
      return candidate;
    } catch {
      // Continue through known equivalent package locations.
    }
  }

  throw new Error(
    `Unable to locate the v2.1 rule package. Checked: ${candidates.join(", ")}`
  );
}

export async function buildSnapshotFromV21Package(
  explicitPath?: string
): Promise<BuiltSourceSnapshot> {
  const sourceDirectory = await resolveSourcePackageDirectory(explicitPath);
  await Promise.all(
    REQUIRED_PACKAGE_FILES.map((file) => access(path.join(sourceDirectory, file)))
  );

  const sourceJsonPath = path.join(sourceDirectory, REQUIRED_PACKAGE_FILES[0]);
  const sourceJsonBuffer = await readFile(sourceJsonPath);
  const sourceJsonSha256 = createHash("sha256").update(sourceJsonBuffer).digest("hex");
  const source = SourcePackageSchema.parse(JSON.parse(sourceJsonBuffer.toString("utf8")));

  const ruleIds = source.rules.map((rule) => rule.rule_id);
  const uniqueRuleIds = new Set(ruleIds);
  if (uniqueRuleIds.size !== 203) {
    throw new Error(`Expected 203 unique rule IDs; found ${uniqueRuleIds.size}.`);
  }

  const table1RuleCount = source.rules.filter((rule) => rule.rule_id.startsWith("T1-")).length;
  if (table1RuleCount !== 21) {
    throw new Error(`Expected 21 Table 1 rules; found ${table1RuleCount}.`);
  }

  const requiredQaIds = Array.from({ length: 18 }, (_, index) =>
    `QA-${String(index + 1).padStart(2, "0")}`
  );
  for (const qaId of requiredQaIds) {
    if (source.qa_closure[qaId]?.toLowerCase() !== "closed") {
      throw new Error(`${qaId} is not represented as closed in the source JSON.`);
    }
  }

  const coverageCsv = await readFile(
    path.join(sourceDirectory, "CerviGrade_NCSP_Rule_Tree_Coverage_v2_1.csv"),
    "utf8"
  );
  const coverage = Papa.parse<{ rule_id?: string }>(coverageCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  if (coverage.errors.length > 0) {
    throw new Error(`Tree coverage CSV is invalid: ${coverage.errors[0]?.message}`);
  }
  const coverageRuleIds = coverage.data
    .map((row) => row.rule_id?.trim())
    .filter((ruleId): ruleId is string => Boolean(ruleId));
  const coverageSet = new Set(coverageRuleIds);
  const unresolvedCoverage = ruleIds.filter((ruleId) => !coverageSet.has(ruleId));
  const unknownCoverage = coverageRuleIds.filter((ruleId) => !uniqueRuleIds.has(ruleId));
  if (coverageRuleIds.length !== 203 || unresolvedCoverage.length || unknownCoverage.length) {
    throw new Error(
      `Tree coverage mismatch: rows=${coverageRuleIds.length}, missing=${unresolvedCoverage.join(",") || "none"}, unknown=${unknownCoverage.join(",") || "none"}.`
    );
  }

  const visualPackage = await loadVerifiedVisualPackage(sourceDirectory, uniqueRuleIds);
  const rules = source.rules.map(buildRuleDefinition).map(compileGovernedHighRiskRule);
  const { nodes, edges } = buildCanonicalGraph(rules);
  const views = reconcileVerifiedVisualViews({
    baseViews: buildViews(rules, nodes, edges),
    rules,
    nodes,
    edges,
    visualPackage,
  });

  const snapshot: ClinicalRuleSnapshot = {
    schemaVersion: CLINICAL_RULE_SNAPSHOT_SCHEMA_VERSION,
    engineContractVersion: CLINICAL_RULE_ENGINE_CONTRACT_VERSION,
    productRuleSet: {
      key: NATIONAL_RULE_SET_KEY,
      displayVersion: IMPORTED_PRODUCT_VERSION,
      name: "CerviGrade NCSP Rule Set v3.0.0",
    },
    sourcePackage: {
      version: source.version,
      generated: source.generated,
      status: source.status,
      sourceJsonSha256,
    },
    safetyNotices: [...REQUIRED_SAFETY_NOTICES],
    rules,
    nodes,
    edges,
    views,
    sources: source.sources,
    immuneClassifier: source.immune_classifier.map((entry) => ({
      classification: entry.classification,
      conditionOrMedication: entry.condition_or_medication,
      thresholdOrDuration: entry.threshold_or_duration,
      softwareResult: entry.software_result,
      notes: entry.notes,
    })),
    sourcePageRegister: source.source_page_register.map((entry) => ({
      sourceItem: entry.source_item,
      printedPage: entry.printed_page,
      pdfPageNumber1Based: entry.pdf_page_number_1_based,
    })),
    qaClosure: Object.fromEntries(requiredQaIds.map((qaId) => [qaId, "closed" as const])),
    importEvidence: {
      expectedRuleCount: 203,
      table1RuleCount: 21,
      treeCoverageRuleIds: coverageRuleIds,
      sourceFiles: [...REQUIRED_PACKAGE_FILES],
      visualPackageVersion: visualPackage.version,
      visualVerificationStatus: visualPackage.verificationStatus,
      visualPackageFiles: visualPackage.sourceFiles,
    },
  };

  return {
    snapshot,
    verification: {
      sourceDirectory,
      sourceJsonPath,
      sourceJsonSha256,
      ruleCount: source.rules.length,
      uniqueRuleCount: uniqueRuleIds.size,
      table1RuleCount,
      qaCorrectionCount: requiredQaIds.length,
      treeCoverageCount: coverageRuleIds.length,
      requiredFiles: [...REQUIRED_PACKAGE_FILES],
      visualPackageDirectory: visualPackage.directory,
      visualPackageVersion: visualPackage.version,
      visualVerificationStatus: visualPackage.verificationStatus,
      visualPackageFileCount: visualPackage.sourceFiles.length,
    },
  };
}

export type { SourcePackage };
