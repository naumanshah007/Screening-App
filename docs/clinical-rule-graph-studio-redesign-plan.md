# Clinical Rule Graph Studio — UX and Interaction Redesign Plan

Status: Phase 1 foundation and pathway-legibility pass implemented; later phases remain planned
Scope: the canonical clinical graph editor rendered by
`components/clinical-rules/ClinicalRuleGraphStudio.tsx`
Baseline: 203 canonical rules, 422 nodes, 421 edges, and 12 synchronized views

Implementation checkpoint (2026-08-10): the studio now opens on a pathway summary map rather than
the 422-node detail canvas; provides synchronized Map, Pathway, and Outline modes; uses contextual
cross-pathway search; opens pathways at a readable node-level zoom; has explicit route-highlight
scopes and zoom controls; uses redesigned node cards and smooth-step edges; supports a collapsible
inspector; gates authoring behind an explicit View/Edit switch; and applies a stronger ELK layered
profile for user-requested layout operations.

Pathway-legibility checkpoint (2026-08-10): every pathway now receives a non-destructive
top-to-bottom presentation layout on entry. The visual language reuses the proven case-pathway
diagram: navy entry pills, white decision diamonds, compact process cards, and risk-coloured
outcomes. Each governed pathway is partitioned into route-group tabs of approximately ten nodes,
keeping a complete branch group readable without removing canonical content. A layout-only shared
anchor aligns disconnected rule pairs into consistent decision and outcome rows. Nodes use measured
shape-specific dimensions, separate branch lanes, wider channels, persistent endpoint ports, closed
arrowheads, and branch-condition chips lifted away from connector lines. Search opens the exact
pathway and route tab containing its result. The inspector overlays the full-width canvas rather
than compressing it, and Map, Pathway, and Outline share a responsive full-height workspace.
“Space nodes” reapplies the readable layout; in Edit mode the result is saved as view placement,
while View mode remains non-destructive.

The remaining phases cover true compound clusters, semantic rendering thresholds, Web Worker
layout scoring, typed undo/redo, and impact-aware edit dialogs.

All-pathway collision audit (2026-08-10): the rendered successor snapshot was exercised through
all 11 governed pathways and every generated route group. The audit covered 45 route tabs and 458
rendered node instances, checking node-to-node, branch-label-to-node, and branch-label-to-label
rectangles after ELK layout. It found zero collisions. The production screenshot that still shows
overlapping card nodes is the pre-redesign deployment; it does not contain the compact shape system
or route-group tabs implemented on this branch.

## 1. Outcome

Redesign the current graph from a poster-like canvas into a clinical rule workspace that is:

- readable without requiring users to hunt with extreme zoom;
- safe and predictable to edit;
- fast with the complete 422-node canonical snapshot;
- easy to navigate by pathway, route, rule ID, source, and clinical term;
- stable under automatic layout, so small edits do not rearrange an entire pathway;
- accessible by keyboard and through a non-canvas outline view;
- explicit about which changes affect clinical logic and which affect layout only.

The most important design decision is: **the 422-node master graph must not render as 422 detailed
cards by default.** The master is an overview of pathway clusters. Detailed nodes appear after a
user enters a pathway, focuses a branch, searches for a rule, or zooms to a readable semantic level.

## 2. Current-state findings

The current implementation has solid foundations: React Flow, canonical stable IDs, a separate
inspector, search, a minimap, keyboard selection, autosave, audit history, and ELK layered layout.
The redesign should retain these foundations.

The main problems are structural rather than cosmetic:

1. The app calls `fitView` when a view opens. On a very large view, fitting all content produces
   unreadably small nodes and labels.
2. Every node uses the same 250 px card even though routers, decisions, actions, reviews, safety
   stops, and outcomes carry different information.
3. “Collapse clusters” currently removes all non-root/non-section nodes. It does not create useful
   cluster summaries or proxy connections, so the collapsed graph loses the pathway story.
4. Search jumps to the first substring match without showing result context or alternatives.
5. Route highlighting means all ancestors plus all descendants. On a branching graph this often
   highlights too much to answer “how did I get here?” or “what happens next?”.
6. The canvas toolbar competes with the graph and can wrap into a large floating block.
7. The inspector is always 390 px wide on desktop, even when it is empty. The canvas is therefore
   compressed at the exact moment the user needs an overview.
