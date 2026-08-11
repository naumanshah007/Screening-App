"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ListTree,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  Network,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  descendantsOf,
  edgeIdsForChain,
  pathToNode,
  searchPathwayNodes,
  type PathwayGraph,
  type PathwayNode,
} from "@/lib/clinical-rules/pathway-view-model";
import {
  NODE_HEIGHT_BOUNDS,
  NODE_WIDTH,
  estimateWrappedLines,
  layoutPathwayTree,
  rootNodeId,
} from "@/lib/clinical-rules/pathway-layout";
import { PathwayNodeCard, type PathwayFlowData } from "./PathwayNodeCard";
import { PathwayDetailPanel } from "./PathwayDetailPanel";
import { LEGEND_ORDER, TONE_STYLE } from "./tone";

const nodeTypes = { pathway: PathwayNodeCard };

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2;

export type CaseOverlay = {
  /** Rule ids the engine actually traversed for this case. */
  traversedRuleIds: string[];
  /** The rule that produced the recommendation. */
  controllingRuleId: string | null;
};

export type GovernanceMeta = {
  /** Internal governed identifier, e.g. CG-NCSP-3.1.0. */
  rulesetId: string;
  /** Recorded lifecycle of the governed version, e.g. DRAFT. */
  lifecycle: string;
  /** How canonical results are currently recorded, e.g. SHADOW. */
  evaluationMode?: string | null;
  checksum: string | null;
  sourcePackageVersion: string;
};

// ── Text measurement ────────────────────────────────────────────────────────
// Card height must match the text the card actually renders, so it is measured
// with the same font rather than assumed.

const measureCache = new Map<string, number>();
let measureContext: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === "undefined") {
    measureContext = null;
    return null;
  }
  measureContext = document.createElement("canvas").getContext("2d");
  return measureContext;
}

