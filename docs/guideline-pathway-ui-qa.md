# Guideline pathway UI — redesign and visual QA record

Branch: `codex/versioned-clinical-rule-studio`
Governed dataset: **CG-NCSP-3.1.0** — 203 rules · 422 nodes · 421 edges · 12 views
(verified against the built snapshot, not assumed).

---

## 1. Root cause of the previous diagrams

The governed snapshot is a four-level catalogue, not a branching tree:

```
node:root (START)
  └─ node:section:*  (ROUTER)    15 governed sections
       └─ node:rule:*   (DECISION)  203 governed rule conditions
            └─ node:outcome:*       203 governed provisional outcomes
```

`1 + 15 + 203 + 203 = 422` nodes and `15 + 203 + 203 = 421` edges.

Every `GraphView` except `master` lists **only the `rule → outcome` pairs**. Measured
per view, before the change:

| View | Nodes | Edges | Connected components |
|---|---|---|---|
| global-router-safety | 56 | 28 | **28** |
| transition-hpv-primary | 26 | 13 | **13** |
| primary-hpv-screening | 46 | 23 | **23** |
| low-grade-post-colposcopy | 36 | 18 | **18** |
| high-grade-post-colposcopy | 36 | 18 | **18** |
| hsil-treatment-test-of-cure | 34 | 17 | **17** |
| glandular-ais | 38 | 19 | **19** |
| hysterectomy-vaginal-vault | 80 | 40 | **40** |
| pregnancy | 28 | 14 | **14** |
| bleeding-safety-overrides | 30 | 15 | **15** |
| special-populations-overlays | 48 | 47 | 1 |
| master | 422 | 421 | 1 |

Ten of the twelve views were **fully disconnected sets of two-node fragments**. The
renderer then ran ELK `layered` with `separateConnectedComponents: true` and
`elk.componentCompaction.componentLayoutAlgorithm: PACKED_RECT`, which packs those
fragments into a rectangle with 96px component spacing.

That is the single cause behind every reported symptom — unbalanced nodes, awkward
spacing, crossing/floating connectors, "too dense here, too empty there", and no
readable hierarchy. No amount of styling could fix it, because there was no
hierarchy being drawn.

## 2. The fix

`lib/clinical-rules/pathway-view-model.ts` rebuilds each view as a connected tree by
walking the governed parent edges that already exist in `snapshot.edges`. Nothing
clinical is invented: every emitted edge is a governed edge, except one synthetic
ENTRY node per non-master view that carries the governed view title.

After the change, all 12 views are a single connected component, depth 3, with
`edges === nodes - 1` (a strict tree) and zero orphans.

`lib/clinical-rules/pathway-layout.ts` replaces the general graph engine with a
deterministic tidy-tree layout, which for a tree guarantees zero crossings, one
column per depth, space proportional to subtree size, and testable output.

---

## 3. Visual QA ledger

Method: each view opened in the running app, fitted, inspected visually, then
measured in the live DOM (pairwise node-overlap test, column alignment, text-clip
test, viewport zoom, horizontal-overflow test). Desktop 1280×720 unless noted.

| # | Pathway | Nodes | Edges | Columns | Overlaps | Clipped text | Overflow | Zoom | Result |
|---|---|---|---|---|---|---|---|---|---|
| 0 | NCSP Master Decision Tree | 422 (16 collapsed) | 421 | 4 | 0 | 0 | 0 | 0.97 | **PASS** |
| 1 | Global Router and Safety Gates | 60 | 59 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 2 | Transition to HPV Primary Screening | 29 | 28 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 3 | Primary HPV Screening | 49 | 48 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 4 | Normal Colposcopy after Low-Grade Cytology | 40 | 39 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 5 | Normal Colposcopy after High-Grade Cytology | 39 | 38 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 6 | HSIL Treatment and Test of Cure | 37 | 36 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 7 | Glandular Abnormalities and AIS | 41 | 40 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 8 | Total Hysterectomy and Vaginal Vault Follow-Up | 84 | 83 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 9 | Pregnancy Pathway | 30 | 29 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 10 | Abnormal Vaginal Bleeding | 32 | 31 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |
| 11 | Special Populations and Immune-Deficiency Overlays | 48 | 47 | 4 | 0 | 0 | 0 | 0.825 | **PASS** |

`GUIDELINE_UI_VISUAL_QA_PASSED`

### Exceptional layout decisions, and why

1. **Flow is left-to-right, consistently, on all 12 views.** These trees are shallow
   (depth 3) and very wide (13–40 sibling decisions). Top-to-bottom would make a
   single pathway roughly 11,000px wide; left-to-right makes the decision column read
   like a clinical list. The shape is identical across all views, so one convention
   fits all of them.

2. **The default view fits the width, not the whole graph.** A 40-decision pathway is
   ~4,000px tall. Fitting the whole graph shrinks 12px text to nothing. Fit-width
   keeps cards readable and lets the reader scroll the pathway the way they would read
   it; a separate "Fit whole pathway to screen" control gives the overview.