8. The current ELK call supplies fixed 250 × 120 dimensions, only four layout options, no ports,
   no orthogonal edge routing, no hierarchy, and no mental-map preservation.
9. Editing uses direct drag-to-connect and edge reconnect gestures for governed clinical branches.
   These are efficient for diagramming but too easy to trigger for safety-sensitive rule authoring.
10. Every field edit clones the entire snapshot, rebuilds flow nodes/edges, and schedules a save.
    That will feel increasingly heavy at 422 nodes and complicates undo/redo.
11. Raw X/Y fields expose implementation detail rather than useful layout intent.
12. The node colors carry too much meaning alone, while type, risk, executability, governance, and
    validation are competing concepts.

## 3. Information architecture

Use three explicit workspaces inside the studio.

### 3.1 Map

The default master view. It shows 10–12 pathway cluster cards and their high-level relationships,
not every canonical node. Each cluster card includes:

- pathway name and description;
- rule/node count;
- critical/high-risk count;
- validation blockers and warnings;
- source verification status;
- local-change indicator;
- “Open pathway” action.

Selecting a cluster previews its summary in the inspector. Double-clicking or pressing Enter opens
that pathway. Aggregated inter-cluster edges remain visible, with a count rather than individual
branch labels.

### 3.2 Pathway

The primary reading and editing workspace. It renders one pathway or one focused branch at a
readable scale. This is where node cards, branch labels, route tracing, editing, layout, and
simulation live.

### 3.3 Outline

A synchronized, non-canvas representation using a tree/list/table pattern. It is not a fallback
afterthought; it is the fastest mode for keyboard navigation, auditing, bulk scanning, and screen
readers. Selecting a row selects and centers the same node in the canvas.

Recommended outline columns: order, type, clinical label, incoming condition, outcome/timing,
risk, reviewer requirement, source, validation state, and changed status.

## 4. Proposed screen

