# Accessibility and large-graph performance QA

QA date: 2026-08-03. Surface: authenticated Rule Studio for the source-derived `CG-NCSP-3.1.0` draft in an isolated clean-checkout database. This is software-conformance and usability evidence only. Reviewer confirmation remains required; the graph is not for direct clinical action.

## Outcome

All 12 synchronized views rendered and remained navigable. The 422-node master tree, controls, minimap, inspector, source search, keyboard selection, branch highlighting and responsive layouts were exercised in the in-app browser. The final fresh browser tab reported zero console errors or warnings.

Browser QA found and corrected three release-hardening defects:

1. React Flow controls were unstyled because the package stylesheet was not loaded.
2. PNG export tainted its canvas when rasterising an SVG `foreignObject`; PNG now rasterises the rendered graph directly and reports failures through the visible notification surface.
3. Evaluated drafts looked editable even though the database correctly rejects identity changes; evaluated snapshots are now visibly read only and instruct the user to clone a new semantic version.

Fullscreen permission is unavailable inside the in-app browser. The control now catches the rejected request and displays `Fullscreen is unavailable in this browser.` without an unhandled console error. Native print preview and the operating-system download shelf are not exposed to browser automation; print/SVG/PNG dispatch was exercised and completed without a current runtime error, but those two native shells were not visually inspected.

## Responsive evidence

No tested width produced document-level horizontal overflow. The graph canvas stayed inside the content column and its controls remained visible above navigation.

| Width | Graph width | Result |
|---:|---:|---|
| 375 | 285 px | Single-column inspector; controls wrap; no document overflow. |
| 768 | 678 px | Single-column inspector; minimap and controls remain visible. |
| 1024 | 934 px | Single-column inspector; no control/navigation collision. |
| 1280 | 544 px | Two-column graph/inspector; both columns remain usable. |
| 1440 | 704 px | Two-column reference viewport; readable inspector and control rows. |
| 1920 | 1,184 px | Wider graph canvas with stable inspector width. |
| 2560 | 1,824 px | Large desktop canvas; no stretched inspector or hidden controls. |

Selected visual evidence:

- `qa-screenshots/01-version-list-1440.png`
- `qa-screenshots/04-master-controls-1440.png`
- `qa-screenshots/05-master-375.png`
- `qa-screenshots/06-master-768.png`
- `qa-screenshots/07-master-2560.png`
- `qa-screenshots/08-search-inspector-1440.png`
- `qa-screenshots/11-high-zoom-selected-node-1440.png`
- `qa-screenshots/12-clinical-review-1440.png`
- `qa-screenshots/13-evaluated-snapshot-lock-1440.png`

## View render measurements

Times are browser-observed selection-to-render samples, not laboratory benchmarks.

| View | Nodes | Edges | Observed render |
|---|---:|---:|---:|
| Global Router and Safety Gates | 56 | 28 | 275 ms |
| Transition to HPV Primary Screening | 26 | 13 | 278 ms |
| Primary HPV Screening | 46 | 23 | 279 ms |
| Normal Colposcopy after Low-grade Cytology | 36 | 18 | 280 ms |
| Normal Colposcopy after High-grade Cytology | 36 | 18 | 294 ms |
| HSIL treatment and Test of Cure | 34 | 17 | 289 ms |
| Glandular abnormalities | 38 | 19 | 288 ms |
| Hysterectomy and Table 1 | 80 | 40 | 292 ms |
| Pregnancy | 28 | 14 | 288 ms |
| Abnormal vaginal bleeding | 30 | 15 | 293 ms |
| Special populations and 2026 overlays | 48 | 47 | 291 ms |
| Master tree | 422 | 421 | 310 ms |

## Interaction and accessibility matrix

| Check | Evidence / result |
|---|---|
| Fit view | Reset fit all 12 views; master fit preserved the complete graph. |
| Zoom / high zoom | Styled zoom controls changed the transform from fit scale through 0.642 and search-centred 1.2; selected node text and inspector content remained readable. |
| Pan / minimap | Canvas pan and minimap drag changed the viewport transform; 200×150 minimap remained visible. |
| Keyboard node selection | 422 node groups expose keyboard focus; Enter selected the focused node and updated the inspector/summary. |
| Keyboard edge selection | 421 edge groups expose keyboard focus; Enter selected an edge and updated the inspector/summary. |
| Focus visibility | Focus rings were visible on tabs, Find, graph controls and form fields. |
| Search by rule ID | `F3-16` selected the Figure 3 branch and inspector in 536 ms. |
| Search by source | `Figure 3` selected the source-linked branch in 315 ms. |
| Search by node label | `NCSP start` selected and centred the node in 373 ms. |
| Branch highlighting | Figure 3 ancestor/descendant highlight completed in 386 ms: 45 highlighted edges and 376 muted edges/nodes. |
| Subflows | Each pathway view opened from the synchronized view tabs; counts matched its stored membership. |
| Inspector / labels | Display, condition, outcome, safety, source, layout and audit tabs were reachable; controls have accessible names and visible labels. |
| Error messages | No-match search, fullscreen limitation and export failures use the visible notification region. |
| Colour-independent meaning | Node type text, icons, CRITICAL badges, edge labels and inspector fields accompany colour. |
| Screen-reader summary | `clinical-graph-summary` announces view title, visible node/edge counts and selected node/edge, with keyboard instructions. |
| Reduced motion | Global `prefers-reduced-motion: reduce` rules disable or shorten animation/transition behaviour. |
| Responsive inspector | Inspector stacks below the graph below the desktop breakpoint; document width stayed equal to viewport width. |
| Fullscreen | Permission rejection is caught and announced; no unhandled console entry. Native fullscreen itself is unavailable in this browser. |
| SVG export | 422-node master dispatch completed in 287 ms on the final pass; export markup is sanitised before serialization. |
| PNG export | 422-node master completed in 6,179 ms on the final pass; no tainted-canvas error and no console warning/error. |
| Print | Print control dispatched without JavaScript error; native preview is not exposed by this browser. |
| Autosave | Disposable unevaluated draft changed revision 1→2 in 2,163 ms, including the configured 1,500 ms debounce. Evaluated snapshots are read only. |

## Clinical Review workspace

The workspace shows source pages, recommendation IDs, figure branch, current AST/outcome, competing interpretation, affected tests, comments, disposition and approval controls. The reviewer-comment gate was exercised without submitting or approving a disposition. No clinical record, published snapshot or live activation was changed.

## Remaining UX limits

- The master tree is necessarily dense at fit scale; search, pathway views, branch highlighting, minimap and the inspector are the primary reading tools.
- Native fullscreen cannot be proven in the in-app browser because the host denies the permission request.
- Native print preview and the final filesystem download surface require a manual operating-system/browser pass if those shells are part of the release gate.
- PNG export of the complete master tree is materially slower than view switching (6.2 seconds in the final sample), but it remains bounded and visibly enters a loading state.

Strengths include clear node-type naming, persistent safety wording, good responsive containment, an effective inspector, and source/rule search that turns a very large graph into a usable review surface. The principal release blocker is not graph usability: it is the unresolved dependency audit and the separate governed clinical-review gate.
