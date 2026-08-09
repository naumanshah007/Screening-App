# CerviGrade pathway PNG verification — visual patch v2.1.1

**Clinical rule set:** unchanged v2.1 (203 records).  
**Visual projection:** v2.1.1.  
**Status:** PASS after correcting standalone-view omissions.

## Verification method

- Compared every selected cluster in each small DOT against the matching cluster in the verified master DOT: node IDs, labels and internal edges are exact matches.
- Verified all 203 rule IDs map to at least one pathway view; no unknown IDs; all 21 Table 1 rules remain present.
- Checked critical routing assertions for age 70–74, malignant cytology, Figure 5 isolated HPV persistence, Test-of-Cure completion, AIS completion, vault escalation, pregnancy low-risk routing and Figure 10 abnormal-cervix logic.
- Re-rendered every SVG and PNG from DOT and checked for undefined node references.

## View-by-view result

### 01_global_router_safety — Global Router and Safety Gates
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **28**
- Corrected: all cross-path destinations and global software invariants are now visible.

### 02_transition_to_hpv — Transition to HPV Primary Screening
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **13**
- Corrected: explicit links to Figure 2, Figure 3 and AIS post-treatment follow-up.

### 03_primary_hpv_screening — Primary HPV Screening
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **23**
- Corrected: repeat-negative endpoints explicitly show 5-year/3-year intervals; glandular subflow link visible.

### 04_normal_colposcopy_low_grade — Normal Colposcopy after Low-Grade Cytology
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **18**
- Corrected: Type 3 TZ no-routine-excision, selected-excision and ECC cautions shown separately.

### 05_normal_colposcopy_high_grade — Normal Colposcopy after High-Grade Cytology
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **18**
- Corrected: Figure 6/AIS subflow links and separate CIN2-surveillance annotation.

### 06_hsil_treatment_test_of_cure — HSIL Treatment and Test of Cure
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **17**
- Corrected: ToC completion endpoint explicitly shows 5-year/3-year interval where cervix remains.

### 07_glandular_abnormalities_ais — Glandular Abnormalities and AIS
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **19**
- Verified: internal graph exactly matches master; AIS success, margins, lifelong co-testing and oncology routes present.

### 08_hysterectomy_vaginal_vault — Total Hysterectomy and Vaginal Vault Follow-Up
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **40**
- Verified and supplemented: internal graph exactly matches master; all 21 Table 1 cells retained; Figure 10 link visible; separate readable matrix supplied.

### 09_pregnancy — Pregnancy Pathway
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **14**
- Corrected: explicit high-risk/low-risk split; low-risk branch cannot fall into high-grade pathway; Figure 3 cross-link visible.

### 10_abnormal_bleeding — Abnormal Vaginal Bleeding
- Internal canonical-cluster alignment: **PASS**
- Rules mapped: **15**
- Verified: abnormal-cervix split, cancer urgency, postmenopausal, persistent PCB/IMB, pregnancy and post-hysterectomy overrides present.

## Important interpretation

- The clinical rulebook remains the source of truth. The small trees are synchronized visual projections and contain a few clearly labelled view-navigation nodes so a standalone image does not lose cross-path destinations.
- No clinical rule was added, removed or changed in this patch. The changes make already-approved v2.1 rules explicit and prevent misleading disconnected standalone diagrams.
- The supplementary Table 1 matrix is for readability; the canonical Figure 8 graph still retains all six history groups and 21 rule cells.
