# Stage 1 source register and visual verification

Verified on 2026-08-02 in `/Users/nauman/Documents/Screening`, branch `audit/full-ncsp-clinical-parity`, HEAD/base commit `578b4b046aed60ef68b950ffb5945e4bf6ec956b`.

## Stage 1 result

**PASS.** All four supplied source files are present and hashable. The primary guideline is the June 2023 final v1.1 national guideline. Every source page containing Figures 1–10 and Table 1 was rendered at 220 dpi and visually inspected. All boxes, connectors, arrow direction, branch labels, legends, footnotes, recommendation references, age boundaries, repeat intervals, and specialist/MDM review requirements are readable. Table 1 is landscape content embedded in a portrait PDF page; the 220 dpi render preserves every row and column legibly.

All nine addendum pages and all three immune-deficiency guidance pages were also rendered and visually inspected. No source is absent, truncated, or illegible, so the audit may proceed to source-derived extraction.

## Source inventory and precedence

| Exact filename | Document title and role | Version | Publication / effective date | Pages | Figures / tables | SHA-256 | Classification and precedence |
|---|---|---|---|---:|---|---|---|
| `docs/clinical-sources/01-ncsp-guidelines-2023-v1.1.pdf` | *Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand* | Final v1.1 | Published June 2023; stated for use from July 2023; implemented September 2023 according to the addendum | 102 | Figures 1–10, Figure A.1, Table 1 | `721ee7fa5f804fd951f49c1d9ec288832d5ad7a29c3c149b1be6e5129ffe7e0b` | National base guidance. Controls unless a supplied later official source expressly changes a scenario. |
| `docs/clinical-sources/02-ncsp-guideline-addendum.pdf` | *Addendum to Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand* | Doc ID 18519, v1.0 | Published 02/02/2026; expressly “implemented immediately” | 9 | One addendum flowchart for active surveillance of CIN2 plus updated recommendations | `dc7817a490ea84ff8cd3507647d88d1b364f1ad170122c3d938bb617b6d482e6` | Later national addendum. Supersedes the June 2023 rule only for the scenarios it identifies; it does not replace unaffected 2023 pathways. |
| `docs/clinical-sources/03-ncsp-immune-deficiency-guidance.pdf` | *Cervical screening for immune deficient participants* | Doc ID 18378, v1.0.1 | Published 12/03/2026; review due 12/03/2027 | 3 | Three-page conditions/medications and periodicity table | `5fc5b4872ba70eb0648feb9dc54a82c1291979e6a7c6a5f9476db1cdf2c69063` | Later national guidance. Controls current immune-deficiency classification and screening periodicity; supplements rather than replaces genotype, cytology, referral, and specialist pathways. |
| `docs/clinical-sources/04-prior-rule-extraction.md` | *Clinical Decision-Rule Extraction for Cervical Screening Guideline Figures and Table* | No official version | Supplied secondary report; date not stated in the artifact | Markdown, 93,075 bytes | Secondary narrative extraction of Figures 1–10 and Table 1 | `46fb36e0a4478d332969c32565de58a7bdf90d3f7904d2b14c1d21640cbfddcf` | Secondary cross-check only. It cannot create, override, or validate an expected outcome where the primary sources differ or are silent. |

No separate approved local booking-priority document is present in this package. National pathway timing must therefore remain distinct from locally assigned operational booking priority.

## Figure and table page/readability register

“PDF page” is the one-based page number accepted by Poppler. “PDF index” is the corresponding zero-based index. The primary guideline’s printed page numbers are consistently two pages behind its one-based PDF pages for these items.

