# Closure of the 18 canonical input-representation gaps

All 18 source states that the legacy input cannot express now have validated native `CanonicalClinicalFactsV2` fixtures. They remain explicitly unsupported by the legacy contract; no legacy field was overloaded and no clinical fact was fabricated.

| Domain | Cases | V2 evidence added |
|---|---:|---|
| Unsuitable HPV sample | 1 | Separate unsuitable/leaked/inadequate/invalid state, sample method and provenance. |
| CIN2 active surveillance | 4 | Eligibility, age, CIN3 exclusion, MDM/shared decision, timing, persistence/regression and current findings. |
| HSIL excision margins | 2 | Margin applicability/result, treatment evidence, age and follow-up setting. |
| AIS clear margins | 1 | Pretreatment HPV, AIS histology, treatment/margins and 6-/18-month sequence. |
| Cancer/hysterectomy overlay | 6 | Cancer type/stage, NCSP applicability, treatment route/completion, hysterectomy and post-treatment sequence. |
| Abnormal bleeding | 4 | Bleeding type, menopause, episode/persistence, examinations, co-test and investigation state. |
| **Total** | **18** | **18/18 native V2 fixtures**. |

`canonical-v2-corpus.ts` maps all 179 independent oracle cases to V2 facts; `canonical-facts-v2.test.ts` validates every fixture. The local isolated simulation run persisted all 18 gap fixtures against `CG-NCSP-3.1.0`:

- ruleset checksum `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a`;
- evaluation mode `SIMULATION`;
- 18 created on first run and 18 reused on the idempotent rerun;
- branch paths and source references present;
- successor status `DRAFT`;
- zero activations and no publication timestamp.

The persistence script is `npm run rules:simulate:v2-input-gaps`. It normalizes the input snapshot before duplicate detection. It does not publish, activate, regrade completed decisions or change the legacy engine.

Result: 179/179 source cases are representable by V2, zero canonical input-contract gaps remain, and the 18 legacy limitations remain visible comparison evidence.
