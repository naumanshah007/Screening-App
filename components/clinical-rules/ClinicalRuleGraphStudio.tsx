"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Expand,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  Maximize2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  ClinicalRuleSnapshot,
  ConditionExpression,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  GraphView,
  ReviewerRequirement,
  SafetyPriority,
  SourceReference,
} from "@/lib/clinical-rules/schema";

type FlowNodeData = {
  canonical: GraphNode;
  highlighted: boolean;
  dimmed: boolean;
};

type InspectorTab = "display" | "condition" | "outcome" | "safety" | "source" | "layout" | "audit";

const NODE_META: Record<GraphNodeType, { label: string; classes: string }> = {
  START: { label: "Start", classes: "border-navy-600 bg-navy-50" },
  ROUTER: { label: "Router", classes: "border-navy-600 bg-navy-50" },
  DECISION: { label: "Decision", classes: "border-brand-600 bg-brand-50" },
  ACTION: { label: "Action", classes: "border-sky-600 bg-sky-50" },
  REPEAT_TIMER: { label: "Repeat / timer", classes: "border-cyan-600 bg-cyan-50" },
  SAFETY_STOP: { label: "Safety stop", classes: "border-red-600 bg-red-50" },
  CLINICIAN_REVIEW: { label: "Clinician review", classes: "border-amber-600 bg-amber-50" },
  MDM_REVIEW: { label: "MDM review", classes: "border-purple-600 bg-purple-50" },
  SPECIALIST_REFERRAL: { label: "Specialist referral", classes: "border-purple-600 bg-purple-50" },
  SUBFLOW_LINK: { label: "Subflow", classes: "border-indigo-600 bg-indigo-50" },
  TERMINAL: { label: "Terminal", classes: "border-emerald-600 bg-emerald-50" },
  INFORMATION: { label: "Information", classes: "border-slate-500 bg-slate-50" },
};

const NODE_TYPES = Object.keys(NODE_META) as GraphNodeType[];
const RISK_LEVELS: SafetyPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const REVIEWER_REQUIREMENTS: ReviewerRequirement[] = [
  "MANDATORY_CLINICIAN_CONFIRMATION",
  "CLINICIAN_REVIEW",
  "MDM_REVIEW",
  "SPECIALIST_REVIEW",
];

function RuleNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const meta = NODE_META[data.canonical.nodeType];
  return (
    <div
      aria-label={`${meta.label}: ${data.canonical.label}`}
      className={cn(
        "relative w-[250px] rounded-xl border-2 bg-white px-3 py-3 shadow-sm transition-all",
        meta.classes,
        selected && "ring-4 ring-brand-400/30 shadow-lg",
        data.highlighted && "ring-4 ring-purple-400/25",
        data.dimmed && "opacity-25"
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-navy-600" />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-md bg-white/80 p-1 text-navy-700" aria-hidden>
          {data.canonical.nodeType === "SAFETY_STOP" ? (
            <ShieldAlert className="h-4 w-4" />
          ) : data.canonical.nodeType === "TERMINAL" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              {meta.label}
            </span>
            {data.canonical.clinicalRisk === "CRITICAL" && (
              <span className="rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-800">
                CRITICAL
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-4 text-xs font-semibold leading-4 text-slate-900">
            {data.canonical.label}
          </p>
          {data.canonical.linkedRuleIds.length > 0 && (
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              {data.canonical.linkedRuleIds.join(", ")}
            </p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-brand-600" />
    </div>
  );
}

const nodeTypes = { ruleNode: RuleNode };

function createFlowNode(
  canonical: GraphNode,
  view: GraphView,
  highlightedIds: Set<string>,
  hasHighlight: boolean,
  editable: boolean
): Node<FlowNodeData> {
  return {
    id: canonical.stableNodeId,
    type: "ruleNode",
    position: view.layout[canonical.stableNodeId] ?? { x: 0, y: 0 },
    data: {
      canonical,
      highlighted: highlightedIds.has(canonical.stableNodeId),
      dimmed: hasHighlight && !highlightedIds.has(canonical.stableNodeId),
    },
    draggable: editable,
    deletable: false,
    ariaLabel: `${canonical.nodeType}: ${canonical.label}`,
  };
}

function edgeColour(edge: GraphEdge) {
  if (edge.isSafetyOverride) return "#dc2626";
  if (edge.conditionExpression.type === "SOURCE_TEXT") return "#d97706";
  return "#334155";
}

function createFlowEdge(
  canonical: GraphEdge,
  highlightedIds: Set<string>,
  hasHighlight: boolean
): Edge<{ canonical: GraphEdge }> {
  const highlighted = highlightedIds.has(canonical.stableEdgeId);
  return {
    id: canonical.stableEdgeId,
    source: canonical.fromNodeId,
    target: canonical.toNodeId,
    label: canonical.label,
    data: { canonical },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColour(canonical) },
    style: {
      stroke: highlighted ? "#7c3aed" : edgeColour(canonical),
      strokeWidth: highlighted ? 3.5 : 1.8,
      opacity: hasHighlight && !highlighted ? 0.16 : 1,
      strokeDasharray: canonical.conditionExpression.type === "SOURCE_TEXT" ? "7 5" : undefined,
    },
    labelStyle: { fontSize: 10, fontWeight: 600, fill: "#334155" },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.88 },
    reconnectable: true,
  };
}

function graphAncestorsAndDescendants(
  selectedNodeId: string | null,
  edges: GraphEdge[]
): Set<string> {
  if (!selectedNodeId) return new Set();
  const highlighted = new Set<string>([selectedNodeId]);

  const ancestorNodes = new Set<string>([selectedNodeId]);
  const ancestorQueue = [selectedNodeId];
  while (ancestorQueue.length > 0) {
    const nodeId = ancestorQueue.shift();
    if (!nodeId) continue;
    for (const edge of edges) {
      if (edge.toNodeId !== nodeId) continue;
      highlighted.add(edge.stableEdgeId);
      highlighted.add(edge.fromNodeId);
      if (!ancestorNodes.has(edge.fromNodeId)) {
        ancestorNodes.add(edge.fromNodeId);
        ancestorQueue.push(edge.fromNodeId);
      }
    }
  }

  const descendantNodes = new Set<string>([selectedNodeId]);
  const descendantQueue = [selectedNodeId];
  while (descendantQueue.length > 0) {
    const nodeId = descendantQueue.shift();
    if (!nodeId) continue;
    for (const edge of edges) {
      if (edge.fromNodeId !== nodeId) continue;
      highlighted.add(edge.stableEdgeId);
      highlighted.add(edge.toNodeId);
      if (!descendantNodes.has(edge.toNodeId)) {
        descendantNodes.add(edge.toNodeId);
        descendantQueue.push(edge.toNodeId);
      }
    }
  }

  return highlighted;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitiseGraphExportMarkup(markup: string) {
  const parsed = new DOMParser().parseFromString(`<div>${markup}</div>`, "text/html");
  parsed.querySelectorAll("script, iframe, object, embed, link, meta").forEach((element) => element.remove());
  parsed.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const value = attribute.value.trim();
      if (
        /^on/i.test(attribute.name) ||
        (/^(href|src|xlink:href)$/i.test(attribute.name) && /^javascript:/i.test(value)) ||
        (attribute.name === "style" && /(?:javascript:|expression\s*\()/i.test(value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return parsed.body.firstElementChild?.innerHTML ?? "";
}

function ClinicalRuleGraphStudioInner({
  versionId,
  initialSnapshot,
  initialRevision,
  editable,
}: {
  versionId: string;
  initialSnapshot: ClinicalRuleSnapshot;
  initialRevision: number;
  editable: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(initialRevision);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [revision, setRevision] = useState(initialRevision);
  const [currentViewKey, setCurrentViewKey] = useState(
    initialSnapshot.views.find((view) => view.viewType === "MASTER")?.key ?? initialSnapshot.views[0]!.key
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("display");
  const [search, setSearch] = useState("");
  const [highlightBranch, setHighlightBranch] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Array<Record<string, unknown>>>([]);
  const { fitView, setCenter } = useReactFlow();

  const currentView =
    snapshot.views.find((view) => view.key === currentViewKey) ?? snapshot.views[0]!;
  const visibleNodeIds = useMemo(() => {
    if (!collapsed) return new Set(currentView.includedNodeIds);
    return new Set(
      currentView.includedNodeIds.filter((id) => id === "node:root" || id.startsWith("node:section:"))
    );
  }, [collapsed, currentView]);
  const visibleEdges = useMemo(
    () =>
      snapshot.edges.filter(
        (edge) =>
          currentView.includedEdgeIds.includes(edge.stableEdgeId) &&
          visibleNodeIds.has(edge.fromNodeId) &&
          visibleNodeIds.has(edge.toNodeId)
      ),
    [currentView, snapshot.edges, visibleNodeIds]
  );
  const highlightedIds = useMemo(
    () => (highlightBranch ? graphAncestorsAndDescendants(selectedNodeId, visibleEdges) : new Set<string>()),
    [highlightBranch, selectedNodeId, visibleEdges]
  );
  const hasHighlight = highlightedIds.size > 0;

  const canonicalNodes = useMemo(
    () => snapshot.nodes.filter((node) => visibleNodeIds.has(node.stableNodeId)),
    [snapshot.nodes, visibleNodeIds]
  );
  const baseNodes = useMemo(
    () => canonicalNodes.map((node) => createFlowNode(node, currentView, highlightedIds, hasHighlight, editable)),
    [canonicalNodes, currentView, editable, hasHighlight, highlightedIds]
  );
  const baseEdges = useMemo(
    () => visibleEdges.map((edge) => createFlowEdge(edge, highlightedIds, hasHighlight)),
    [hasHighlight, highlightedIds, visibleEdges]
  );
  const [nodes, setNodes] = useState(baseNodes);
  const [edges, setEdges] = useState(baseEdges);

  useEffect(() => setNodes(baseNodes), [baseNodes]);
  useEffect(() => setEdges(baseEdges), [baseEdges]);
  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    requestAnimationFrame(() => fitView({ padding: currentView.fitViewPadding, duration: 350 }));
  }, [currentView.fitViewPadding, currentView.key, fitView]);

  const selectedNode = snapshot.nodes.find((node) => node.stableNodeId === selectedNodeId) ?? null;
  const selectedEdge = snapshot.edges.find((edge) => edge.stableEdgeId === selectedEdgeId) ?? null;
  const linkedRule = selectedNode?.linkedRuleIds[0]
    ? snapshot.rules.find((rule) => rule.stableRuleId === selectedNode.linkedRuleIds[0]) ?? null
    : null;

  const updateSnapshot = useCallback((updater: (current: ClinicalRuleSnapshot) => ClinicalRuleSnapshot) => {
    dirtyRef.current = true;
    setSnapshot((current) => updater(structuredClone(current)));
  }, []);

  const saveDraft = useCallback(
    async (checkpoint = false) => {
      if (!editable || savingRef.current || !dirtyRef.current) return;
      savingRef.current = true;
      setSaving(true);
      try {
        const response = await fetch(`/api/clinical-rules/versions/${versionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: revisionRef.current,
            snapshot,
            checkpoint,
            changeSummary: checkpoint ? "Named Rule Studio checkpoint" : undefined,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to save the draft");
        revisionRef.current = body.version.revision;
        setRevision(body.version.revision);
        dirtyRef.current = false;
        if (checkpoint) toast.success(`Checkpoint saved at revision ${body.version.revision}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save the draft");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [editable, snapshot, versionId]
  );

  useEffect(() => {
    if (!editable || !dirtyRef.current) return;
    const timeout = window.setTimeout(() => void saveDraft(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [editable, saveDraft, snapshot]);

  const mutateNode = useCallback(
    (nodeId: string, changes: Partial<GraphNode>) => {
      updateSnapshot((next) => {
        const index = next.nodes.findIndex((node) => node.stableNodeId === nodeId);
        if (index < 0) return next;
        const previous = next.nodes[index]!;
        const updated = { ...previous, ...changes };
        next.nodes[index] = updated;
        const ruleId = updated.linkedRuleIds[0];
        const rule = ruleId ? next.rules.find((candidate) => candidate.stableRuleId === ruleId) : undefined;
        if (rule) {
          if (updated.nodeType === "DECISION" && changes.label !== undefined) {
            rule.sourceConditionText = updated.label;
            if (rule.conditionExpression.type === "SOURCE_TEXT") {
              rule.conditionExpression.text = updated.label;
            }
          }
          if (updated.stableNodeId.startsWith("node:outcome:") && changes.label !== undefined) {
            rule.provisionalOutcome = updated.label;
          }
          if (changes.requiredFacts) rule.requiredFacts = changes.requiredFacts;
          if (changes.sourceReferences) rule.sourceReferences = changes.sourceReferences;
          if (changes.reviewerRequirement) rule.reviewerRequirement = changes.reviewerRequirement;
          if (changes.clinicalRisk) rule.safetyPriority = changes.clinicalRisk;
          if (changes.provisionalOutcome !== undefined) rule.provisionalOutcome = changes.provisionalOutcome;
          if (changes.timingDestination !== undefined) rule.timingDestination = changes.timingDestination;
        }
        return next;
      });
    },
    [updateSnapshot]
  );

  const mutateEdge = useCallback(
    (edgeId: string, changes: Partial<GraphEdge>) => {
      updateSnapshot((next) => {
        const index = next.edges.findIndex((edge) => edge.stableEdgeId === edgeId);
        if (index >= 0) next.edges[index] = { ...next.edges[index]!, ...changes };
        return next;
      });
    },
    [updateSnapshot]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => setNodes((current) => applyNodeChanges(changes, current)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge<{ canonical: GraphEdge }>>[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    []
  );
  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node<FlowNodeData>) => {
      if (!editable) return;
      updateSnapshot((next) => {
        const view = next.views.find((candidate) => candidate.key === currentViewKey);
        if (view) view.layout[node.id] = node.position;
        return next;
      });
    },
    [currentViewKey, editable, updateSnapshot]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!editable || !connection.source || !connection.target) return;
      const id = `edge:local:${crypto.randomUUID()}`;
      const canonical: GraphEdge = {
        stableEdgeId: id,
        fromNodeId: connection.source,
        toNodeId: connection.target,
        label: "New governed branch",
        conditionExpression: {
          type: "SOURCE_TEXT",
          text: "Define a governed typed branch condition",
          executable: false,
          reviewReason: "New edges remain non-executable until validated and clinically approved.",
        },
        priority: 0,
        branchOrder: 0,
        isDefault: false,
        isSafetyOverride: false,
        allowsCycle: false,
        sourceRuleIds: [],
      };
      updateSnapshot((next) => {
        next.edges.push(canonical);
        next.views.find((view) => view.key === currentViewKey)?.includedEdgeIds.push(id);
        return next;
      });
      setEdges((current) => addEdge(createFlowEdge(canonical, new Set(), false), current));
      setSelectedEdgeId(id);
      setSelectedNodeId(null);
    },
    [currentViewKey, editable, updateSnapshot]
  );
  const onReconnect = useCallback(
    (oldEdge: Edge<{ canonical: GraphEdge }>, connection: Connection) => {
      if (!editable || !connection.source || !connection.target) return;
      setEdges((current) => reconnectEdge(oldEdge, connection, current));
      mutateEdge(oldEdge.id, { fromNodeId: connection.source, toNodeId: connection.target });
    },
    [editable, mutateEdge]
  );

  const addNodeToView = useCallback(() => {
    if (!editable) return;
    const id = `node:local:${crypto.randomUUID()}`;
    const canonical: GraphNode = {
      stableNodeId: id,
      nodeType: "INFORMATION",
      label: "New governed node",
      shortLabel: "New node",
      description: "Add a source or explicit local-governance designation before publication.",
      linkedRuleIds: [],
      requiredFacts: [],
      sourceReferences: [],
      icon: "circle-plus",
      visualCategory: "BLUE",
      clinicalRisk: "HIGH",
      reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
      governance: {
        classification: "LOCAL_CLINICAL_FORK",
        reason: "",
        parentRuleIds: [],
        locallyModified: true,
      },
    };
    updateSnapshot((next) => {
      next.nodes.push(canonical);
      const view = next.views.find((candidate) => candidate.key === currentViewKey)!;
      view.includedNodeIds.push(id);
      view.layout[id] = { x: 220, y: 220 };
      return next;
    });
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, [currentViewKey, editable, updateSnapshot]);

  const duplicateSelectedNode = useCallback(() => {
    if (!editable || !selectedNode) return;
    const id = `node:local:${crypto.randomUUID()}`;
    const duplicate: GraphNode = {
      ...structuredClone(selectedNode),
      stableNodeId: id,
      label: `${selectedNode.label} (copy)`,
      shortLabel: `${selectedNode.shortLabel} copy`,
      linkedRuleIds: [],
      sourceReferences: [],
      reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
      governance: {
        classification: "LOCAL_CLINICAL_FORK",
        reason: "",
        parentRuleIds: selectedNode.linkedRuleIds,
        locallyModified: true,
      },
    };
    updateSnapshot((next) => {
      next.nodes.push(duplicate);
      const view = next.views.find((candidate) => candidate.key === currentViewKey)!;
      view.includedNodeIds.push(id);
      const position = view.layout[selectedNode.stableNodeId] ?? { x: 0, y: 0 };
      view.layout[id] = { x: position.x + 80, y: position.y + 80 };
      return next;
    });
    setSelectedNodeId(id);
  }, [currentViewKey, editable, selectedNode, updateSnapshot]);

  const deleteSelectedNode = useCallback(() => {
    if (!editable || !selectedNode) return;
    const connected = snapshot.edges.some(
      (edge) => edge.fromNodeId === selectedNode.stableNodeId || edge.toNodeId === selectedNode.stableNodeId
    );
    if (selectedNode.linkedRuleIds.length || connected || selectedNode.nodeType === "START") {
      toast.error("Only an unused, unlinked node with no edges can be deleted.");
      return;
    }
    updateSnapshot((next) => {
      next.nodes = next.nodes.filter((node) => node.stableNodeId !== selectedNode.stableNodeId);
      for (const view of next.views) {
        view.includedNodeIds = view.includedNodeIds.filter((id) => id !== selectedNode.stableNodeId);
        delete view.layout[selectedNode.stableNodeId];
      }
      return next;
    });
    setSelectedNodeId(null);
  }, [editable, selectedNode, snapshot.edges, updateSnapshot]);

  const deleteSelectedEdge = useCallback(() => {
    if (!editable || !selectedEdge) return;
    updateSnapshot((next) => {
      next.edges = next.edges.filter((edge) => edge.stableEdgeId !== selectedEdge.stableEdgeId);
      for (const view of next.views) {
        view.includedEdgeIds = view.includedEdgeIds.filter((id) => id !== selectedEdge.stableEdgeId);
      }
      return next;
    });
    setSelectedEdgeId(null);
  }, [editable, selectedEdge, updateSnapshot]);

  const autoLayout = useCallback(async (scope: "VIEW" | "BRANCH" = "VIEW") => {
    const layoutNodes = scope === "BRANCH"
      ? nodes.filter((node) => highlightedIds.has(node.id))
      : nodes;
    const layoutNodeIds = new Set(layoutNodes.map((node) => node.id));
    const layoutEdges = scope === "BRANCH"
      ? edges.filter((edge) => layoutNodeIds.has(edge.source) && layoutNodeIds.has(edge.target))
      : edges;
    if (layoutNodes.length < 2) {
      toast.error("Select a connected branch before laying out the branch.");
      return;
    }
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const elk = new ELK();
    const result = await elk.layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "60",
        "elk.layered.spacing.nodeNodeBetweenLayers": "110",
      },
      children: layoutNodes.map((node) => ({ id: node.id, width: 250, height: 120 })),
      edges: layoutEdges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
    });
    updateSnapshot((next) => {
      const view = next.views.find((candidate) => candidate.key === currentViewKey)!;
      for (const child of result.children ?? []) {
        view.layout[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
      }
      return next;
    });
    if (scope === "VIEW") {
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 450 }));
    }
  }, [currentViewKey, edges, fitView, highlightedIds, nodes, updateSnapshot]);

  const focusSearchResult = useCallback(() => {
    const query = search.trim().toLowerCase();
    if (!query) return;
    const found = canonicalNodes.find((node) =>
      [
        node.label,
        node.shortLabel,
        node.description,
        ...node.linkedRuleIds,
        ...node.sourceReferences.flatMap((source) => [source.document, source.reference]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
    if (!found) {
      toast.error("No matching node, rule ID, or source reference in this view.");
      return;
    }
    const position = currentView.layout[found.stableNodeId] ?? { x: 0, y: 0 };
    setSelectedNodeId(found.stableNodeId);
    setSelectedEdgeId(null);
    setCenter(position.x + 125, position.y + 60, { zoom: 1.2, duration: 450 });
  }, [canonicalNodes, currentView.layout, search, setCenter]);

  const exportCurrentView = useCallback(
    async (format: "svg" | "png") => {
      const viewport = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!viewport) return;
      const bounds = viewport.getBoundingClientRect();
      const serialised = sanitiseGraphExportMarkup(
        new XMLSerializer().serializeToString(viewport)
      );
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}"><rect width="100%" height="100%" fill="#f8fafc"/><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialised}</div></foreignObject></svg>`;
      if (format === "svg") {
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${currentView.key}.svg`);
        return;
      }
      const image = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(bounds.width * 2);
        canvas.height = Math.ceil(bounds.height * 2);
        const context = canvas.getContext("2d")!;
        context.scale(2, 2);
        context.drawImage(image, 0, 0);
        canvas.toBlob((blob) => blob && downloadBlob(blob, `${currentView.key}.png`), "image/png");
        URL.revokeObjectURL(url);
      };
      image.src = url;
    },
    [currentView.key]
  );

  const validateDraft = useCallback(async () => {
    if (dirtyRef.current) await saveDraft(true);
    setValidating(true);
    try {
      const response = await fetch(`/api/clinical-rules/versions/${versionId}/validate`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Validation failed");
      toast[body.report.valid ? "success" : "warning"](
        body.report.valid
          ? "Validation passed"
          : `${body.report.counts.errors} publication blockers remain`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to validate the draft");
    } finally {
      setValidating(false);
    }
  }, [saveDraft, versionId]);

  useEffect(() => {
    if (inspectorTab !== "audit") return;
    void fetch(`/api/clinical-rules/versions/${versionId}/audit`)
      .then((response) => response.json())
      .then((body) => setAuditEvents(body.events ?? []));
  }, [inspectorTab, versionId]);

  return (
    <div ref={wrapperRef} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-navy-800 via-navy-700 to-brand-800 px-4 py-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
              <GitBranch className="h-4 w-4" /> Canonical graph studio
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span>{snapshot.rules.length} rules</span><span>·</span><span>{snapshot.nodes.length} nodes</span><span>·</span><span>{snapshot.views.length} synchronized views</span><span>·</span><span>revision {revision}</span>
              {!editable && <Badge variant="info">Read only</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <>
                <Button size="sm" variant="outline" onClick={() => void saveDraft(true)} loading={saving} icon={<Save className="h-4 w-4" />}>Save checkpoint</Button>
                <Button size="sm" variant="warning" onClick={() => void validateDraft()} loading={validating} icon={<FileCheck2 className="h-4 w-4" />}>Validate</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => void exportCurrentView("svg")} icon={<Download className="h-4 w-4" />}>SVG</Button>
            <Button size="sm" variant="outline" onClick={() => void exportCurrentView("png")} icon={<Download className="h-4 w-4" />}>PNG</Button>
            <Button size="icon" variant="outline" aria-label="Print current view" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Open full screen" onClick={() => wrapperRef.current?.requestFullscreen()}><Maximize2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 border-b border-border bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {[...snapshot.views].sort((a, b) => a.displayOrder - b.displayOrder).map((view) => (
            <button
              key={view.key}
              onClick={() => setCurrentViewKey(view.key)}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition",
                currentView.key === view.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-border bg-white text-slate-700 hover:border-brand-300"
              )}
            >
              {view.viewType === "MASTER" ? "Master tree" : view.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[720px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px]">
        <p id="clinical-graph-summary" className="sr-only" aria-live="polite">
          {currentView.title}. {nodes.length} visible nodes and {edges.length} visible edges.
          {selectedNode ? ` Selected node ${selectedNode.shortLabel}.` : " No node selected."}
          {selectedEdge ? ` Selected edge ${selectedEdge.label}.` : ""}
          Use Tab to move through graph elements and Enter or Space to select one.
        </p>
        <div ref={flowRef} className="relative h-[720px] min-h-[720px] w-full bg-slate-50 print:h-[900px] print:min-h-[900px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={(_event, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
            onEdgeClick={(_event, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                const target = event.target as HTMLElement;
                const node = target.closest<HTMLElement>(".react-flow__node[data-id]");
                const edge = target.closest<HTMLElement>(".react-flow__edge[data-id]");
                if (node?.dataset.id) {
                  event.preventDefault();
                  setSelectedNodeId(node.dataset.id);
                  setSelectedEdgeId(null);
                } else if (edge?.dataset.id) {
                  event.preventDefault();
                  setSelectedEdgeId(edge.dataset.id);
                  setSelectedNodeId(null);
                }
              }
            }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            minZoom={currentView.minimumZoom}
            maxZoom={currentView.maximumZoom}
            fitView
            fitViewOptions={{ padding: currentView.fitViewPadding }}
            nodesConnectable={editable}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            aria-label={`${currentView.title} interactive clinical rule graph`}
            aria-describedby="clinical-graph-summary"
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
            <Controls showInteractive position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeColor={(node) => {
                const category = (node.data as FlowNodeData).canonical.visualCategory;
                return category === "RED" ? "#dc2626" : category === "GREEN" ? "#16a34a" : category === "PURPLE" ? "#7c3aed" : category === "AMBER" ? "#d97706" : "#0f766e";
              }}
            />
            <Panel position="top-left" className="m-3 rounded-xl border border-border bg-white/95 p-2 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-[280px] max-w-[45vw]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && focusSearchResult()}
                    placeholder="Node, rule ID, source reference…"
                    aria-label="Search the current graph"
                    className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={focusSearchResult}>Find</Button>
                <Button size="sm" variant={collapsed ? "secondary" : "outline"} onClick={() => setCollapsed((value) => !value)} icon={<Expand className="h-4 w-4" />}>
                  {collapsed ? "Expand clusters" : "Collapse clusters"}
                </Button>
                <Button size="sm" variant={highlightBranch ? "secondary" : "outline"} onClick={() => setHighlightBranch((value) => !value)}>Highlight routes</Button>
                <Button size="sm" variant="outline" onClick={() => fitView({ padding: currentView.fitViewPadding, duration: 350 })} icon={<RotateCcw className="h-4 w-4" />}>Reset view</Button>
                {editable && (
                  <>
                    <Button size="sm" variant="outline" onClick={addNodeToView} icon={<Plus className="h-4 w-4" />}>Node</Button>
                    {selectedNode && <Button size="sm" variant="outline" onClick={() => void autoLayout("BRANCH")} icon={<LayoutDashboard className="h-4 w-4" />}>Layout branch</Button>}
                    <Button size="sm" variant="outline" onClick={() => void autoLayout("VIEW")} icon={<LayoutDashboard className="h-4 w-4" />}>Auto-layout view</Button>
                  </>
                )}
              </div>
            </Panel>
            <Panel position="bottom-center" className="mb-3 rounded-full border border-border bg-white/95 px-4 py-2 text-[11px] text-slate-600 shadow">
              Navy router · Teal decision · Amber review/non-executable · Purple specialist/MDM · Red urgent safety · Cyan repeat · Green terminal
            </Panel>
          </ReactFlow>
        </div>

        <aside className="min-h-0 border-l border-border bg-white xl:max-h-[820px] xl:overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-border bg-white px-4 py-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{currentView.title}</span><ChevronRight className="h-3 w-3" /><span className="truncate font-semibold text-foreground">{selectedNode?.shortLabel ?? selectedEdge?.label ?? "Select a node or edge"}</span>
            </div>
          </div>

          {!selectedNode && !selectedEdge ? (
            <div className="p-6">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <GitBranch className="mx-auto h-8 w-8 text-brand-600" />
                <h3 className="mt-3 font-semibold text-slate-900">Select a node or branch</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The inspector keeps display, condition, outcome, safety, source and layout editing out of cramped graph labels.</p>
              </div>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Safety boundary</div>
                <p className="mt-2">Source-text conditions are visible but non-executable. Unknown never becomes false or normal. Publication requires all validation blockers to be resolved.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
                {(["display", "condition", "outcome", "safety", "source", "layout", "audit"] as InspectorTab[]).map((tab) => (
                  <button key={tab} onClick={() => setInspectorTab(tab)} className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize", inspectorTab === tab ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{tab}</button>
                ))}
              </div>
              <div className="space-y-4 p-4">
                {inspectorTab === "display" && selectedNode && (
                  <>
                    <Select label="Node type" value={selectedNode.nodeType} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { nodeType: event.target.value as GraphNodeType })} options={NODE_TYPES.map((type) => ({ value: type, label: NODE_META[type].label }))} />
                    <Textarea label="Node label" rows={4} value={selectedNode.label} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { label: event.target.value })} />
                    <Input label="Short label" value={selectedNode.shortLabel} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { shortLabel: event.target.value })} />
                    <Textarea label="Explanatory text" rows={5} value={selectedNode.description} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { description: event.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!editable} onClick={duplicateSelectedNode} icon={<Copy className="h-4 w-4" />}>Duplicate</Button>
                      <Button size="sm" variant="danger" disabled={!editable} onClick={deleteSelectedNode} icon={<Trash2 className="h-4 w-4" />}>Delete unused</Button>
                    </div>
                  </>
                )}
                {inspectorTab === "display" && selectedEdge && (
                  <>
                    <Input label="Branch label" value={selectedEdge.label} disabled={!editable} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { label: event.target.value })} />
                    <Input label="Stable edge ID" value={selectedEdge.stableEdgeId} disabled />
                    <Button size="sm" variant="danger" disabled={!editable} onClick={deleteSelectedEdge} icon={<Trash2 className="h-4 w-4" />}>Delete edge</Button>
                  </>
                )}

                {inspectorTab === "condition" && (
                  <ConditionEditor
                    expression={selectedEdge?.conditionExpression ?? linkedRule?.conditionExpression}
                    editable={editable}
                    sourceText={linkedRule?.sourceConditionText}
                    onChange={(expression) => {
                      if (selectedEdge) mutateEdge(selectedEdge.stableEdgeId, { conditionExpression: expression });
                      else if (linkedRule) updateSnapshot((next) => { const rule = next.rules.find((item) => item.stableRuleId === linkedRule.stableRuleId); if (rule) rule.conditionExpression = expression; return next; });
                    }}
                  />
                )}

                {inspectorTab === "outcome" && selectedNode && (
                  <>
                    <Textarea label="Provisional outcome" rows={6} disabled={!editable} value={selectedNode.provisionalOutcome ?? linkedRule?.provisionalOutcome ?? ""} onChange={(event) => mutateNode(selectedNode.stableNodeId, { provisionalOutcome: event.target.value, ...(selectedNode.stableNodeId.startsWith("node:outcome:") ? { label: event.target.value } : {}) })} />
                    <Textarea label="Timing / destination" rows={3} disabled={!editable} value={selectedNode.timingDestination ?? linkedRule?.timingDestination ?? ""} onChange={(event) => mutateNode(selectedNode.stableNodeId, { timingDestination: event.target.value })} />
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">All outcomes remain provisional and require reviewer confirmation.</p>
                  </>
                )}

                {inspectorTab === "safety" && selectedNode && (
                  <>
                    <Select label="Safety priority" value={selectedNode.clinicalRisk} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { clinicalRisk: event.target.value as SafetyPriority })} options={RISK_LEVELS.map((risk) => ({ value: risk, label: risk }))} />
                    <Select label="Reviewer requirement" value={selectedNode.reviewerRequirement} disabled={!editable} onChange={(event) => mutateNode(selectedNode.stableNodeId, { reviewerRequirement: event.target.value as ReviewerRequirement })} options={REVIEWER_REQUIREMENTS.map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                    <Badge variant={selectedNode.clinicalRisk === "CRITICAL" ? "urgent" : selectedNode.clinicalRisk === "HIGH" ? "high" : "info"}>{selectedNode.clinicalRisk} · {selectedNode.reviewerRequirement.replace(/_/g, " ")}</Badge>
                  </>
                )}
                {inspectorTab === "safety" && selectedEdge && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={selectedEdge.isSafetyOverride} disabled={!editable} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { isSafetyOverride: event.target.checked })} /> Safety override</label>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={selectedEdge.allowsCycle} disabled={!editable} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { allowsCycle: event.target.checked })} /> Explicit repeat-pathway cycle</label>
                    <Input type="number" label="Priority" value={selectedEdge.priority} disabled={!editable} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { priority: Number(event.target.value) })} />
                    <Input type="number" label="Branch order" value={selectedEdge.branchOrder} disabled={!editable} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { branchOrder: Number(event.target.value) })} />
                  </>
                )}

                {inspectorTab === "source" && selectedNode && (
                  <SourceEditor node={selectedNode} editable={editable} onChange={(changes) => mutateNode(selectedNode.stableNodeId, changes)} />
                )}

                {inspectorTab === "layout" && selectedNode && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" label="X" value={currentView.layout[selectedNode.stableNodeId]?.x ?? 0} disabled={!editable} onChange={(event) => updateSnapshot((next) => { next.views.find((view) => view.key === currentViewKey)!.layout[selectedNode.stableNodeId].x = Number(event.target.value); return next; })} />
                      <Input type="number" label="Y" value={currentView.layout[selectedNode.stableNodeId]?.y ?? 0} disabled={!editable} onChange={(event) => updateSnapshot((next) => { next.views.find((view) => view.key === currentViewKey)!.layout[selectedNode.stableNodeId].y = Number(event.target.value); return next; })} />
                    </div>
                    <Button variant="outline" size="sm" disabled={!editable} onClick={() => void autoLayout()} icon={<LayoutDashboard className="h-4 w-4" />}>Auto-layout entire view</Button>
                    <p className="text-xs leading-5 text-muted-foreground">Coordinates belong only to <strong>{currentView.title}</strong>. Node identity and clinical content remain shared across every view.</p>
                  </>
                )}

                {inspectorTab === "audit" && (
                  <div className="space-y-2">
                    {auditEvents.length === 0 ? <p className="text-sm text-muted-foreground">No audit events loaded.</p> : auditEvents.slice(0, 30).map((event) => (
                      <div key={String(event.id)} className="rounded-lg border border-border p-3 text-xs">
                        <div className="font-bold text-slate-900">{String(event.eventType)}</div>
                        <div className="mt-1 text-muted-foreground">{new Date(String(event.createdAt)).toLocaleString("en-NZ")}</div>
                        {event.reason ? <div className="mt-2 leading-5">{String(event.reason)}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Provisional recommendation · Reviewer confirmation required · Not for direct clinical action</span>
        <span>Demo environment · Simulated export package</span>
      </div>
    </div>
  );
}

function ConditionEditor({
  expression,
  sourceText,
  editable,
  onChange,
}: {
  expression?: ConditionExpression;
  sourceText?: string;
  editable: boolean;
  onChange: (value: ConditionExpression) => void;
}) {
  const [json, setJson] = useState(JSON.stringify(expression ?? { type: "ALWAYS" }, null, 2));
  const [error, setError] = useState<string>();
  useEffect(() => setJson(JSON.stringify(expression ?? { type: "ALWAYS" }, null, 2)), [expression]);
  return (
    <>
      {expression?.type === "SOURCE_TEXT" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <div className="font-bold">Non-executable source condition</div>
          <p className="mt-1">{sourceText ?? expression.text}</p>
          <p className="mt-2">Encode only a governed typed AST. JavaScript and dynamic code are never accepted.</p>
        </div>
      )}
      <Textarea
        label="Typed condition JSON"
        rows={14}
        value={json}
        disabled={!editable}
        error={error}
        onChange={(event) => setJson(event.target.value)}
        onBlur={() => {
          try {
            const parsed = JSON.parse(json) as ConditionExpression;
            if (!parsed || typeof parsed !== "object" || !("type" in parsed)) throw new Error("Condition requires a typed expression object");
            setError(undefined);
            onChange(parsed);
          } catch (conditionError) {
            setError(conditionError instanceof Error ? conditionError.message : "Invalid condition JSON");
          }
        }}
      />
    </>
  );
}

function SourceEditor({
  node,
  editable,
  onChange,
}: {
  node: GraphNode;
  editable: boolean;
  onChange: (changes: Partial<GraphNode>) => void;
}) {
  const [sources, setSources] = useState(JSON.stringify(node.sourceReferences, null, 2));
  const [sourceError, setSourceError] = useState<string>();
  useEffect(() => setSources(JSON.stringify(node.sourceReferences, null, 2)), [node.sourceReferences]);
  return (
    <>
      <Input label="Stable node ID" value={node.stableNodeId} disabled />
      <Select
        label="Governance classification"
        value={node.governance.classification}
        disabled={!editable || node.governance.classification === "NATIONAL_SOURCE"}
        onChange={(event) => onChange({
          governance: {
            ...node.governance,
            classification: event.target.value as GraphNode["governance"]["classification"],
            locallyModified: event.target.value === "LOCAL_CLINICAL_FORK",
          },
        })}
        options={[
          { value: "NATIONAL_SOURCE", label: "National source" },
          { value: "LOCAL_OPERATIONAL", label: "Local operational overlay" },
          { value: "LOCAL_CLINICAL_FORK", label: "Local clinical fork" },
        ]}
      />
      <Textarea
        label="Governance reason"
        rows={4}
        value={node.governance.reason}
        disabled={!editable || node.governance.classification === "NATIONAL_SOURCE"}
        onChange={(event) => onChange({ governance: { ...node.governance, reason: event.target.value } })}
        hint={node.governance.classification === "LOCAL_CLINICAL_FORK" ? "Required before validation; outputs will visibly show locally modified." : undefined}
      />
      <Textarea label="Required facts (one per line)" rows={7} disabled={!editable} value={node.requiredFacts.join("\n")} onChange={(event) => onChange({ requiredFacts: event.target.value.split("\n").map((fact) => fact.trim()).filter(Boolean) })} />
      <Textarea
        label="Source references JSON"
        rows={10}
        value={sources}
        disabled={!editable}
        error={sourceError}
        onChange={(event) => setSources(event.target.value)}
        onBlur={() => {
          try {
            const parsed = JSON.parse(sources) as SourceReference[];
            if (!Array.isArray(parsed) || parsed.some((source) => !source.document || !source.reference)) throw new Error("Each source requires document and reference");
            setSourceError(undefined);
            onChange({ sourceReferences: parsed });
          } catch (error) {
            setSourceError(error instanceof Error ? error.message : "Invalid source JSON");
          }
        }}
      />
      {node.linkedRuleIds.length > 0 && <div><div className="text-sm font-medium">Linked stable rules</div><div className="mt-2 flex flex-wrap gap-2">{node.linkedRuleIds.map((ruleId) => <Badge key={ruleId}>{ruleId}</Badge>)}</div></div>}
    </>
  );
}

export function ClinicalRuleGraphStudio(props: {
  versionId: string;
  initialSnapshot: ClinicalRuleSnapshot;
  initialRevision: number;
  editable: boolean;
}) {
  return (
    <ReactFlowProvider>
      <ClinicalRuleGraphStudioInner {...props} />
    </ReactFlowProvider>
  );
}
