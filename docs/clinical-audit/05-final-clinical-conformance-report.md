# Final clinical conformance report

## Executive verdict

**Proof-of-concept only; not pilot-ready.** It may be demonstrated at a conference only with synthetic/de-identified data and prominent wording: **“provisional recommendation — reviewer confirmation required — not for direct clinical action.”** It is not evidence of clinical validation.

## Evidence and source hierarchy

Baseline evidence is in `00-baseline.md`; code inventory in `01-implemented-rule-inventory.md`; the deliberately independent, limited oracle is `guideline-oracle.json`; parity evidence is `03-rule-parity-matrix.md`. The original guideline figures/table and later addenda were not available in this workspace. This prevents a complete claim for any of Figures 1–10 or Table 1, and requires source reconciliation before external clinical validation.

## Figure-by-figure result

F1/F2: named implementation exists but source parity cannot be concluded. F3: broadest implementation, but fails core missing-data and age/router safety probes. F4/F5: partial, with specialist decision boundaries. F6: HPV-detected escalation is implemented, but treatment-date and longitudinal state safety are inadequate. F7: partial clinician-led handling. F8/Table 1: partial generic evaluator, not an independently verified exhaustive table matrix. F9: partial and clinician-led. F10: urgent pathway exists, but batch ingestion can fabricate completed assessment facts.

## Reproducible defects

1. `AUD-003` (Critical): age 70–74 plus HPV 16/18 selects age-deferred exit before colposcopy.
2. `AUD-001`/`AUD-002` (High): absent sample type or immune status can yield routine recall.
3. `AUD-004` (High): Test-of-Cure treatment date is non-blocking.
4. `AUD-005` (High): batch mapper fabricates bleeding workup completion.

## Test evidence

Commands: `npm ci`; `npm run lint`; `npm run typecheck`; `npm run test:engine`; `npm run test:batch`; `npm run build`; `tsx --test tests/clinical-conformance/oracle-safety.test.ts`.

Existing engine: 107/107 pass. Batch after generated Prisma Client: 217/217 pass. Lint: 0 errors, 18 warnings. New independent conformance probes: 1 pass, 4 fail (expected mismatch evidence). Browser/API/persistence/property/mutation/coverage suites are not configured or not executed. Clinical branches tested: 5 limited probes / 9 limited oracle branches; correctly demonstrated: 1/9. Neither is a complete guideline coverage metric.

## Required remediation before validation or pilot

First reconcile every oracle branch with the original 2023 figures, Table 1 and any addenda, signed off by appropriate clinical governance. Then preserve unknown values end-to-end, remove mapper-invented clinical facts, repair precedence, persist ToC history and treatment dates, and add reviewed tests for every Table 1 cell and figure terminal branch. Keep national routing separate from booking priority, require review for clinician-only branches, and implement traceable immutable input/decision snapshots.

Do not claim that the app accurately implements all figures/Table 1, is clinically validated, is connected to hospital systems, makes autonomous clinical decisions, has live FHIR/HL7 integration, or is pilot-ready. Production logic and migrations were not modified by this audit.
