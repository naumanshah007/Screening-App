# CanonicalClinicalFactsV2 design

`CanonicalClinicalFactsV2` is a versioned, provenance-preserving input contract for the canonical shadow engine. It does not replace the legacy `ClinicalInput` contract or change displayed authority.

## Contract

- Schema identifier: `canonical-clinical-facts-v2`.
- TypeScript and Zod definitions: `lib/clinical-rules/canonical-facts-v2.ts`.
- JSON Schema: `public/templates/canonical-clinical-facts-v2.schema.json`.
- Normalized persistence: deterministic JSON in `RuleEvaluation.canonicalInputSnapshot`.
- API: `/api/clinical-rules/evaluate` accepts exactly one of legacy-compatible `facts` or a version-pinned `canonicalFactsV2` object.
- Evaluation diagnostics: facts used, missing, ignored and conflicting; provenance by fact; matched rules; controlling rule; branch path and source references.

Each fact records an explicit `status`, `source`, timestamps, entering/verifying actor, verification status, optional source-document/external reference and append-only correction history. `KNOWN`, `UNKNOWN`, `NOT_RECORDED`, `NOT_APPLICABLE`, `PENDING` and `CONFLICTING` are distinct. Only `KNOWN` may carry an evaluable value.

The catalog contains 81 domain entries (75 unique field names) across six domains:

| Domain | Entries | Examples |
|---|---:|---|
| HPV validity/adequacy | 12 | validity, invalid, unsuitable, leakage, cytology pending/adequacy, sample site and method |
| CIN2 surveillance | 18 | eligibility, CIN3 exclusion, shared decision, event count, duration, regression and current findings |
| HSIL treatment/margins | 8 | diagnosis, modality, date, margin applicability/result, care setting and longitudinal co-test sequence |
| AIS | 15 | pretreatment HPV/genotype, histology, treatment, margins, cervix/hysterectomy and 6-/18-month results |
| Cancer overlay | 10 | cancer type/stage/treatment, NCSP applicability, ToC and clinician-directed plan |
| Abnormal bleeding | 18 | type, menopause, episode/persistence, examinations, co-test, STI/OCP, reassessment and resolution |

Several fields occur in more than one domain by design (`ageYears`, `treatmentDate`, `treatmentModality`, `marginStatus`, `hysterectomyType`, `tocEventSequence`). The stored fact has one stable name and one provenance record.

## Missing-data and conflict behavior

An explicitly unresolved fact can stop a relevant equal-or-higher-precedence high-risk branch. Omitted unrelated facts do not cause a global stop. Contradictory facts always produce a visible specialist-review stop. Missing facts never default to negative, normal, immune competent, complete, clear margins, absent symptoms or absent cancer.

## Migration strategy

1. Keep legacy input and authority unchanged.
2. Capture minimal routing facts.
3. Request pathway-specific completeness only after routing.
4. Build V2 facts with status and provenance for shadow evaluation.
5. Persist the V2 snapshot and linked evaluation evidence.
6. Correct facts only through an explicit reviewer action that creates a linked new evaluation and preserves the prior evaluation.
7. Consider authority cutover only in a future semantic version after governed clinical approval, dependency/security closure and separate release authorization.

Provisional recommendation · Reviewer confirmation required · Not for direct clinical action · Demo environment.