```text
┌ Clinical pathways / Abnormal vaginal bleeding ─ Draft · saved ── Validate ─ Publish ┐
├ Map | Pathway | Outline       Search rules, nodes, sources…       View | Edit        ┤
├ Breadcrumb: All pathways › Abnormal bleeding › Initial assessment                   ┤
├───────────────────────────────────────────────────────────┬─────────────────────────┤
│ [Undo] [Redo]  Add ▾  Layout ▾  Route ▾       100%  −  +  Fit selection  Home      │
│                                                           │                         │
│                focused, readable pathway                  │  Inspector              │
│                                                           │  Summary                │
│      ┌ Decision ─ F10-03 ───────────────┐                 │  Logic                  │
│      │ Persistent abnormal bleeding?   │── Yes ───────┐  │  Outcome                │
│      │ HIGH · clinician review         │              │  │  Safety                 │
│      └─────────────────────────────────┘              │  │  Evidence               │
│                    │ No                               ▼  │  Change history         │
│                    ▼                         ┌ Review ───────────────┐              │
│      ┌ Outcome ───────────────────────┐      │ Clinical assessment │              │
│      │ Continue routine pathway       │      └─────────────────────┘              │
│      └────────────────────────────────┘                                           │
│                                                                                   │
│ [Minimap]  7 of 31 nodes visible · 1 route highlighted                            │
├───────────────────────────────────────────────────────────┴─────────────────────────┤
│ Blockers 0 · Warnings 2 · Source text 3 · Last clinical change by …                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

The inspector is closed by default when nothing is selected and opens as a resizable panel. It can
be pinned, collapsed to a rail, or moved into a full-width drawer on narrower screens.

## 5. Semantic zoom and navigation

Physical zoom alone cannot solve large-graph readability. Use semantic levels:

| Level | Approximate zoom | Rendering |
|---|---:|---|
| L0 — map | below 35% | pathway/section clusters and aggregated edges only |
| L1 — structure | 35–65% | compact node shapes, short labels, risk/type icons |
| L2 — readable | 65–130% | full node title, rule ID, key badges, branch labels |
| L3 — inspect | above 130% | optional description preview, ports, editing affordances |

Transitions should be debounced and animated briefly; they must not change selection or move the
viewport. The number of visible details changes, not canonical graph membership.

Viewport behavior:

- Open master at L0 with clusters fitted, never all detailed nodes.
- Open a pathway at a stored sensible viewport or fit its top two levels, not necessarily the
  entire pathway.
- `Home` returns to the pathway entry node at readable zoom.
- `F` fits the selected node/branch; `Shift+F` fits the current pathway.
- `0` resets to 100%; `+`/`−` zoom in fixed steps; display the current percentage.
- Double-click a cluster to enter it; `Esc` moves one focus level upward.
- Trackpad pinch zooms around the pointer. Wheel scroll pans by default; Ctrl/Cmd+wheel zooms.
- Preserve the viewport independently per view and per user. Do not write ordinary navigation to
  the governed clinical snapshot.
- Provide a “Zoom to readable” action when the current zoom makes full labels unavailable.

## 6. Node and edge visual system

### 6.1 Node hierarchy

Use shape and structure for node type; reserve color primarily for safety/state.

- Start/router: compact pill or header node.
- Decision: standard card with a question icon and visible ordered output ports.
- Action/review/referral: card with action verb, destination, and reviewer badge.
- Outcome/terminal: visually final card with the provisional outcome and timing.
- Safety stop: strong stop shape/icon and red semantic token.
- Repeat/timer: loop icon with the interval visually prominent.
- Subflow: linked-card treatment with destination pathway and “open” affordance.
- Information: neutral note style; never confused with executable logic.

At readable zoom, cards should target 280–320 px width, a minimum 44 px interactive height, and a
maximum of three label lines. Full source wording remains in the inspector and tooltip/popover.
Cards must not truncate the distinguishing clinical clause. When necessary, generate a governed
`shortLabel`; do not derive an ambiguous truncation at runtime.

Each card presents information in a fixed order:

1. type and stable rule ID;
2. short clinical label;
3. one primary state badge (critical risk, non-executable, validation error, or local fork);
4. optional outcome/timing line where relevant.

### 6.2 Color rules

- Red: urgent safety/critical blocker only.
- Amber: review required, warning, or source-text/non-executable state.
- Purple: specialist/MDM destination.
- Teal/navy: neutral routing and selection.
- Green: terminal completion or validated success.
- Grey: disabled, historical, or intentionally dimmed.

Every color meaning also has an icon, label, border/pattern, or shape. Selection uses a separate
high-contrast focus ring and cannot be mistaken for clinical risk.

### 6.3 Edges

- Use orthogonal routing for normal pathway reading.
- Place branch labels close to the source port, where the decision is made.
- Give every decision output its own ordered port to reduce immediate crossings.
- Use solid lines for executable conditions; dashed amber for source-text/non-executable branches;
  red with a shield marker for safety overrides; a loop marker for explicit cycles.
- Keep unselected edges quiet. Hovering an edge increases contrast and reveals its full condition.
- Route highlighting offers three explicit scopes: “Path to here”, “What follows”, and “Both”.
- When several edges share a long segment, visually bundle the trunk but preserve separate hit
  targets and labels near their divergence.

## 7. Collapse, focus, and search

Replace the current binary collapse switch with real hierarchical disclosure:

- Expand/collapse each cluster independently.
- Global depth controls: Overview, 1 level, 2 levels, All.
- A collapsed cluster remains a visible summary node with aggregated incoming/outgoing proxy edges.
- Store expanded clusters as view state, not clinical content.
- Focus on selection hides unrelated nodes and shows a breadcrumb back to the complete pathway.
- “Neighbourhood” focus can show N hops around a selected node (default 2).

Search should open a command palette with grouped results and context:

```text
F10-03  Persistent abnormal bleeding?       Node · Abnormal bleeding › Assessment
F10-03  NCSP Guidelines p. 84                Source reference
Review  Clinical review required             Outcome
```

Search requirements:

- fuzzy matching across labels, short labels, IDs, descriptions, conditions, outcomes, sources,
  risk, and reviewer requirement;
- filters for view, node type, risk, executable state, validation state, and changed status;
- keyboard result navigation;
- selecting a result opens its cluster ancestors, switches to its pathway if needed, centers it at
  readable zoom, and preserves a visible “back to search results” trail;
- never silently select only the first match.

## 8. Safe editing model

Separate View and Edit modes. Entering Edit mode is permission-gated and visually persistent.

Recommended editing behavior:

- Add node/branch through a guided menu or inspector form, not an unlabeled canvas gesture.
- Keep handles hidden in View mode. In Edit mode, show ports only on selected/hovered nodes.
- Reconnecting an edge requires a confirmation summarizing old and new source/target and affected
  rules. Clinical validation runs before the change is accepted into the working copy.
- Replace raw X/Y inputs with Align, Distribute, Pin, Unpin, Reset position, and Layout selection.
  Advanced coordinates can remain behind a developer disclosure if needed.
- Support multi-select for layout operations only at first; clinical bulk edits need a separate,
  explicit workflow.
- Maintain an exact typed operation history: add node, add branch, edit condition, edit outcome,
  reconnect, reorder, move, delete, and layout. Provide undo/redo and a visible change list.
- Coalesce text input into one undo operation per field-edit session.
- Keep three dirty-state labels distinct: `Unsaved`, `Saving`, `Saved revision N`. A failed save
  remains visibly unsaved and offers retry.
- Checkpoint and validation remain explicit. Autosave updates a draft working copy; it must not
  imply clinical approval.
- Warn before leaving with failed or outstanding autosave.
- Deletion always shows connected edges, linked rules, affected views, validation impact, and any
  known case impact. Never automatically promote children.

Inspector organization should describe the clinical object, not its storage schema:

1. Summary
2. Logic / branch condition
3. Outcome and timing
4. Safety and review
5. Evidence and sources
6. Placement (view membership and layout intent)
7. Change history

## 9. Layout algorithm

Retain ELK, but use it as a deterministic layout service with graph semantics rather than the
current minimal one-shot call.

### 9.1 Layout pipeline

1. Build a normalized layout graph from visible canonical nodes plus synthetic cluster/proxy nodes.
2. Measure actual rendered node dimensions before layout; never assume all nodes are 250 × 120.
3. Assign fixed ports and port sides from edge direction and ordered branch position.
4. Condense explicit cycle regions for ranking; preserve cycle edges and render them as return loops.
5. Lay out cluster hierarchy first, then children within each expanded cluster.
6. Use ELK layered layout with orthogonal edge routing.
7. Apply pinned node constraints and preserve the previous order/coordinates where possible.
8. Run overlap removal and label collision checks.
9. Animate only nodes that moved a modest distance. For a major re-layout, preview before applying.
10. Save layout as a separate typed layout operation; allow undo.

### 9.2 Recommended initial ELK profile

Use top-to-bottom for most focused clinical pathways because wide text cards and ordered branching
read naturally downward. Offer left-to-right as a per-view layout preference for linear pathways.

Initial options to prototype and measure:

```text
elk.algorithm                                  layered
elk.direction                                  DOWN
elk.edgeRouting                                ORTHOGONAL
elk.hierarchyHandling                          INCLUDE_CHILDREN
elk.layered.nodePlacement.strategy             NETWORK_SIMPLEX
elk.layered.crossingMinimization.strategy      LAYER_SWEEP
elk.layered.considerModelOrder.strategy         NODES_AND_EDGES
elk.portConstraints                            FIXED_SIDE
elk.spacing.nodeNode                           36
elk.layered.spacing.nodeNodeBetweenLayers      72
elk.spacing.edgeNode                           24
elk.layered.spacing.edgeEdgeBetweenLayers      18
elk.separateConnectedComponents                true
```

These are starting values, not design truth. Benchmark at least the largest pathway, the most
branching pathway, the cycle-heavy pathway, and the full cluster map.

### 9.3 Layout scopes

- Tidy selection: local nodes only; surrounding graph remains fixed.
- Tidy branch: selected node plus descendants until terminals/subflow boundaries.
- Tidy cluster: one expanded pathway/section.
- Tidy view: complete current pathway, with preview.

Never auto-layout the entire canonical master as detailed cards during ordinary editing.

### 9.4 Quality score

Use a deterministic composite score to compare candidate settings:

- edge crossings (highest penalty);
- node and label overlaps (must be zero);
- backward edges outside declared cycles;
- total edge bends and edge length;
- aspect ratio against the available canvas;
- displacement of unchanged nodes from the previous layout;
- sibling order violations;
- distance from a source decision to its branch labels.

Select the lowest-scoring valid layout. For small graphs, run several bounded ELK profiles in a Web
Worker and select the best. For larger graphs, use the view’s proven profile to keep latency
predictable.

## 10. Performance architecture

Target smooth pan/zoom and sub-second navigation on the full snapshot.

- Render cluster summaries in the master map; do not mount 422 detailed React cards at L0.
- Only render full HTML content for nodes in or near the viewport. Off-screen nodes may use compact
  shells where React Flow’s visibility behavior needs assistance.
- Memoize node and edge components and pass stable data references.
- Index nodes, edges, rules, and adjacency maps once per snapshot revision.
- Replace repeated array scans and `includes` calls with maps/sets.
- Keep canonical snapshot state separate from ephemeral UI state and the React Flow render model.
- Update one entity/field through a reducer or normalized store instead of `structuredClone` of the
  entire snapshot on every keystroke.
- Move ELK and layout scoring into a Web Worker; cancel stale requests.
- Debounce semantic-detail transitions during continuous zoom.
- Do not animate hundreds of nodes simultaneously.

Performance budgets on a representative production laptop:

- initial cluster map interactive: under 1.5 s after data is available;
- open pathway: under 500 ms cached, under 1 s including layout;
- search results: under 100 ms;
- select and inspector update: under 100 ms;
- pan/zoom: target 60 fps, never sustained below 40 fps;
- local layout: under 750 ms; complete pathway layout: under 2 s with progress/cancel;
- ordinary edit typing must not trigger visible canvas re-layout.

## 11. Accessibility and responsive behavior

- Meet WCAG 2.2 AA contrast and focus visibility.
- Provide full keyboard actions: arrow/spatial node traversal, Enter inspect/open, Space select,
  Escape move up/close, shortcuts discoverable in a help overlay.
- Use roving tabindex rather than putting hundreds of nodes in the natural Tab order.
- Announce selection, visible node/edge counts, focus scope, save state, and validation result through
  concise live regions.
- Outline mode exposes equivalent content and editing entry points without relying on spatial
  comprehension.
- Maintain 44 × 44 px touch targets for primary canvas controls.
- At widths below 1280 px, move the inspector to a drawer. Below 900 px, default to Outline/Map and
  make the detailed canvas an explicit landscape/fullscreen experience.
- Respect reduced motion and provide a high-contrast mode that does not depend on node fills.

## 12. Validation and governance integration

Validation must be spatially actionable:

- Persistent footer/status bar shows blocker, warning, source-text, and local-change counts.
- Clicking a count opens a filtered issue list.
- Selecting an issue opens the correct pathway, expands ancestors, centers the node/edge, and opens
  the relevant inspector section.
- Invalid nodes/edges get a badge and outline, but the whole graph is not flooded with red.
- A “Next issue” command supports sequential remediation.
- Layout-only changes are labelled and reviewed separately from clinical-logic changes.
- Before checkpoint/validation, show a semantic change summary: nodes/edges added, deleted,
  reconnected, condition/outcome/safety/source changes, and layout-only moves.

## 13. Delivery plan

### Phase 0 — Baseline and prototype fixtures

- Capture current screenshots and task timings at master and pathway level.
- Select four benchmark graphs: largest, widest, most branching, and cycle-heavy.
- Record node/edge counts, current crossings, bounds, initial zoom, interaction latency, and layout
  duration.
- Confirm user roles and whether reviewers are allowed to edit or only comment/approve.

Acceptance: benchmark dataset and reproducible visual fixtures exist; no clinical snapshot is
changed.

### Phase 1 — Shell, modes, and viewport

- Build Map / Pathway / Outline modes.
- Make the inspector collapsible/resizable.
- Replace the toolbar with a compact command bar.
- Add breadcrumbs, zoom percentage, fit selection, Home, and per-view viewport persistence.

Acceptance: opening master never produces unreadable detailed cards; every pathway is reachable in
two interactions or by search; navigation never dirties the clinical draft.

### Phase 2 — Semantic rendering and real collapse

- Implement cluster summary nodes, proxy edges, per-cluster disclosure, and semantic zoom.
- Introduce type-specific node cards and the revised edge system.
- Add route scopes: path to here, descendants, both, and matched case.

Acceptance: labels at the default pathway zoom are readable; collapsed graphs preserve meaningful
connectivity; node meaning does not rely on color.

### Phase 3 — Search, outline, and issue navigation

- Add indexed command-palette search, filters, context, and result trail.
- Build synchronized outline mode and keyboard navigation.
- Connect validation counts/issues to graph focus.

Acceptance: users can find any stable rule ID, source reference, risk, or clinical term; all graph
content is inspectable without a pointer device.

### Phase 4 — Layout engine v2

- Add measured nodes, ports, orthogonal routing, hierarchy, pinned nodes, local layout scopes, Web
  Worker execution, scoring, preview, and undo.
- Tune profiles against the four benchmark graphs.

Acceptance: zero node overlaps and zero label/node collisions in fixtures; declared sibling order
is preserved; local layout does not substantially move unrelated nodes; complete pathway layout
meets the performance budget.

### Phase 5 — Safe editing and history

- Introduce explicit Edit mode, guided add/reconnect/delete workflows, typed operation history,
  undo/redo, robust dirty/save state, and semantic change summary.
- Replace raw coordinate editing with layout intent controls.

Acceptance: every mutation is reversible; no clinical connection can be changed accidentally by a
single drag; save failures remain visible; existing optimistic revision checks still prevent lost
updates.

### Phase 6 — Quality, accessibility, and rollout

- Add unit, interaction, accessibility, performance, and visual-regression coverage.
- Conduct moderated usability sessions with at least one clinical reviewer and one rule author.
- Roll out behind a feature flag, retaining the current studio for comparison and fallback.

Acceptance: benchmark tasks meet the success metrics below; snapshot schema, checksum, validation,
diff, export, and audit tests remain green.

## 14. Test strategy

- Pure graph tests: ancestor/descendant scopes, cluster aggregation, proxy edges, focus extraction,
  cycle condensation, port assignment, and layout determinism.
- Layout fixture tests: no overlaps; order constraints; stable output; bounds and crossing score.
- Component tests: semantic zoom thresholds, search result navigation, selection synchronization,
  controlled editing, undo/redo, save failure/retry, and issue jumping.
- Accessibility tests: keyboard-only benchmark paths, roving tabindex, names/roles, live regions,
  contrast, reduced motion, and Outline equivalence.
- Visual regression at 1440 × 900, 1920 × 1080, 1280 × 800, and narrow drawer layouts.
- Performance test with 422 nodes/421 edges plus a synthetic 1,000-node safety ceiling.
- Clinical regression: graph edits must still pass schema validation, checksum determinism,
  evaluation, source preservation, visual membership, and layout-only diff tests.

## 15. Success metrics

In moderated testing:

- find a known rule from the master view in under 15 seconds;
- explain the path to a selected outcome in under 30 seconds;
- identify whether a branch is executable, safety-critical, or review-only with at least 95%
  accuracy;
- add a governed branch and validate it without direct coordinate editing;
- undo any edit confidently in one action;
- no accidental edge reconnects or unacknowledged destructive changes;
- at least 90% task completion without facilitator help;
- System Usability Scale target of 85 or better for the graph tasks.

Technical success:

- zero node overlaps and label/node collisions in the benchmark fixtures;
- no unintended canonical-data changes caused by navigation, zoom, collapse, or layout preview;
- no clinical-logic differences when applying a layout-only operation;
- all current clinical-rule tests continue to pass.

## 16. Decisions to resolve before implementation

1. Should reviewer roles be read/comment/approve only, or may they directly edit a draft?
2. Are verified source-projection coordinates immutable evidence, a starting layout, or freely
   replaceable presentation data? Preserve them separately if they are evidence.
3. Should user viewport and expanded-cluster preferences sync across devices or remain local?
4. Which pathway should be the design/tuning pilot? Recommended: the largest branching pathway,
   with abnormal vaginal bleeding included as a safety-focused secondary fixture.
5. Is top-to-bottom the preferred clinical reading direction, or must verified source orientation
   remain left-to-right? The system can support both, but each view needs one governed default.
6. What is the required browser/device floor for touch and trackpad behavior?

## 17. Recommended implementation order

Do **not** begin by restyling the existing 250 px cards. First implement the Map/Pathway distinction,
viewport behavior, and real cluster disclosure. Those changes solve the readability problem. Then
add semantic rendering and layout v2. Safe editing and advanced visual polish should build on that
stable navigation model.