| Source item | Printed page | PDF page | PDF index | Controlling 2023 recommendations / text | Readability | Addendum effect | Immune-guidance effect | Rendered image |
|---|---:|---:|---:|---|---|---|---|---|
| Figure 1 — transition: no unresolved abnormality | 18 | 20 | 19 | R2.01–R2.03, R2.06–R2.07; Figure 1 | Readable, including both invitation branches and hand-off to Figure 3 | No direct change | None | `rendered-sources/2023-figure-01-pdf-page-20.png` |
| Figure 2 — transition: previous high-grade/glandular history | 19 | 21 | 20 | R2.03–R2.08; Figure 2 | Readable, including all five terminal routes and status split | AIS follow-up may be affected by updated R9.14; otherwise no direct transition change | None | `rendered-sources/2023-figure-02-pdf-page-21.png` |
| Figure 3 — HPV primary screening for asymptomatic participants | 24 | 26 | 25 | R3.04–R3.06 for invalid/unsuitable/unsatisfactory results; R4.01–R4.15 for HPV primary management; Figure 3 footnotes | Readable, including sample-type split, cytology, first/second repeat, age ≥50, immune status, intervals, and high-grade/endometrial footnotes | No direct genotype/cytology branch replacement | The v1.0.1 document controls who is classed as immune deficient for the 3-year rather than 5-year HPV-not-detected branch | `rendered-sources/2023-figure-03-pdf-page-26.png` |
| Figure 4 — normal colposcopy after HPV detected with negative/ASC-US/LSIL cytology | 45 | 47 | 46 | R6.03–R6.07; Figure 4 | Readable, including transformation-zone, MDM, immune, and repeat-test branches | **Changed:** updated R6.05 removes MDM cytological review for HPV-positive, low-grade cytology, normal colposcopy with Type 3 TZ | The v1.0.1 classification controls the immune branch/3-year interval | `rendered-sources/2023-figure-04-pdf-page-47.png` |
| Figure 5 — normal colposcopy after HPV detected with cytology ≥ASC-H | 47 | 49 | 48 | R6.08–R6.16; Figure 5 | Readable, including MDM review, reclassification, biopsy, and treatment-deferred routes | No direct Figure 5 replacement | None | `rendered-sources/2023-figure-05-pdf-page-49.png` |
| Figure 6 — Test of Cure after treatment for HSIL (CIN2/3) | 56 | 58 | 57 | R8.02–R8.08; Figure 6 | Readable, including treatment anchor, 6/18-month co-tests, persistent abnormality, and colposcopy routes | Updated R8.03 clarifies eligible active surveillance before treatment; updated R8.06 allows primary/community-care ToC for under-50 participants with positive HSIL excision margins | None | `rendered-sources/2023-figure-06-pdf-page-58.png` |
| Figure 7 — atypical/abnormal glandular abnormalities | 59 | 61 | 60 | R9.04–R9.17; Figure 7 legend | Readable, including AG/AC codes, MDM, biopsy, excision, hysterectomy, and oncology routes | **Changed:** updated R9.14 permits primary/community follow-up after HPV-detected AIS with clear margins, with co-tests at 6 and 18 months | None | `rendered-sources/2023-figure-07-pdf-page-61.png` |
| Table 1 — vaginal screening after total hysterectomy | 66 | 68 | 67 | R10.01–R10.10; Table 1 | Readable after landscape visual inspection; every history row and test-outcome column is legible | Screening-after-gynaecological-cancer update supersedes affected cancer-history/ToC scenarios; subtotal hysterectomy continues cervical screening | None | `rendered-sources/2023-table-01-pdf-page-68.png` |
| Figure 8 — screening after total hysterectomy | 67 | 69 | 68 | R10.01–R10.10; Figure 8, interpreted with Table 1 | Readable, including history, treatment/ToC, pathology, and cessation/follow-up branches | Same gynaecological-cancer and incomplete-ToC updates as Table 1 | None | `rendered-sources/2023-figure-08-pdf-page-69.png` |
| Figure 9 — high-grade/glandular cytology in pregnancy | 71 | 73 | 72 | R11.01–R11.11; Figure 9 | Readable, including pregnancy timing, MDM, biopsy, suspected invasion, and oncology branches | No direct change | None | `rendered-sources/2023-figure-09-pdf-page-73.png` |
| Figure 10 — abnormal vaginal bleeding | 83 | 85 | 84 | R15.01–R15.06; Figure 10 | Readable, including cancer-suspicion override, speculum findings, co-test, age, and referral branches | No direct change | None | `rendered-sources/2023-figure-10-pdf-page-85.png` |

The secondary extraction inconsistently cites displayed guideline pages one number higher for some figures. The primary PDF’s printed page labels and the actual rendered PDF page positions above are controlling.

## Addendum supersession summary

The addendum says its listed components can be implemented immediately and supersede the current guideline for those components. It does **not** globally discard the June 2023 guideline.