3. **Parents whose children span more than 320px are aligned to their first child**
   rather than centred. Centring puts a section heading halfway down a 2,700px column,
   where it is off-screen for most of the scroll. Tight fan-outs keep the centred
   org-chart look.

4. **The master view starts with its 15 sections collapsed.** 203 decisions in one
   frame is not readable; each section expands in place with a `+N` control.

5. **Canvas edge labels are suppressed where they repeat the target card.** The
   governed data has no yes/no branch semantics — all 203 `rule → outcome` edges read
   "Source condition met", `section → rule` edges carry the rule id, and
   `root → section` edges carry the section title. Stamping those across the canvas is
   noise, and inventing "Yes"/"No" wording is not permitted. The governed label is
   retained on the edge and shown on the highlighted path and in the detail drawer.

6. **Structured conditions render as facet lines.** The 21 Table 1 combinations are
   `Prior history: …; indication: …; specimen: …` and differ only in the final clause,
   so truncation produced four consecutive identical-looking cards. They now render one
   facet per line, keeping the discriminating clause visible.

### Responsive QA

| Width | Result | Notes |
|---|---|---|
| 1440 | **PASS** | Toolbar on one row; zoom ≈0.94. |
| 1280 | **PASS** | Toolbar wraps to two rows; zoom 0.825; cards readable. |
| 1024 | **PASS** | Sidebar collapses to a menu button; canvas takes full width. |
| 768 | **PASS** | Toolbar wraps; graph readable and pannable; controls do not overlap. |

The detail drawer becomes a bottom panel (max 46vh) below the `lg` breakpoint. The
minimap is hidden below `sm` and while the drawer is open.

### Dark mode

Verified by computed style, not by eye: card, canvas, edge and every tone token are
defined for both `:root` and `[data-theme="dark"]` in `app/globals.css`, so the
palette follows the app's own theme toggle (Tailwind's `dark:` variant does not,
because the app switches on `data-theme`).

One genuine defect was found and fixed: the authority note on the Guidelines home used
`bg-info-bg` with `text-foreground`; `--color-info-bg` has no dark override, so it
rendered near-white text on a near-white panel. It now uses the pathway tokens.

### Accessibility

- Every node is a `button` with an `aria-label` carrying its type and full governed
  wording, and is keyboard-focusable with a visible focus ring.
- Tone is never the only signal: each card carries an icon and a text type badge, and
  a coloured left rail.
- An **Outline view** renders the same tree as a nested list with full untruncated
  wording — a genuine keyboard/screen-reader path through the pathway, not a fallback.
- The canvas has an `aria-label`; the minimap, legend and all controls are labelled.
- Red is reserved for the 16 governed `SAFETY_STOP` nodes (3.8% of nodes); amber
  is reserved for clinician-review states. Asserted by test.

---

## 4. Clinical observations (reported, not changed)

1. **Eight governed rules carry 2–3 distinct outcome branches that the governed graph
   collapses into a single outcome node**: `F3-05`, `F3-10`, `F3-19`, `F4-04`, `F4-07`,
   `F7-02`, `F10-06`, `A26-08`. The graph stores one `node:outcome:*` per rule, so the
   diagram under-represents genuine clinical branching for these eight.

   *Handled by surfacing, not by editing:* the decision card shows an "N branches"
   badge and the detail drawer lists every governed branch with its own wording,
   timing, care setting and reviewer requirement. No node was added to or removed from
   the governed graph.

2. **The governed graph carries no branch-condition semantics on its edges.** Rules are
   independent condition → outcome pairs rather than yes/no forks. Any "Yes"/"No"/
   "Detected"/"Not detected" edge labelling would have to be invented, so none was
   added. This is a property of the source package, worth noting for a future revision.

3. **One hand-drawn renderer remains, deliberately.** `/pathway/[sessionId]/result`
   still uses `lib/decision-trees` + `components/clinical/FlowDiagram` to show the
   *legacy* engine's own decision, highlighted by legacy recommendation codes
   (`F1-NEG-5Y`, …). Those codes have no governed mapping to the canonical rule ids
   (`F3-01`, …); creating one would mean inventing clinical equivalence. It has been
   removed from the Guidelines surface, which is now canonical-only.

---

## 5. Verification

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint -- --max-warnings=100` | 0 errors, 21 warnings — all pre-existing, none in new code |
| `npm run test:all` | **938 pass / 0 fail** (28 new tests) |
| `npm run build` | pass — all routes built |
| `git diff --check` | clean |

New tests: `lib/clinical-rules/__tests__/pathway-view-model.test.ts` (17) and
`lib/clinical-rules/__tests__/pathway-layout.test.ts` (11). They assert the governed
counts, single-tree connectivity for all 12 views, governed ordering, that clinical
wording/timing/priority/reviewer/missing-information are carried through unchanged,
that only the entry node is synthetic, zero node overlaps, one column per depth,
bounded sibling spacing, and layout determinism.

A pre-existing hydration warning is present on pages this work did not touch (for
example `/dashboard`); it comes from the client-applied theme attribute and is out of
scope here.