function countLines(text: string, fontPx: number, maxWidth: number, maxLines: number): number {
  const key = `${fontPx}|${maxWidth}|${maxLines}|${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getContext();
  if (!ctx) {
    // Server render / no canvas: deterministic estimate keeps SSR stable.
    return estimateWrappedLines(text, maxWidth, fontPx * 0.53, maxLines);
  }
  ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  let lines = 1;
  let width = 0;
  for (const word of text.split(/\s+/)) {
    const wordWidth = ctx.measureText(`${word} `).width;
    if (width + wordWidth > maxWidth && width > 0) {
      lines += 1;
      width = wordWidth;
      if (lines >= maxLines) break;
    } else {
      width += wordWidth;
    }
  }
  const result = Math.min(maxLines, lines);
  measureCache.set(key, result);
  return result;
}

/**
 * Card metrics. These must stay in step with `PathwayNodeCard`'s classes:
 * the title uses an explicit line-height so the measured height and the
 * rendered height cannot drift (which previously clipped three-line cards).
 */
export const CARD_METRICS = {
  /** py-2.5 (10+10) + fixed 16px chip row + 6px gap. */
  overhead: 42,
  /** Extra chip row (timing / branch count) plus its gap. */
  extrasRow: 21,
  /** Horizontal padding: pl-4 (16) + pr-3 (12). */
  textInset: 28,
  font: { ENTRY: 14, GROUP: 12.5, DECISION: 12, OUTCOME: 12 },
  lineHeight: { ENTRY: 20, GROUP: 18, DECISION: 18, OUTCOME: 18 },
  maxLines: { ENTRY: 2, GROUP: 2, DECISION: 3, OUTCOME: 3 },
} as const;

export function measureNode(node: PathwayNode) {
  const width = NODE_WIDTH[node.kind];
  const bounds = NODE_HEIGHT_BOUNDS[node.kind];
  const textWidth = width - CARD_METRICS.textInset;
  const fontPx = CARD_METRICS.font[node.kind];
  const lineHeight = CARD_METRICS.lineHeight[node.kind];
  // Faceted conditions render one truncated line per facet rather than wrapping.
  const lines = node.facets
    ? Math.min(CARD_METRICS.maxLines[node.kind], node.facets.length)
    : countLines(node.title, fontPx, textWidth, CARD_METRICS.maxLines[node.kind]);
  const extras =
    node.timing || (node.kind === "DECISION" && node.governedBranchCount > 1)
      ? CARD_METRICS.extrasRow
      : 0;
  const height = CARD_METRICS.overhead + lines * lineHeight + extras;
  return { width, height: Math.min(bounds.max, Math.max(bounds.min, height)) };
}

// ── Viewer ──────────────────────────────────────────────────────────────────

export type PathwayViewerProps = {
  graph: PathwayGraph;
  governance?: GovernanceMeta;
  caseOverlay?: CaseOverlay;
  /** Start with section groups collapsed (used for the 203-rule master view). */
  initialCollapsed?: boolean;
  className?: string;
  /**
   * Previous/next navigation. Plain data rather than JSX: server components
   * that pass elements across the boundary lose React's static-children
   * handling and trip the missing-key warning.
   */
  navLinks?: {
    previous?: { href: string; label: string } | null;
    next?: { href: string; label: string } | null;
  };
};

/** Never-changing subscription: the snapshot pair alone reports hydration. */
const noopSubscribe = () => () => {};

export function PathwayViewer(props: PathwayViewerProps) {
  // Card heights are measured with a canvas, which does not exist on the
  // server. Rendering the canvas only after mount keeps the server and client
  // trees identical instead of producing a hydration mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex min-h-[380px] items-center justify-center rounded-2xl border border-border bg-card",
          props.className
        )}
      >
        <p className="text-sm text-muted-foreground">Preparing pathway diagram…</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <PathwayViewerInner {...props} />
    </ReactFlowProvider>
  );
}

function PathwayViewerInner({
  graph,
  governance,
  caseOverlay,
  initialCollapsed = false,
  className,
  navLinks,
}: PathwayViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  /** True once the reader pans or zooms, so auto-fit stops fighting them. */
  const userMovedRef = useRef(false);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [mode, setMode] = useState<"graph" | "outline">("graph");
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!initialCollapsed) return new Set();
    return new Set(graph.nodes.filter((node) => node.kind === "GROUP").map((node) => node.id));
  });

  const root = useMemo(() => rootNodeId(graph), [graph]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph.edges) {
      const list = map.get(edge.source);
      if (list) list.push(edge.target);
      else map.set(edge.source, [edge.target]);
    }
    return map;
  }, [graph]);

  // Nodes hidden because an ancestor group is collapsed.
  const hidden = useMemo(() => {
    const out = new Set<string>();
    if (collapsed.size === 0) return out;
    const walk = (id: string, underCollapsed: boolean) => {
      for (const child of childrenOf.get(id) ?? []) {
        if (underCollapsed) out.add(child);
        walk(child, underCollapsed || collapsed.has(child));
      }
    };
    walk(root, collapsed.has(root));
    return out;
  }, [collapsed, childrenOf, root]);

  const visibleGraph = useMemo<PathwayGraph>(
    () => ({
      ...graph,
      nodes: graph.nodes.filter((node) => !hidden.has(node.id)),
      edges: graph.edges.filter((edge) => !hidden.has(edge.source) && !hidden.has(edge.target)),
    }),
    [graph, hidden]
  );

  const layout = useMemo(
    () => layoutPathwayTree(visibleGraph, measureNode),
    [visibleGraph]
  );

  const matches = useMemo(() => searchPathwayNodes(visibleGraph, query), [visibleGraph, query]);
  const matchList = useMemo(
    () => visibleGraph.nodes.filter((node) => matches.has(node.id)).map((node) => node.id),
    [visibleGraph, matches]
  );

  const chain = useMemo(
    () => (selectedId ? pathToNode(visibleGraph, selectedId) : []),
    [visibleGraph, selectedId]
  );
  const chainSet = useMemo(() => new Set(chain), [chain]);
  const chainEdges = useMemo(
    () => edgeIdsForChain(visibleGraph, chain),
    [visibleGraph, chain]
  );
  const downstream = useMemo(
    () => (selectedId ? new Set(descendantsOf(visibleGraph, selectedId)) : new Set<string>()),
    [visibleGraph, selectedId]
  );

  const traversedNodeIds = useMemo(() => {
    if (!caseOverlay) return new Set<string>();
    const wanted = new Set(caseOverlay.traversedRuleIds);
    return new Set(
      graph.nodes.filter((node) => node.ruleId && wanted.has(node.ruleId)).map((node) => node.id)
    );
  }, [graph, caseOverlay]);

  const controllingNodeIds = useMemo(() => {
    if (!caseOverlay?.controllingRuleId) return new Set<string>();
    return new Set(
      graph.nodes
        .filter((node) => node.ruleId === caseOverlay.controllingRuleId)
        .map((node) => node.id)
    );
  }, [graph, caseOverlay]);

  const handleSelect = useCallback((id: string) => setSelectedId((prev) => (prev === id ? null : id)), []);

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph, selectedId]
  );

  /**
   * Case overlay focus set: the traversed rules plus their ancestors, so the
   * reader can still see which pathway and section the case sits in rather
   * than two highlighted cards floating in a dimmed diagram.
   */
  const caseFocus = useMemo(() => {
    if (traversedNodeIds.size === 0) return new Set<string>();
    const focus = new Set<string>();
    for (const id of traversedNodeIds) {
      for (const step of pathToNode(visibleGraph, id)) focus.add(step);
      for (const child of descendantsOf(visibleGraph, id)) focus.add(child);
    }
    return focus;
  }, [visibleGraph, traversedNodeIds]);

  // Dimming: focus the selection's path, or the search matches, never both.
  const isDimmed = useCallback(
    (id: string) => {
      if (query && matches.size > 0) return !matches.has(id);
      if (selectedId) return !chainSet.has(id) && !downstream.has(id);
      if (caseFocus.size > 0) return !caseFocus.has(id);
      return false;
    },
    [query, matches, selectedId, chainSet, downstream, caseFocus]
  );

  const flowNodes = useMemo<Node[]>(
    () =>
      visibleGraph.nodes.map((node) => {
        const size = layout.sizes.get(node.id)!;
        const position = layout.positions.get(node.id)!;
        const data: PathwayFlowData = {
          node,
          onPath: chainSet.has(node.id),
          downstream: downstream.has(node.id),
          dimmed: isDimmed(node.id),
          matched: matches.has(node.id),
          traversed: traversedNodeIds.has(node.id),
          controlling: controllingNodeIds.has(node.id),
          collapsed: collapsed.has(node.id),
          hiddenChildren: collapsed.has(node.id) ? (childrenOf.get(node.id) ?? []).length : 0,
          onSelect: handleSelect,
          onToggleCollapse: handleToggleCollapse,
        };
        return {
          id: node.id,
          type: "pathway",
          position,
          selected: node.id === selectedId,
          draggable: false,
          connectable: false,
          data: data as unknown as Record<string, unknown>,
          // Explicit dimensions (not only `style`) so React Flow does not need
          // to measure the DOM — the minimap reads these directly.
          width: size.width,
          height: size.height,
          style: { width: size.width, height: size.height },
        };
      }),
    [
      visibleGraph,
      layout,
      chainSet,
      downstream,
      isDimmed,
      matches,
      traversedNodeIds,
      controllingNodeIds,
      collapsed,
      childrenOf,
      handleSelect,
      handleToggleCollapse,
      selectedId,
    ]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      visibleGraph.edges.map((edge) => {
        const onPath = chainEdges.has(edge.id);
        const dim = isDimmed(edge.source) || isDimmed(edge.target);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          pathOptions: { borderRadius: 14, offset: 12 },
          // The governed label is surfaced only on the path being explained,
          // so the canvas never carries 203 copies of the same wording.
          label: onPath && edge.label ? edge.label : undefined,
          labelShowBg: true,
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 6,
          labelBgStyle: { fill: "var(--pw-card)", stroke: "var(--pw-edge-strong)" },
          labelStyle: { fill: "var(--pw-card-fg)", fontSize: 10.5, fontWeight: 600 },
          style: {
            stroke: onPath
              ? "var(--pw-edge-strong)"
              : dim
                ? "var(--pw-edge-dim)"
                : edge.isSafetyOverride
                  ? "var(--pw-urgent-accent)"
                  : "var(--pw-edge)",
            strokeWidth: onPath ? 2.25 : 1.4,
            opacity: dim ? 0.35 : 1,
          },
          animated: false,
        };
      }),
    [visibleGraph, chainEdges, isDimmed]
  );

  /**
   * The viewport is controlled rather than driven through the imperative
   * helpers: `setCenter`/`fitView`/`zoomIn` from the instance resolved to a
   * store whose calls this canvas never received. Exact layout bounds are
   * already known here, so every viewport operation is computed directly.
   */
  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  /**
   * Default view. These trees are wide-and-shallow but very tall (23-40
   * sibling decisions), so fitting the whole graph shrinks the text to nothing.
   * Fitting the width instead keeps cards readable and lets the reader scroll
   * the pathway the way they would read it.
   */
  const fitWidth = useCallback(() => {
    const container = canvasRef.current;
    if (!container) return;
    const available = container.clientWidth;
    const visibleHeight = container.clientHeight;
    if (available <= 0 || visibleHeight <= 0) return;
    const zoom = Math.min(1, Math.max(0.45, available / layout.width));
    const graphHeight = layout.height * zoom;
    setViewport({
      x: (available - layout.width * zoom) / 2,
      y: graphHeight < visibleHeight ? (visibleHeight - graphHeight) / 2 : 0,
      zoom,
    });
  }, [layout]);

  /** Whole tree in view. Use for orientation, not for reading. */
  const fitAll = useCallback(() => {
    const container = canvasRef.current;
    if (!container) return;
    const available = container.clientWidth;
    const visibleHeight = container.clientHeight;
    if (available <= 0 || visibleHeight <= 0) return;
    const zoom = clampZoom(
      Math.min((available * 0.94) / layout.width, (visibleHeight * 0.94) / layout.height)
    );
    setViewport({
      x: (available - layout.width * zoom) / 2,
      y: (visibleHeight - layout.height * zoom) / 2,
      zoom,
    });
  }, [layout]);

  /** Zoom about the centre of the canvas, keeping that point fixed. */
  const zoomBy = useCallback((factor: number) => {
    const container = canvasRef.current;
    if (!container) return;
    const centreX = container.clientWidth / 2;
    const centreY = container.clientHeight / 2;
    setViewport((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const ratio = zoom / current.zoom;
      return {
        zoom,
        x: centreX - (centreX - current.x) * ratio,
        y: centreY - (centreY - current.y) * ratio,
      };
    });
  }, []);

  // Re-anchor whenever the visible tree changes shape.
  useEffect(() => {
    userMovedRef.current = false;
    const frame = window.requestAnimationFrame(() => fitWidth());
    return () => window.cancelAnimationFrame(frame);
  }, [fitWidth]);

  /**
   * Re-anchor when the canvas resizes. Needed on first paint (the app shell's
   * sidebar mounts after the graph, shrinking the canvas from 1178px to 990px
   * and leaving the initial fit stale) and for window resizing. A reader who
   * has panned or zoomed is left alone.
   */
  useEffect(() => {
    const container = canvasRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width === lastWidth || width === 0) return;
      lastWidth = width;
      if (!userMovedRef.current) fitWidth();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitWidth]);

  /** Bring a node to the centre of the canvas at readable zoom. */
  const focusNode = useCallback(
    (id: string) => {
      const container = canvasRef.current;
      const position = layout.positions.get(id);
      const size = layout.sizes.get(id);
      if (!container || !position || !size) return;
      const zoom = clampZoom(Math.max(0.75, Math.min(1, container.clientWidth / layout.width)));
      userMovedRef.current = true;
      setViewport({
        x: container.clientWidth / 2 - (position.x + size.width / 2) * zoom,
        y: container.clientHeight / 2 - (position.y + size.height / 2) * zoom,
        zoom,
      });
    },
    [layout]
  );

  const gotoMatch = useCallback(
    (offset: number) => {
      if (matchList.length === 0) return;
      const next = (matchIndex + offset + matchList.length) % matchList.length;
      setMatchIndex(next);
      setSelectedId(matchList[next]);
      focusNode(matchList[next]);
    },
    [matchList, matchIndex, focusNode]
  );

  /** A new search term restarts the match cursor. */
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setMatchIndex(0);
  }, []);

  const reset = useCallback(() => {
    setSelectedId(null);
    setQuery("");
    setMatchIndex(0);
    setCollapsed(
      initialCollapsed
        ? new Set(graph.nodes.filter((node) => node.kind === "GROUP").map((node) => node.id))
        : new Set()
    );
  }, [graph, initialCollapsed]);

  const toggleFullscreen = useCallback(() => {
    const element = shellRef.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card",
        isFullscreen && "rounded-none",
        className
      )}
    >
      <Toolbar
        graph={graph}
        query={query}
        onQuery={handleQueryChange}
        matchCount={matchList.length}
        matchIndex={matchIndex}
        onNextMatch={() => gotoMatch(1)}
        onPrevMatch={() => gotoMatch(-1)}
        mode={mode}
        onMode={setMode}
        onFit={fitAll}
        onFitWidth={fitWidth}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onReset={reset}
        onToggleMinimap={() => setShowMinimap((value) => !value)}
        showMinimap={showMinimap}
        isFullscreen={isFullscreen}
        onFullscreen={toggleFullscreen}
        navLinks={navLinks}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={canvasRef} className="relative min-h-[380px] flex-1">
          {mode === "graph" ? (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              onPaneClick={() => setSelectedId(null)}
              viewport={viewport}
              onViewportChange={setViewport}
              // React Flow passes the originating event only for user gestures;
              // programmatic viewport changes come through with none.
              onMoveStart={(event) => {
                if (event) userMovedRef.current = true;
              }}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              elementsSelectable
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              proOptions={{ hideAttribution: true }}
              className="h-full w-full"
              style={{ background: "var(--pw-canvas)" }}
              aria-label={`${graph.title} pathway diagram`}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1}
                color="var(--pw-canvas-dot)"
              />
              {/* The drawer takes the canvas width it would otherwise sit in. */}
              {showMinimap && !selectedNode && (
                <MiniMap
                  pannable
                  zoomable
                  ariaLabel="Pathway minimap"
                  nodeStrokeWidth={0}
                  nodeBorderRadius={2}
                  className="!hidden !rounded-lg !border !border-border !shadow-sm sm:!block"
                  style={{ background: "var(--pw-card)", width: 146, height: 104 }}
                  maskColor="color-mix(in srgb, var(--pw-canvas) 78%, transparent)"
                  nodeColor={(node) => {
                    const model = graph.nodes.find((candidate) => candidate.id === node.id);
                    return model ? TONE_STYLE[model.tone].accent : "var(--pw-edge)";
                  }}
                />
              )}
            </ReactFlow>
          ) : (
            <PathwayOutline
              graph={visibleGraph}
              childrenOf={childrenOf}
              root={root}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          )}

          <Legend />
        </div>

        {selectedNode && (
          <div className="max-h-[46vh] min-h-0 shrink-0 overflow-hidden border-t border-border lg:max-h-none lg:w-[360px] lg:border-t-0 xl:w-[400px]">
            <PathwayDetailPanel
              graph={visibleGraph}
              node={selectedNode}
              chain={chain}
              onClose={() => setSelectedId(null)}
              onSelect={(id) => {
                setSelectedId(id);
                focusNode(id);
              }}
              governance={governance}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

function NavLink({
  link,
  direction,
}: {
  link: { href: string; label: string } | null;
  direction: "previous" | "next";
}) {
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card";
  if (!link) {
    return (
      <span aria-hidden className={cn(base, "text-muted-foreground opacity-40")}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  const prefix = direction === "previous" ? "Previous pathway" : "Next pathway";
  return (
    <Link
      href={link.href}
      title={`${prefix}: ${link.label}`}
      aria-label={`${prefix}: ${link.label}`}
      className={cn(
        base,
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]",
        active
          ? "bg-accent-color text-white"
          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  graph,
  query,
  onQuery,
  matchCount,
  matchIndex,
  onNextMatch,
  onPrevMatch,
  mode,
  onMode,
  onFit,
  onFitWidth,
  onZoomIn,
  onZoomOut,
  onReset,
  onToggleMinimap,
  showMinimap,
  isFullscreen,
  onFullscreen,
  navLinks,
}: {
  graph: PathwayGraph;
  query: string;
  onQuery: (value: string) => void;
  matchCount: number;
  matchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  mode: "graph" | "outline";
  onMode: (mode: "graph" | "outline") => void;
  onFit: () => void;
  onFitWidth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onToggleMinimap: () => void;
  showMinimap: boolean;
  isFullscreen: boolean;
  onFullscreen: () => void;
  navLinks?: PathwayViewerProps["navLinks"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
      {/* Capped so a long governed view title cannot push the controls onto a
          second row. The page header already carries the full title. */}
      <div className="mr-auto min-w-0 max-w-[15rem] xl:max-w-sm">
        <p className="truncate text-[13px] font-semibold text-foreground" title={graph.title}>
          {graph.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {graph.counts.decisions} decision points · {graph.counts.outcomes} outcomes
          {graph.counts.urgent > 0 ? ` · ${graph.counts.urgent} safety stops` : ""}
        </p>
      </div>

      {(navLinks?.previous || navLinks?.next) && (
        <div className="flex items-center gap-1">
          <NavLink link={navLinks?.previous ?? null} direction="previous" />
          <NavLink link={navLinks?.next ?? null} direction="next" />
        </div>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) onPrevMatch();
              else onNextMatch();
            }
          }}
          placeholder="Search rule or clinical term…"
          aria-label="Search pathway"
          className="h-8 w-44 rounded-lg border border-border bg-card pl-7 pr-14 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)] sm:w-60"
        />
        {query && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
            {matchCount ? `${matchIndex + 1}/${matchCount}` : "0"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Graph view" onClick={() => onMode("graph")} active={mode === "graph"}>
          <Network className="h-4 w-4" aria-hidden />
        </IconButton>
        <IconButton
          label="Outline view"
          onClick={() => onMode("outline")}
          active={mode === "outline"}
        >
          <ListTree className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>

      {mode === "graph" && (
        <div className="flex items-center gap-1">
          <IconButton label="Zoom out" onClick={onZoomOut}>
            <ZoomOut className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Zoom in" onClick={onZoomIn}>
            <ZoomIn className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Fit width — readable" onClick={onFitWidth}>
            <MoveHorizontal className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Fit whole pathway to screen" onClick={onFit}>
            <Crosshair className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label="Toggle minimap" onClick={onToggleMinimap} active={showMinimap}>
            <MapIcon className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      )}

      <div className="flex items-center gap-1">
        <IconButton label="Reset view" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden />
        </IconButton>
        <IconButton
          label={isFullscreen ? "Exit full screen" : "Full screen"}
          onClick={onFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </IconButton>
      </div>
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto rounded-xl border border-border bg-card/95 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden />
          )}
          Legend
        </button>
        {open && (
          <ul className="space-y-1 border-t border-border px-2.5 py-2">
            {LEGEND_ORDER.map((tone) => {
              const style = TONE_STYLE[tone];
              const Icon = style.icon;
              return (
                <li key={tone} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                    style={{ background: style.bg, border: `1px solid ${style.border}` }}
                  >
                    <Icon className="h-2.5 w-2.5" style={{ color: style.accent }} aria-hidden />
                  </span>
                  {style.legend}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Outline (accessible, keyboard-first alternative to the canvas) ──────────

function PathwayOutline({
  graph,
  childrenOf,
  root,
  selectedId,
  onSelect,
}: {
  graph: PathwayGraph;
  childrenOf: Map<string, string[]>;
  root: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);

  const renderNode = (id: string, depth: number): React.ReactNode => {
    const node = byId.get(id);
    if (!node) return null;
    const style = TONE_STYLE[node.tone];
    const Icon = style.icon;
    const kids = (childrenOf.get(id) ?? []).filter((child) => byId.has(child));
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]",
            selectedId === id ? "bg-muted" : "hover:bg-muted/60"
          )}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: style.accent }} aria-hidden />
          <span className="min-w-0 flex-1">
            {node.ruleId && node.kind === "DECISION" && (
              <span className="mr-1.5 font-mono text-[10.5px] font-bold text-muted-foreground">
                {node.ruleId}
              </span>
            )}
            <span className="text-[12.5px] leading-snug text-foreground">{node.title}</span>
            {node.timing && (
              <span className="ml-1.5 text-[11px] font-semibold" style={{ color: style.accent }}>
                {node.timing}
              </span>
            )}
          </span>
        </button>
        {kids.length > 0 && <ul>{kids.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--pw-canvas)] p-3">
      <ul className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-2">
        {renderNode(root, 0)}
      </ul>
    </div>
  );
}
