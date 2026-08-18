# Implemented-rule inventory

This is a code inventory, not a correctness claim. The terminal rule inventory is machine-readable in `implemented-rules.json`.

| Pathway | Entry function | Main implemented inputs | Terminal outputs | Reachability finding |
|---|---|---|---|---|
| F1 | `decision-engine.ts:137` | screening status, history, ToC | invite now/next/stop | Wizard/batch partial |
| F2 | `:188` | history, AIS, AG2 date/discharge, colposcopy/ToC | referral, F3, review | Partial; dates not batch mapped |
| F3 | `:339` | HPV, cytology, sample, repeat, age, immune status | recall, return visit, colposcopy, stop | API/batch can silently default required booleans |
| F4–F5 | `:513`, `:629` | colposcopy, cytology, MDM, TZ | repeat, treatment/review | specialist facts not all UI-captured |
| F6 | `:733` | HPV/cytology, ToC status/stage, treatment date | repeat, return, colposcopy | treatment date is warning rather than stop |
| F7 | `:873` | glandular cytology, lesion, biopsy, MDM | gynaecology/colposcopy/oncology/review | clinician-only facts partially available |
| F8/Table 1 | `:1136`, `:1633` | hysterectomy type, pathology, excision/history | cessation, HPV, ToC, referral | incomplete history represented only partly |
| F9 | `:1306` | pregnancy, cytology, colposcopy, MDM/biopsy | colposcopy/review | clinician-led states exposed as deterministic codes |
| F10 | `:1457` | bleeding, exam, co-test, cancer concern | urgent referral/investigation/review | batch mapper fabricates completed workup fields |

Router order (`:1637`): bleeding, pregnancy, Table 1, hysterectomy, age gates, Figure 2, Figure 1, transition Figure 2/Figure 7/Figure 1, then Figure 3/4/5/6/7 according to flags. This makes the 70–74 age gate win before a primary HPV 16/18 evaluation.

The batch mapper (`lib/batch/processor.ts:30`) sets bleeding history/exam/co-test booleans to true whenever bleeding is active, and validation (`lib/batch/validation.ts:91`) defaults required booleans to false. Both are material data-integrity risks.
