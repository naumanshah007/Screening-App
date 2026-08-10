"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
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
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  GitBranch,
  LayoutGrid,
  LayoutDashboard,
  ListTree,
  LocateFixed,
  Maximize2,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Printer,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
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
  editable: boolean;
};

type InspectorTab = "display" | "condition" | "outcome" | "safety" | "source" | "layout" | "audit";
type WorkspaceMode = "MAP" | "PATHWAY" | "OUTLINE";
type RouteScope = "OFF" | "ANCESTORS" | "DESCENDANTS" | "BOTH";

type GraphSearchResult = {
  node: GraphNode;
  view: GraphView;
};

type GraphPosition = { x: number; y: number };

const FLOW_NODE_WIDTH = 300;
const FLOW_NODE_HEIGHT = 156;

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
  const ruleId = data.canonical.linkedRuleIds[0];
  const reviewLabel = data.canonical.reviewerRequirement === "MANDATORY_CLINICIAN_CONFIRMATION"
    ? "Confirmation required"
    : data.canonical.reviewerRequirement.replace(/_/g, " ").toLowerCase();
  return (
    <div
      aria-label={`${meta.label}: ${data.canonical.label}`}
      className={cn(
        "group relative w-[300px] overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all",
        meta.classes,
        selected && "ring-4 ring-brand-400/30 shadow-lg",
        data.highlighted && "ring-4 ring-purple-400/25",
        data.dimmed && "opacity-25"
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={data.editable} className="!h-4 !w-4 !border-[3px] !border-white !bg-navy-700 !opacity-100 shadow-sm" />
      <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-white/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-white p-1 text-navy-700 shadow-sm" aria-hidden>
          {data.canonical.nodeType === "SAFETY_STOP" ? (
            <ShieldAlert className="h-4 w-4" />
          ) : data.canonical.nodeType === "TERMINAL" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
          </span>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{meta.label}</span>
        </div>
        {ruleId && <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500">{ruleId}</span>}
      </div>
      <div className="px-3 py-3">
        <p className="line-clamp-3 text-[13px] font-semibold leading-[18px] text-slate-950">{data.canonical.label}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            data.canonical.clinicalRisk === "CRITICAL" ? "border-red-300 bg-red-100 text-red-800" :
              data.canonical.clinicalRisk === "HIGH" ? "border-amber-300 bg-amber-100 text-amber-900" :
                "border-slate-200 bg-white/80 text-slate-600"
          )}>{data.canonical.clinicalRisk}</span>
          <span className="max-w-[180px] truncate text-[9px] font-medium capitalize text-slate-500">{reviewLabel}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={data.editable} className="!h-4 !w-4 !border-[3px] !border-white !bg-brand-600 !opacity-100 shadow-sm" />
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
      editable,
    },
    draggable: editable,
    deletable: false,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ariaLabel: `${canonical.nodeType}: ${canonical.label}`,
  };
}

function edgeColour(edge: GraphEdge) {
  if (edge.isSafetyOverride) return "#dc2626";
  if (edge.conditionExpression.type === "SOURCE_TEXT") return "#d97706";
  return "#334155";
}

function ClinicalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
  style,
}: EdgeProps<Edge<{ canonical: GraphEdge }>>) {
  const canonical = data?.canonical;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
    offset: 38,
  });
  const stroke = String(style?.stroke ?? "#334155");

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={30}
        style={{ ...style, strokeWidth: selected ? 4 : style?.strokeWidth }}
      />
      <circle cx={sourceX} cy={sourceY} r={4.5} fill={stroke} stroke="white" strokeWidth={2} />
      {canonical?.label && (
        <EdgeLabelRenderer>
          <div
            title={canonical.label}
            className={cn(
              "pointer-events-none absolute max-w-44 -translate-x-1/2 -translate-y-1/2 truncate rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold leading-none shadow-sm",
              canonical.isSafetyOverride
                ? "border-red-300 text-red-800"
                : canonical.conditionExpression.type === "SOURCE_TEXT"
                  ? "border-amber-300 text-amber-800"
                  : "border-slate-300 text-slate-700",
              selected && "ring-2 ring-brand-400/30"
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 14}px)` }}
          >
            {canonical.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { clinicalEdge: ClinicalEdge };

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
    type: "clinicalEdge",
    data: { canonical },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColour(canonical), width: 22, height: 22 },
    style: {
      stroke: highlighted ? "#7c3aed" : edgeColour(canonical),
      strokeWidth: highlighted ? 4 : 2.4,
      opacity: hasHighlight && !highlighted ? 0.16 : 1,
      strokeDasharray: canonical.conditionExpression.type === "SOURCE_TEXT" ? "7 5" : undefined,
    },
    interactionWidth: 24,
    reconnectable: true,
  };
}

async function calculateReadableLayout(
  layoutNodes: Array<{ id: string }>,
  layoutEdges: Array<{ id: string; source: string; target: string }>
): Promise<Record<string, GraphPosition>> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.mergeEdges": "false",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.spacing.nodeNode": "72",
      "elk.spacing.edgeEdge": "24",
      "elk.spacing.edgeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "150",
      "elk.layered.spacing.edgeNodeBetweenLayers": "52",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "30",
      "elk.componentCompaction.componentLayoutAlgorithm": "PACKED_RECT",
      "elk.spacing.componentComponent": "110",
      "elk.separateConnectedComponents": "true",
      "elk.padding": "[top=90,left=90,bottom=90,right=90]",
    },
    children: layoutNodes.map((node) => ({
      id: node.id,
      width: FLOW_NODE_WIDTH,
      height: FLOW_NODE_HEIGHT,
      layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
    })),
    edges: layoutEdges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });

  return Object.fromEntries(
    (result.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }])
  );
}

function graphAncestorsAndDescendants(
  selectedNodeId: string | null,
  edges: GraphEdge[],
  scope: RouteScope = "BOTH"
): Set<string> {
  if (!selectedNodeId || scope === "OFF") return new Set();
  const highlighted = new Set<string>([selectedNodeId]);

  if (scope === "ANCESTORS" || scope === "BOTH") {
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
  }

  if (scope === "DESCENDANTS" || scope === "BOTH") {
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
  }

  return highlighted;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

function riskBadgeVariant(risk: SafetyPriority) {
  if (risk === "CRITICAL") return "urgent" as const;
  if (risk === "HIGH") return "high" as const;
  if (risk === "MEDIUM") return "medium" as const;
  return "low" as const;
}

function PathwayMap({
  snapshot,
  onOpen,
}: {
  snapshot: ClinicalRuleSnapshot;
  onOpen: (view: GraphView) => void;
}) {
  const pathwayViews = useMemo(
    () => [...snapshot.views]
      .filter((view) => view.viewType !== "MASTER")
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [snapshot.views]
  );
  const nodesById = useMemo(
    () => new Map(snapshot.nodes.map((node) => [node.stableNodeId, node])),
    [snapshot.nodes]
  );

  return (
    <div className="h-[calc(100dvh-420px)] min-h-[720px] max-h-[1000px] overflow-y-auto bg-slate-50 p-5 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <LayoutGrid className="h-4 w-4" /> Pathway map
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Choose a readable pathway</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              The complete canonical model contains {snapshot.nodes.length} nodes. Open one governed
              pathway at a time to read and edit it at a useful scale.
            </p>
          </div>
          <Badge variant="info">{pathwayViews.length} synchronized pathway views</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {pathwayViews.map((view, index) => {
            const viewNodes = view.includedNodeIds
              .map((id) => nodesById.get(id))
              .filter((node): node is GraphNode => Boolean(node));
            const ruleCount = new Set(viewNodes.flatMap((node) => node.linkedRuleIds)).size;
            const criticalCount = viewNodes.filter((node) => node.clinicalRisk === "CRITICAL").length;
            const reviewCount = viewNodes.filter((node) =>
              ["CLINICIAN_REVIEW", "MDM_REVIEW", "SPECIALIST_REFERRAL"].includes(node.nodeType)
            ).length;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => onOpen(view)}
                className="group flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 font-mono text-sm font-bold text-brand-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {view.visualSource && <Badge variant="low">Verified</Badge>}
                    {criticalCount > 0 && <Badge variant="urgent">{criticalCount} critical</Badge>}
                  </div>
                </div>
                <h3 className="mt-4 text-base font-bold leading-6 text-slate-950 group-hover:text-brand-800">
                  {view.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">{view.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <span>{ruleCount} rules</span>
                  <span>{viewNodes.length} nodes</span>
                  <span>{reviewCount} review points</span>
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700">
                    Open pathway <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GraphOutline({
  nodes,
  edges,
  selectedNodeId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const incomingByNode = useMemo(() => {
    const result = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      const current = result.get(edge.toNodeId) ?? [];
      current.push(edge);
      result.set(edge.toNodeId, current);
    }
    return result;
  }, [edges]);

  return (
    <div className="h-[calc(100dvh-420px)] min-h-[720px] max-h-[1000px] overflow-auto bg-slate-50 p-4 sm:p-5">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-navy-800 text-white">
            <tr>
              <th className="w-28 px-4 py-3">Type</th>
              <th className="px-4 py-3">Clinical node</th>
              <th className="w-64 px-4 py-3">Incoming branch</th>
              <th className="w-32 px-4 py-3">Safety</th>
              <th className="w-44 px-4 py-3">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nodes.map((node) => {
              const incoming = incomingByNode.get(node.stableNodeId) ?? [];
              return (
                <tr
                  key={node.stableNodeId}
                  className={cn(
                    "cursor-pointer align-top transition hover:bg-brand-50/60",
                    selectedNodeId === node.stableNodeId && "bg-brand-50 ring-1 ring-inset ring-brand-300"
                  )}
                  onClick={() => onSelect(node.stableNodeId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node.stableNodeId);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={selectedNodeId === node.stableNodeId}
                >
                  <td className="px-4 py-3 font-semibold text-slate-600">{NODE_META[node.nodeType].label}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold leading-5 text-slate-950">{node.label}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-500">
                      {node.linkedRuleIds.join(", ") || node.stableNodeId}
                    </div>
                  </td>
                  <td className="px-4 py-3 leading-5 text-slate-600">
                    {incoming.length > 0 ? incoming.map((edge) => edge.label).join("; ") : "Pathway entry"}
                  </td>
                  <td className="px-4 py-3"><Badge variant={riskBadgeVariant(node.clinicalRisk)}>{node.clinicalRisk}</Badge></td>
                  <td className="px-4 py-3 leading-5 text-slate-600">{node.reviewerRequirement.replace(/_/g, " ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("MAP");
  const [authoringMode, setAuthoringMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("display");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [presentationLayout, setPresentationLayout] = useState<Record<string, GraphPosition>>({});
  const [layoutPending, setLayoutPending] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [routeScope, setRouteScope] = useState<RouteScope>("BOTH");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);
  const [auditEvents, setAuditEvents] = useState<Array<Record<string, unknown>>>([]);
  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow();
  const editingEnabled = editable && authoringMode;

  const currentView =
    snapshot.views.find((view) => view.key === currentViewKey) ?? snapshot.views[0]!;
  const pathwayViews = useMemo(
    () => [...snapshot.views]
      .filter((view) => view.viewType !== "MASTER")
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [snapshot.views]
  );
  const activePathwayView = currentView.viewType === "MASTER" ? pathwayViews[0]! : currentView;
  const visibleNodeIds = useMemo(() => {
    if (workspaceMode === "MAP") return new Set<string>();
    return new Set(currentView.includedNodeIds);
  }, [currentView, workspaceMode]);
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
    () => graphAncestorsAndDescendants(selectedNodeId, visibleEdges, routeScope),
    [routeScope, selectedNodeId, visibleEdges]
  );
  const hasHighlight = highlightedIds.size > 0;

  const canonicalNodes = useMemo(
    () => snapshot.nodes.filter((node) => visibleNodeIds.has(node.stableNodeId)),
    [snapshot.nodes, visibleNodeIds]
  );
  const layoutSignature = useMemo(
    () => `${currentView.key}:${canonicalNodes.map((node) => node.stableNodeId).join("|")}:${visibleEdges.map((edge) => edge.stableEdgeId).join("|")}`,
    [canonicalNodes, currentView.key, visibleEdges]
  );
  const baseNodes = useMemo(
    () => canonicalNodes.map((node) => {
      const flowNode = createFlowNode(node, currentView, highlightedIds, hasHighlight, editingEnabled);
      flowNode.position = presentationLayout[node.stableNodeId] ?? flowNode.position;
      return flowNode;
    }),
    [canonicalNodes, currentView, editingEnabled, hasHighlight, highlightedIds, presentationLayout]
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
    if (workspaceMode !== "PATHWAY" || canonicalNodes.length === 0) return;
    let cancelled = false;
    setLayoutPending(true);
    void calculateReadableLayout(
      canonicalNodes.map((node) => ({ id: node.stableNodeId })),
      visibleEdges.map((edge) => ({ id: edge.stableEdgeId, source: edge.fromNodeId, target: edge.toNodeId }))
    ).then((layout) => {
      if (cancelled) return;
      setPresentationLayout(layout);
      setLayoutPending(false);
    }).catch(() => {
      if (!cancelled) setLayoutPending(false);
    });
    return () => { cancelled = true; };
  }, [canonicalNodes, layoutSignature, visibleEdges, workspaceMode]);
  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setInspectorOpen(false);
  }, [currentView.key]);
  useEffect(() => {
    if (workspaceMode !== "PATHWAY" || canonicalNodes.length === 0 || pendingFocusNodeId) return;
    const incomingNodeIds = new Set(visibleEdges.map((edge) => edge.toNodeId));
    const entryNode = canonicalNodes.find((node) => !incomingNodeIds.has(node.stableNodeId)) ?? canonicalNodes[0]!;
    const targetNode = selectedNodeId
      ? canonicalNodes.find((node) => node.stableNodeId === selectedNodeId) ?? entryNode
      : entryNode;
    const position = presentationLayout[targetNode.stableNodeId] ?? currentView.layout[targetNode.stableNodeId] ?? { x: 0, y: 0 };
    const zoom = selectedNodeId ? 1.05 : Math.max(0.8, Math.min(1, currentView.defaultZoom));
    const frame = requestAnimationFrame(() => {
      setCenter(
        position.x + FLOW_NODE_WIDTH / 2,
        position.y + FLOW_NODE_HEIGHT / 2 + (selectedNodeId ? 0 : 220),
        { zoom, duration: 350 }
      );
      setZoomPercent(Math.round(zoom * 100));
    });
    return () => cancelAnimationFrame(frame);
  }, [canonicalNodes, currentView.defaultZoom, currentView.layout, pendingFocusNodeId, presentationLayout, selectedNodeId, setCenter, visibleEdges, workspaceMode]);

  const selectedNode = snapshot.nodes.find((node) => node.stableNodeId === selectedNodeId) ?? null;
  const selectedEdge = snapshot.edges.find((edge) => edge.stableEdgeId === selectedEdgeId) ?? null;
  const linkedRule = selectedNode?.linkedRuleIds[0]
    ? snapshot.rules.find((rule) => rule.stableRuleId === selectedNode.linkedRuleIds[0]) ?? null
    : null;
  const searchResults = useMemo<GraphSearchResult[]>(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const pathwayViews = [...snapshot.views]
      .filter((view) => view.viewType !== "MASTER")
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const results: GraphSearchResult[] = [];
    for (const node of snapshot.nodes) {
      const haystack = [
        node.label,
        node.shortLabel,
        node.description,
        node.nodeType,
        node.clinicalRisk,
        node.reviewerRequirement,
        ...node.linkedRuleIds,
        ...node.sourceReferences.flatMap((source) => [source.document, source.reference]),
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) continue;
      const view = pathwayViews.find((candidate) => candidate.includedNodeIds.includes(node.stableNodeId));
      if (view) results.push({ node, view });
      if (results.length === 10) break;
    }
    return results;
  }, [search, snapshot.nodes, snapshot.views]);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setInspectorOpen(true);
  }, []);

  const openPathway = useCallback((view: GraphView, mode: WorkspaceMode = "PATHWAY") => {
    setCurrentViewKey(view.key);
    setWorkspaceMode(mode);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setInspectorOpen(false);
  }, []);

  const openSearchResult = useCallback((result: GraphSearchResult) => {
    setCurrentViewKey(result.view.key);
    setWorkspaceMode("PATHWAY");
    setSelectedEdgeId(null);
    setSearchOpen(false);
    setPendingFocusNodeId(result.node.stableNodeId);
  }, []);

  useEffect(() => {
    if (!pendingFocusNodeId || workspaceMode !== "PATHWAY") return;
    const position = presentationLayout[pendingFocusNodeId] ?? currentView.layout[pendingFocusNodeId];
    if (!position) return;
    const frame = requestAnimationFrame(() => {
      setSelectedNodeId(pendingFocusNodeId);
      setSelectedEdgeId(null);
      setCenter(position.x + FLOW_NODE_WIDTH / 2, position.y + FLOW_NODE_HEIGHT / 2, { zoom: 1.05, duration: 450 });
      setZoomPercent(105);
      setInspectorOpen(true);
      setPendingFocusNodeId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentView.layout, pendingFocusNodeId, presentationLayout, setCenter, workspaceMode]);

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
      if (!editingEnabled) return;
      setPresentationLayout((current) => ({ ...current, [node.id]: node.position }));
      updateSnapshot((next) => {
        const view = next.views.find((candidate) => candidate.key === currentViewKey);
        if (view) view.layout[node.id] = node.position;
        return next;
      });
    },
    [currentViewKey, editingEnabled, updateSnapshot]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!editingEnabled || !connection.source || !connection.target) return;
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
    [currentViewKey, editingEnabled, updateSnapshot]
  );
  const onReconnect = useCallback(
    (oldEdge: Edge<{ canonical: GraphEdge }>, connection: Connection) => {
      if (!editingEnabled || !connection.source || !connection.target) return;
      setEdges((current) => reconnectEdge(oldEdge, connection, current));
      mutateEdge(oldEdge.id, { fromNodeId: connection.source, toNodeId: connection.target });
    },
    [editingEnabled, mutateEdge]
  );

  const addNodeToView = useCallback(() => {
    if (!editingEnabled) return;
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
  }, [currentViewKey, editingEnabled, updateSnapshot]);

  const duplicateSelectedNode = useCallback(() => {
    if (!editingEnabled || !selectedNode) return;
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
  }, [currentViewKey, editingEnabled, selectedNode, updateSnapshot]);

  const deleteSelectedNode = useCallback(() => {
    if (!editingEnabled || !selectedNode) return;
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
  }, [editingEnabled, selectedNode, snapshot.edges, updateSnapshot]);

  const deleteSelectedEdge = useCallback(() => {
    if (!editingEnabled || !selectedEdge) return;
    updateSnapshot((next) => {
      next.edges = next.edges.filter((edge) => edge.stableEdgeId !== selectedEdge.stableEdgeId);
      for (const view of next.views) {
        view.includedEdgeIds = view.includedEdgeIds.filter((id) => id !== selectedEdge.stableEdgeId);
      }
      return next;
    });
    setSelectedEdgeId(null);
  }, [editingEnabled, selectedEdge, updateSnapshot]);

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
    setLayoutPending(true);
    const layout = await calculateReadableLayout(layoutNodes, layoutEdges);
    setPresentationLayout((current) => scope === "VIEW" ? layout : { ...current, ...layout });
    if (editingEnabled) {
      updateSnapshot((next) => {
        const view = next.views.find((candidate) => candidate.key === currentViewKey)!;
        for (const [nodeId, position] of Object.entries(layout)) view.layout[nodeId] = position;
        return next;
      });
    }
    setLayoutPending(false);
    requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.12, duration: 500, maxZoom: 0.92 })));
  }, [currentViewKey, edges, editingEnabled, fitView, highlightedIds, nodes, updateSnapshot]);

  const focusSearchResult = useCallback(() => {
    if (!search.trim()) {
      setSearchOpen(true);
      return;
    }
    const first = searchResults[0];
    if (!first) {
      toast.error("No matching node, rule ID, or source reference.");
      return;
    }
    openSearchResult(first);
  }, [openSearchResult, search, searchResults]);

  const exportCurrentView = useCallback(
    async (format: "svg" | "png") => {
      const graph = flowRef.current;
      const viewport = graph?.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!graph || !viewport) {
        toast.error("The graph is not ready to export yet.");
        return;
      }

      setExporting(format);
      try {
        if (format === "svg") {
          const bounds = viewport.getBoundingClientRect();
          const serialised = sanitiseGraphExportMarkup(
            new XMLSerializer().serializeToString(viewport)
          );
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}"><rect width="100%" height="100%" fill="#f8fafc"/><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialised}</div></foreignObject></svg>`;
          downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${currentView.key}.svg`);
          return;
        }

        // Rasterise the rendered graph directly. Drawing an SVG foreignObject to a
        // canvas taints it in WebKit and some hardened Chromium environments.
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(graph, {
          backgroundColor: "#f8fafc",
          logging: false,
          scale: 2,
          useCORS: true,
        });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error("The browser could not create the PNG file."));
          }, "image/png");
        });
        downloadBlob(blob, `${currentView.key}.png`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Unable to export ${format.toUpperCase()}.`);
      } finally {
        setExporting(null);
      }
    },
    [currentView.key]
  );

  const openFullscreen = useCallback(async () => {
    try {
      if (!wrapperRef.current?.requestFullscreen) {
        throw new Error("Fullscreen is unavailable in this browser.");
      }
      await wrapperRef.current.requestFullscreen();
    } catch {
      toast.error("Fullscreen is unavailable in this browser.");
    }
  }, []);

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
              <Badge variant={authoringMode ? "high" : "info"}>{editable ? (authoringMode ? "Edit mode" : "View mode") : "Read only"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <>
                <Button size="sm" variant="outline" onClick={() => void saveDraft(true)} loading={saving} icon={<Save className="h-4 w-4" />}>Save checkpoint</Button>
                <Button size="sm" variant="warning" onClick={() => void validateDraft()} loading={validating} icon={<FileCheck2 className="h-4 w-4" />}>Validate</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => void exportCurrentView("svg")} loading={exporting === "svg"} disabled={exporting !== null || workspaceMode !== "PATHWAY"} icon={<Download className="h-4 w-4" />}>SVG</Button>
            <Button size="sm" variant="outline" onClick={() => void exportCurrentView("png")} loading={exporting === "png"} disabled={exporting !== null || workspaceMode !== "PATHWAY"} icon={<Download className="h-4 w-4" />}>PNG</Button>
            <Button size="icon" variant="outline" aria-label="Print current view" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Open full screen" onClick={() => void openFullscreen()}><Maximize2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="relative z-20 flex flex-wrap items-center gap-3 border-b border-border bg-white px-3 py-2.5">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Graph workspace mode">
          {([
            { mode: "MAP" as const, label: "Map", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
            { mode: "PATHWAY" as const, label: "Pathway", icon: <Network className="h-3.5 w-3.5" /> },
            { mode: "OUTLINE" as const, label: "Outline", icon: <ListTree className="h-3.5 w-3.5" /> },
          ]).map((item) => (
            <button
              key={item.mode}
              type="button"
              role="tab"
              aria-selected={workspaceMode === item.mode}
              onClick={() => {
                if (item.mode === "MAP") {
                  setWorkspaceMode("MAP");
                  setInspectorOpen(false);
                  return;
                }
                setCurrentViewKey(activePathwayView.key);
                setWorkspaceMode(item.mode);
                setInspectorOpen(false);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                workspaceMode === item.mode ? "bg-white text-brand-800 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-950"
              )}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-500">
          <button type="button" className="shrink-0 font-semibold hover:text-brand-700" onClick={() => setWorkspaceMode("MAP")}>All pathways</button>
          {workspaceMode !== "MAP" && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <select
                aria-label="Current clinical pathway"
                value={activePathwayView.key}
                onChange={(event) => {
                  const view = pathwayViews.find((candidate) => candidate.key === event.target.value);
                  if (view) openPathway(view, workspaceMode);
                }}
                className="min-w-0 max-w-[360px] truncate rounded-md border border-transparent bg-transparent px-1 py-1 font-semibold text-slate-800 outline-none hover:border-slate-200 focus:border-brand-400"
              >
                {pathwayViews.map((view) => <option key={view.key} value={view.key}>{view.title}</option>)}
              </select>
            </>
          )}
        </div>

        {editable && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Authoring mode">
            <button
              type="button"
              aria-pressed={!authoringMode}
              onClick={() => setAuthoringMode(false)}
              className={cn("h-7 rounded-md px-2.5 text-[11px] font-semibold", !authoringMode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}
            >
              View
            </button>
            <button
              type="button"
              aria-pressed={authoringMode}
              onClick={() => setAuthoringMode(true)}
              className={cn("h-7 rounded-md px-2.5 text-[11px] font-semibold", authoringMode ? "bg-amber-100 text-amber-950 shadow-sm" : "text-slate-500")}
            >
              Edit
            </button>
          </div>
        )}

        <div className="relative w-full sm:w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => event.key === "Enter" && focusSearchResult()}
            placeholder="Search every pathway, rule or source…"
            aria-label="Search all clinical pathways"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs text-slate-950 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); setSearchOpen(false); }} className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
          {searchOpen && search.trim() && (
            <div className="absolute right-0 top-11 z-40 max-h-[420px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:w-[520px]">
              {searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">No matching rule, node, or source.</p>
              ) : searchResults.map((result) => (
                <button
                  key={`${result.view.key}-${result.node.stableNodeId}`}
                  type="button"
                  onClick={() => openSearchResult(result)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-brand-700"><GitBranch className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-5 text-slate-950">{result.node.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {result.node.linkedRuleIds.join(", ") || NODE_META[result.node.nodeType].label} · {result.view.title}
                    </span>
                  </span>
                  <Badge variant={riskBadgeVariant(result.node.clinicalRisk)}>{result.node.clinicalRisk}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-[720px]">
        <p id="clinical-graph-summary" className="sr-only" aria-live="polite">
          {currentView.title}. {nodes.length} visible nodes and {edges.length} visible edges.
          {selectedNode ? ` Selected node ${selectedNode.shortLabel}.` : " No node selected."}
          {selectedEdge ? ` Selected edge ${selectedEdge.label}.` : ""}
          Use Tab to move through graph elements and Enter or Space to select one.
        </p>
        {workspaceMode === "MAP" ? (
          <PathwayMap snapshot={snapshot} onOpen={openPathway} />
        ) : workspaceMode === "OUTLINE" ? (
          <GraphOutline
            nodes={canonicalNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            onSelect={selectNode}
          />
        ) : (
        <div ref={flowRef} className="relative h-[calc(100dvh-420px)] min-h-[720px] max-h-[1000px] w-full bg-slate-50 print:h-[900px] print:min-h-[900px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={(_event, node) => selectNode(node.id)}
            onEdgeClick={(_event, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); setInspectorOpen(true); }}
            onMove={(_event, viewport) => setZoomPercent(Math.round(viewport.zoom * 100))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                const target = event.target as HTMLElement;
                const node = target.closest<HTMLElement>(".react-flow__node[data-id]");
                const edge = target.closest<HTMLElement>(".react-flow__edge[data-id]");
                if (node?.dataset.id) {
                  event.preventDefault();
                  selectNode(node.dataset.id);
                } else if (edge?.dataset.id) {
                  event.preventDefault();
                  setSelectedEdgeId(edge.dataset.id);
                  setSelectedNodeId(null);
                  setInspectorOpen(true);
                }
              }
            }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); setInspectorOpen(false); }}
            minZoom={currentView.minimumZoom}
            maxZoom={currentView.maximumZoom}
            nodesConnectable={editingEnabled}
            edgesReconnectable={editingEnabled}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            aria-label={`${currentView.title} interactive clinical rule graph`}
            aria-describedby="clinical-graph-summary"
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeColor={(node) => {
                const category = (node.data as FlowNodeData).canonical.visualCategory;
                return category === "RED" ? "#dc2626" : category === "GREEN" ? "#16a34a" : category === "PURPLE" ? "#7c3aed" : category === "AMBER" ? "#d97706" : "#0f766e";
              }}
            />
            <Panel position="top-left" className="m-3 max-w-[calc(100%-24px)] rounded-xl border border-border bg-white/95 p-2 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="icon" variant="ghost" aria-label="Zoom out" title="Zoom out" onClick={() => void zoomOut({ duration: 160 })}><ZoomOut className="h-4 w-4" /></Button>
                <span className="min-w-12 text-center font-mono text-[11px] font-semibold text-slate-600" aria-live="polite">{zoomPercent}%</span>
                <Button size="icon" variant="ghost" aria-label="Zoom in" title="Zoom in" onClick={() => void zoomIn({ duration: 160 })}><ZoomIn className="h-4 w-4" /></Button>
                <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />
                <Button size="sm" variant="outline" onClick={() => fitView({ padding: 0.12, duration: 450, maxZoom: 0.92 })} icon={<LocateFixed className="h-4 w-4" />}>Show all</Button>
                <Button size="sm" variant="outline" onClick={() => void autoLayout("VIEW")} loading={layoutPending} icon={<LayoutDashboard className="h-4 w-4" />}>Space nodes</Button>
                <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600">
                  Route
                  <select value={routeScope} onChange={(event) => setRouteScope(event.target.value as RouteScope)} className="bg-transparent text-[11px] font-semibold text-slate-900 outline-none">
                    <option value="OFF">Off</option>
                    <option value="ANCESTORS">Path to here</option>
                    <option value="DESCENDANTS">Next steps</option>
                    <option value="BOTH">Both directions</option>
                  </select>
                </label>
                {editingEnabled && (
                  <>
                    <Button size="sm" variant="outline" onClick={addNodeToView} icon={<Plus className="h-4 w-4" />}>Node</Button>
                    {selectedNode && <Button size="sm" variant="outline" onClick={() => void autoLayout("BRANCH")} icon={<LayoutDashboard className="h-4 w-4" />}>Layout branch</Button>}
                  </>
                )}
              </div>
            </Panel>
            <Panel position="bottom-center" className="mb-3 rounded-full border border-border bg-white/95 px-4 py-2 text-[11px] text-slate-600 shadow">
              {nodes.length} nodes · {edges.length} branches · Select a node for governed detail
            </Panel>
          </ReactFlow>
        </div>
        )}

        {inspectorOpen && workspaceMode !== "MAP" && (
        <aside className="absolute inset-y-0 right-0 z-30 w-full min-h-0 overflow-y-auto border-l border-border bg-white shadow-2xl sm:w-[420px]">
          <div className="sticky top-0 z-10 border-b border-border bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <span className="truncate">{currentView.title}</span><ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate font-semibold text-foreground">{selectedNode?.shortLabel ?? selectedEdge?.label ?? "Select a node or edge"}</span>
              </div>
              <button type="button" aria-label="Close inspector" title="Close inspector" onClick={() => setInspectorOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <PanelRightClose className="h-4 w-4" />
              </button>
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
                    <Select label="Node type" value={selectedNode.nodeType} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { nodeType: event.target.value as GraphNodeType })} options={NODE_TYPES.map((type) => ({ value: type, label: NODE_META[type].label }))} />
                    <Textarea label="Node label" rows={4} value={selectedNode.label} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { label: event.target.value })} />
                    <Input label="Short label" value={selectedNode.shortLabel} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { shortLabel: event.target.value })} />
                    <Textarea label="Explanatory text" rows={5} value={selectedNode.description} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { description: event.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!editingEnabled} onClick={duplicateSelectedNode} icon={<Copy className="h-4 w-4" />}>Duplicate</Button>
                      <Button size="sm" variant="danger" disabled={!editingEnabled} onClick={deleteSelectedNode} icon={<Trash2 className="h-4 w-4" />}>Delete unused</Button>
                    </div>
                  </>
                )}
                {inspectorTab === "display" && selectedEdge && (
                  <>
                    <Input label="Branch label" value={selectedEdge.label} disabled={!editingEnabled} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { label: event.target.value })} />
                    <Input label="Stable edge ID" value={selectedEdge.stableEdgeId} disabled />
                    <Button size="sm" variant="danger" disabled={!editingEnabled} onClick={deleteSelectedEdge} icon={<Trash2 className="h-4 w-4" />}>Delete edge</Button>
                  </>
                )}

                {inspectorTab === "condition" && (
                  <ConditionEditor
                    expression={selectedEdge?.conditionExpression ?? linkedRule?.conditionExpression}
                    editable={editingEnabled}
                    sourceText={linkedRule?.sourceConditionText}
                    onChange={(expression) => {
                      if (selectedEdge) mutateEdge(selectedEdge.stableEdgeId, { conditionExpression: expression });
                      else if (linkedRule) updateSnapshot((next) => { const rule = next.rules.find((item) => item.stableRuleId === linkedRule.stableRuleId); if (rule) rule.conditionExpression = expression; return next; });
                    }}
                  />
                )}

                {inspectorTab === "outcome" && selectedNode && (
                  <>
                    <Textarea label="Provisional outcome" rows={6} disabled={!editingEnabled} value={selectedNode.provisionalOutcome ?? linkedRule?.provisionalOutcome ?? ""} onChange={(event) => mutateNode(selectedNode.stableNodeId, { provisionalOutcome: event.target.value, ...(selectedNode.stableNodeId.startsWith("node:outcome:") ? { label: event.target.value } : {}) })} />
                    <Textarea label="Timing / destination" rows={3} disabled={!editingEnabled} value={selectedNode.timingDestination ?? linkedRule?.timingDestination ?? ""} onChange={(event) => mutateNode(selectedNode.stableNodeId, { timingDestination: event.target.value })} />
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">All outcomes remain provisional and require reviewer confirmation.</p>
                  </>
                )}

                {inspectorTab === "safety" && selectedNode && (
                  <>
                    <Select label="Safety priority" value={selectedNode.clinicalRisk} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { clinicalRisk: event.target.value as SafetyPriority })} options={RISK_LEVELS.map((risk) => ({ value: risk, label: risk }))} />
                    <Select label="Reviewer requirement" value={selectedNode.reviewerRequirement} disabled={!editingEnabled} onChange={(event) => mutateNode(selectedNode.stableNodeId, { reviewerRequirement: event.target.value as ReviewerRequirement })} options={REVIEWER_REQUIREMENTS.map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                    <Badge variant={selectedNode.clinicalRisk === "CRITICAL" ? "urgent" : selectedNode.clinicalRisk === "HIGH" ? "high" : "info"}>{selectedNode.clinicalRisk} · {selectedNode.reviewerRequirement.replace(/_/g, " ")}</Badge>
                  </>
                )}
                {inspectorTab === "safety" && selectedEdge && (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={selectedEdge.isSafetyOverride} disabled={!editingEnabled} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { isSafetyOverride: event.target.checked })} /> Safety override</label>
                    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={selectedEdge.allowsCycle} disabled={!editingEnabled} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { allowsCycle: event.target.checked })} /> Explicit repeat-pathway cycle</label>
                    <Input type="number" label="Priority" value={selectedEdge.priority} disabled={!editingEnabled} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { priority: Number(event.target.value) })} />
                    <Input type="number" label="Branch order" value={selectedEdge.branchOrder} disabled={!editingEnabled} onChange={(event) => mutateEdge(selectedEdge.stableEdgeId, { branchOrder: Number(event.target.value) })} />
                  </>
                )}

                {inspectorTab === "source" && selectedNode && (
                  <SourceEditor node={selectedNode} editable={editingEnabled} onChange={(changes) => mutateNode(selectedNode.stableNodeId, changes)} />
                )}

                {inspectorTab === "layout" && selectedNode && (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-900">Layout intent</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Drag this node in Edit mode, or use a governed automatic layout. Clinical content is unchanged.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={!editingEnabled} onClick={() => void autoLayout("BRANCH")} icon={<LayoutDashboard className="h-4 w-4" />}>Tidy selected route</Button>
                      <Button variant="outline" size="sm" disabled={!editingEnabled} onClick={() => void autoLayout("VIEW")} icon={<LayoutDashboard className="h-4 w-4" />}>Tidy pathway</Button>
                    </div>
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
        )}
        {!inspectorOpen && workspaceMode !== "MAP" && (selectedNode || selectedEdge) && (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="absolute right-4 top-[236px] z-30 hidden rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-md hover:text-brand-700 xl:block"
            aria-label="Open inspector"
            title="Open inspector"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
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