1. **R6.05 / Figure 4:** for Type 3 transformation zone, HPV positive, low-grade cytology, and normal colposcopy, MDM cytological review is no longer required.
2. **R8.03:** active surveillance of biopsy-confirmed CIN2 is explicitly available only when diagnosis occurs below age 30, the transformation zone is Type 1 or 2, CIN3/invasion is excluded, histology is reviewed at MDM, and the participant agrees. Surveillance is six-monthly with colposcopy, cytology, and biopsy of visible lesions, for no more than 24 months. Treat if CIN2 persists at 24 months or CIN3 develops; regression proceeds to Test of Cure. The addendum’s own flowchart on its page 4 is readable.
3. **R8.06 / Figure 6 context:** participants under 50 with positive excision margins after HSIL treatment may receive Test of Cure follow-up in primary/community care instead of mandatory colposcopy follow-up.
4. **R9.14 / Figure 7:** HPV-detected AIS with clear excision margins may be followed in primary/community care with co-tests at 6 and 18 months; the old requirement for the first follow-up co-test at colposcopy is superseded.
5. **Screening after gynaecological cancer / Table 1 and Figure 8 context:** stage 1a1 cervical cancer treated by local excision may return to regular screening after successful treatment and Test of Cure; abnormalities during Test of Cure return to colposcopy and subsequent HPV detection follows the primary pathway. Total hysterectomy permits cessation after Test of Cure. For other gynaecological-cancer histories not enrolled in NCSP, management is decided by clinician and participant because NCSP supplies no recommendation. HSIL without completed Test of Cure before total hysterectomy for a non-cervical gynaecological cancer requires Test of Cure and two negative co-tests 12 months apart before cessation. Subtotal hysterectomy continues cervical screening.
6. **Immune deficiency:** the addendum introduces revised categories, but the later standalone v1.0.1 immune-deficiency guidance is the controlling detailed classification source.

## Immune-deficiency precedence summary

The standalone v1.0.1 guidance is later than both the 2023 guideline and the February 2026 addendum. It **supplements** Figure 3 and Figure 4 by defining who should use the immune-deficient three-year screening interval; it does not replace HPV genotype, cytology, colposcopy, gynaecology, oncology, or repeat-test branches.

- Three-year screening is recommended for HIV, solid-organ transplant with immunosuppressive therapy, active haematological malignancy, HSCT/CAR-T within two years or chronic graft-versus-host disease, primary immunodeficiency, major antibody deficiency, defects of innate immunity, defects of immune regulation, and phenocopies of primary immunodeficiency.
- Three-year screening should be highly considered case by case for dialysis over six months, severely immunosuppressive combinations, and long-term highly immunosuppressive therapy. The medication thresholds and named classes on pages 1–2 are controlling and the list is expressly non-exhaustive; specialist input may support judgement.
- Diabetes, thyroid/Graves’ disease, prior splenectomy, and coeliac disease are expressly not immune-deficient for this pathway. The document also lists treatments not considered immunosuppressive in this context, including specified monotherapies, low-dose/brief or replacement corticosteroids, and most standard short-term solid-tumour treatment; complex prolonged cancer treatment may require oncologist discussion.
- The screen taker or colposcopist should identify immune deficiency on the laboratory request form.
- Because “highly considered” and similar/unlisted conditions require case-by-case judgement, those classification branches are clinician-led and must not be silently converted to a Boolean false/true default.

## Visual-rendering evidence

Poppler `pdftoppm` rendered the eleven controlling primary pages at 220 dpi into `docs/clinical-audit/rendered-sources/`. The directory also contains `addendum-page-01.png` through `addendum-page-09.png` and `immune-page-01.png` through `immune-page-03.png`. All were inspected at original rendered resolution. Primary figure/table renders are 1819 × 2573 pixels; addendum and immune renders are 1489 × 2105 pixels.

Stage 1 verification used `find`, `pdfinfo`, `shasum -a 256`, Poppler rendering, and direct visual inspection. `pdftotext -layout` was used only to locate/cross-check nearby recommendation text and never as a substitute for the visual source.

## Production-change guardrail

Stage 1 added only audit documentation and rendered source images under `docs/clinical-audit/`. It did not modify production decision logic, schemas, migrations, persistence, APIs, UI, or application behaviour. The repository already contains unrelated pre-existing production-file changes in the worktree; this audit does not claim or adopt them.
