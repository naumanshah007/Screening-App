# 13 — Source Artifact and Reproducibility (VERIFY-01)

**Outcome: `REPOSITORY_SELF_CONTAINED_WITH_DERIVED_GOVERNED_SNAPSHOT`**, with source verification retained as an optional suite requiring the external package.

---

## 1. What the package actually is

`docs/clinical-sources/source-v2.1`, ~39 MB, untracked.

**It contains no PDFs.** The NCSP guideline PDFs are separate files at `docs/clinical-sources/*.pdf` and are not read by any code path.

| Type | Count | Size | Role |
|---|---:|---:|---|
| `.json` | 34 | ~1.7 MB | **clinical content** — master rules, graph views, manifests, QA |
| `.csv` | 4 | small | rule-tree coverage, master rules export |
| `.txt`/`.md` | 6 | small | `SHA256SUMS.txt`, notes |
| `.dot` | 14 | small | graph sources |
| `.svg` | 13 | ~0.4 MB | pathway diagrams |
| `.png` | 24 | **~37 MB** | posters and contact sheets |

**~95% of the 39 MB is PNG posters.** The machine-readable content is ~2.1 MB.

## 2. Dependency classification

| Consumer | Class | Needs the package? |
|---|---|---|
| **Running application** (all routes, evaluator, adapter, resolver) | — | **NO.** The snapshot is read from `ClinicalRuleVersion.snapshotJson` in the database. |
| `next build` | — | **NO.** Verified: build succeeds without it. |
| `lib/clinical-rules/importer.ts` | **C. Source-import** | Yes — an admin operation, run deliberately, not at runtime |
| `scripts/rule-studio/*`, `scripts/comparison/*` | **C. Source-import** | Yes |
| `SHA256SUMS.txt` verification over posters/SVGs | **D. Source-verification only** | Yes — read solely to compute SHA-256; never parsed for clinical content |
| Clinical test suites (`governed-*`, `canonical-*`, `shadow-*`, corpus) | **E. Test-only** | **Was yes. Now no.** |

**The production runtime does not depend on the source package or on any guideline PDF.** That was already true; it is now demonstrated.

## 3. The reproducibility design

### Layer 1 — governed machine-readable snapshot (committed)

`lib/clinical-rules/governed-snapshots/`

| File | Size | Rules | Checksum |
|---|---:|---:|---|
| `cg-ncsp-3.0.0.json` | 900 KiB | 203 | `2997a909b98f9d89…` |
| `cg-ncsp-3.1.0.json` | 936 KiB | 203 | `3ab8657a13e73bb0…` |
| `manifest.json` | 4 KiB | — | records both, plus `sourceJsonSha256` |

1.8 MB committed, replacing a 39 MB local dependency.

This is the **derived** artefact the application actually consumes — the same JSON that is loaded into `ClinicalRuleVersion.snapshotJson`. It is regenerated, never authored:

```bash
npm run rules:export:snapshot
```

It is snapshot **input data** (the ruleset), not expected outcomes. No expected clinical result is generated from the engine under test — the 179-case oracle and the conformance expectations remain exactly as they were.

### Layer 2 — checksums and source manifest

`loadGovernedSnapshot()` recomputes the snapshot checksum on every load and **throws** on mismatch, so a hand-edited ruleset fixture is unusable. `manifest.json` records `sourcePackageVersion` and `sourceJsonSha256`, naming the exact source JSON that produced the committed snapshot.

### Layer 3 — optional source-verification suite

`lib/clinical-rules/__tests__/governed-snapshot-source-verification.test.ts` rebuilds both snapshots from the external package and asserts **byte-identity** with the committed fixtures, plus manifest agreement. `successor-v3-1.test.ts` retains its build-determinism test on the same gate.

```bash
npm run test:source-verification   # requires the external package
```

When the package is absent these tests **skip with an explicit reason**. They never silently pass, and they never compare the fixture against itself. A guard test asserts the skip condition itself stays honest.

### Layer 4 — the normal suite runs clean

Every other clinical suite loads the committed snapshot. No test was weakened; the assertions are unchanged. Only the *source of the ruleset input* moved from "rebuild from a 39 MB local folder" to "load a committed, checksum-verified fixture that is proven byte-identical to that rebuild".

## 4. Result

| | Before | After |
|---|---|---|
| Clean checkout, no source package | **900 fail** / 63 pass | **0 fail** / 966 pass / **5 explicit skips** |
| With source package | 963 pass | **971 pass** / 0 skip |

## 5. CI implications

**Default CI needs nothing extra.** `npm ci && npm run test:all && npm run build` passes on a clean checkout.

**A source-verification job** should run wherever the artefact is available — ideally on any change to `lib/clinical-rules/**` and before any ruleset publication:

```bash
# fetch the governed source artefact into docs/clinical-sources/source-v2.1
npm run test:source-verification
```

**Publication gate:** source verification must pass before CG-NCSP-3.1.0 is published. Publishing a ruleset whose snapshot has not been proven to match its source is precisely the governance gap this finding was about.

## 6. Storage of the external artefact

Not yet decided — this needs a human. Options, in preference order:

1. **Git LFS** in this repository — keeps one source of truth, needs LFS on CI, and needs the redistribution decision in §7.
2. **A pinned, checksum-verified release artefact** (private object storage or a GitHub release asset) fetched by a script that verifies `SHA256SUMS.txt` before use. No redistribution beyond the existing rights holder.
3. **Committing only the ~2.1 MB machine-readable subset** (JSON/CSV/dot/txt) and excluding the ~37 MB of posters. This would make the *importer* reproducible from the repository. Note it would break the current `SHA256SUMS.txt` verification, which covers the posters too — that check would have to be scoped to the committed subset, which weakens it.

Option 2 is recommended: it resolves reproducibility without taking a redistribution decision that is not ours to take.

> ### Decision still required from a human
>
> **Redistribution rights for `docs/clinical-sources/source-v2.1` and the NCSP guideline PDFs are unknown.** The package is derived from National Cervical Screening Programme material. Nothing was committed from it, and no PDF was committed.
>
> Needed: (a) may the package be stored in this repository, or must it stay in controlled storage; (b) if controlled, where, and who grants CI access; (c) the same question for the guideline PDFs at `docs/clinical-sources/*.pdf`.
>
> Until (a)–(c) are answered, the repository is self-contained for build and test, and the source-verification suite is opt-in. **This is not a blocker for previewing the architecture. It remains a blocker for publishing CG-NCSP-3.1.0**, because publication asserts that a checksummed snapshot faithfully represents the national source material, and that assertion must be verifiable by someone other than the author.

## 7. Files required, summarised

| File | Runtime | Build | Default tests | Source verification |
|---|:-:|:-:|:-:|:-:|
| `lib/clinical-rules/governed-snapshots/*.json` | no¹ | no | **yes** | yes |
| `docs/clinical-sources/source-v2.1/**` (JSON/CSV) | no | no | no | **yes** |
| `docs/clinical-sources/source-v2.1/**` (PNG/SVG/dot) | no | no | no | **yes** (checksum only) |
| `docs/clinical-sources/*.pdf` | no | no | no | no |

¹ The running application reads the snapshot from the database, not from disk. The committed fixture is the import source and the test input.
