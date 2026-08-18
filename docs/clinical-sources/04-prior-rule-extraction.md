# Clinical Decision-Rule Extraction for Cervical Screening Guideline Figures and Table

## Scope and method

This report extracts decision rules only from the user-supplied pathway figures and table from **Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand, June 2023, final version 1.1**. I treated the attached images as the primary operational source for branch logic, and I cross-checked page numbers, nearby recommendation text, and ambiguous figure references against an online copy of the same titled June 2023 v1.1 guideline PDF. I also checked current official Health New Zealand sources for any later pathway changes and found one official addendum, published on 2 February 2026, that states it “can be implemented immediately” and “supersedes the current guidelines” for the scenarios it addresses. HPV testing is now the main screening test in Aotearoa New Zealand, per the current Health New Zealand NCSP page. citeturn6view0turn5view0turn19view0

A few internal cross-reference inconsistencies in the June 2023 PDF matter for safe implementation. The hysterectomy recommendations in Section 10 repeatedly say “See Table 1 and Figure 9,” but the displayed hysterectomy flowchart is **Figure 8** on p68. The abnormal vaginal bleeding recommendations in Section 15 repeatedly say “See Figure 11,” but the displayed flowchart is **Figure 10** on p84. R6.05 also says “See Figure 5,” although the surrounding page context shows the low-grade/type 3 TZ pathway on p46, which aligns with **Figure 4** rather than Figure 5. I therefore treated the visual pathway itself plus the adjacent recommendation text as the controlling source where numbering is inconsistent. citeturn10view0turn8view0turn13view0turn7view3

## Executive summary and master routing

**1. Executive summary of the 10 figures plus Table 1**

The figure set is best understood as four distinct classes of decision logic. First, **transition logic** decides how people already in the legacy cytology programme enter HPV primary screening for the first time: Figure 1 handles those with no unresolved abnormality, while Figure 2 handles unresolved prior high-grade and certain glandular histories. Second, **primary asymptomatic screening logic** is governed by Figure 3, where the load-bearing determinants are HPV genotype, cytology grade, age threshold **50 years**, and immune deficiency. Third, **specialist follow-up logic** covers post-colposcopy, Test of Cure, glandular abnormalities, and pregnancy in Figures 4 to 7 and 9. Fourth, **non-routine special situations** are handled by hysterectomy pathways in Figure 8 plus Table 1, and symptomatic bleeding in Figure 10. The most cancer-sensitive escalation triggers across the whole set are **HPV detected 16 or 18**, **possible/definite high-grade cytology**, **glandular abnormality pathways**, **persistent or abnormal Test of Cure results**, **suspected invasion in pregnancy**, and **signs or symptoms suggestive of cervical cancer**. citeturn15view0turn12view0turn13view0turn17view0turn11view0turn10view0turn8view0

From an automation perspective, only a subset of the branches are suitable for deterministic **provisional recommendation**. Safe deterministic branches are mostly those that convert straightforward combinations of known structured inputs into recall timing or routine referral, such as Figure 1 transition invitations, most of Figure 3, the low-risk branches of Figure 4, and many rows in Table 1. Branches that require colposcopic impression, hysterectomy histology interpretation, biopsy interpretation, MDM/MDT review, malignancy suspicion, or pregnancy-specific specialist judgement should remain **clinician-only** or, at most, receive a provisional recommendation that is explicitly blocked pending clinician confirmation. citeturn12view0turn13view1turn14view0turn17view0turn11view0turn10view0

The only verified post-June-2023 official pathway changes I found that intersect this scope are in the official February 2026 addendum. Those changes are: removal of the requirement for MDM cytological review in the **type 3 TZ + HPV positive + low-grade cytology + normal colposcopy** scenario; allowing **under-50** participants with positive excision margins after HSIL treatment to have Test of Cure follow-up in primary/community care rather than mandatory colposcopy clinic; allowing follow-up of **HPV detected AIS with clear margins** in primary/community care with co-testing at **6 and 18 months** rather than first-colposcopy then community care; and clarifying that people with previous cervical or vaginal cancer are generally outside NCSP pathway management except specified stage 1a1 scenarios. I did not identify a later official source that explicitly supersedes the other figure-specific branches reviewed here. citeturn5view0turn19view0

**2. Master pathway router**

| Router condition | Use this item | Do not use if | Safety note |
|---|---|---|---|
| First entry from cytology-era screening into HPV primary screening, with no unresolved abnormal result | **Figure 1** | Participant still in active follow-up for high-grade/glandular disease, invalid HPV, unsatisfactory cytology, symptoms | Transition-only figure; not a routine ongoing screening figure |
| First entry from cytology-era screening into HPV primary screening, with previous high-grade/glandular history not returned to regular screening | **Figure 2** | Participant already in HPV pathway; symptoms; unresolved test validity issues | High-risk history; do not default to routine recall |
| Asymptomatic participant having primary HPV screening | **Figure 3** | Transition-only scenarios; pregnancy-specific high-grade management; post-hysterectomy; abnormal bleeding | Core router for routine HPV pathway |
| Post-colposcopy management after HPV detected (any type) with negative / ASC-US / LSIL cytology and normal colposcopy | **Figure 4** | High-grade referral cytology scenario; visible lesion; non-normal colposcopy; unresolved invalid/unsatisfactory tests | Surrounding text places this in the type 3 TZ context |
| Post-colposcopy management after HPV detected (any type) with cytology ≥ ASC-H and normal colposcopy | **Figure 5** | Low-grade cytology pathways; pregnancy pathway; abnormal biopsy/histology already established | Requires MDM case review and specialist judgement |
| Follow-up after treatment for HSIL (CIN2/3) | **Figure 6** | AIS follow-up rules alone; no confirmed prior HSIL treatment; missing treatment date/histology context | Any high-grade or HPV-detected abnormality can escalate to colposcopy |
| Atypical glandular cells / AIS / adenocarcinoma pathways | **Figure 7** | Routine squamous screening; low-grade-only pathways | Strongly specialist-dependent; many branches are not safe for autonomous automation |
| Screening after total hysterectomy as a summary router | **Figure 8** | Subtotal hysterectomy; cervical/vaginal cancer follow-up; active vaginal bleeding | Use with Table 1 for exact row-level resolution |
| Exact post-total-hysterectomy combination logic | **Table 1** | Subtotal hysterectomy; cancer specialist follow-up scenarios | Treat Table 1 as the more precise matrix |
| Pregnant participant with ASC-H, HSIL, atypical glandular cells or AIS cytology | **Figure 9** | Non-pregnant pathway; low-grade-only pregnancy pathway | Suspected invasion is urgent specialist territory |
| Abnormal vaginal bleeding pathway | **Figure 10** | Purely asymptomatic screening, resolved known benign issue already fully assessed, or postmenopausal bleeding being used as a routine-screening problem | Symptoms can override routine screening and require urgent referral |

The router above is drawn from the section purposes and recommendation text around the figures on pp14-25, 44-48, 56-60, 63-68, 69-72, and 81-84. citeturn15view0turn12view0turn13view0turn17view0turn10view0turn11view0turn8view0

## Figure and table rule extractions

**3. Figure 1 full rule extraction**

The supplied figure corresponds to **Figure 1** on **p19**, titled **“Transition to HPV primary screening – participants with no previous abnormal results, those with low-grade cytology results only and those with previous high-grade results who have already completed a Test of Cure.”** The surrounding text makes clear that Figures 1 and 2 apply **only when participants are transitioning into the new HPV screening pathway for the first time**, not as routine ongoing pathway logic. citeturn7view0turn15view0turn16view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 1 |
| Title | Transition to HPV primary screening – participants with no previous abnormal results, those with low-grade cytology results only and those with previous high-grade results who have already completed a Test of Cure |
| Guideline page | p19 |
| Clinical scope | Safe first-time transition from cytology-based screening to HPV primary screening for low-risk or resolved-history participants |
| Use when | Participant is first entering the HPV programme from the old cytology programme and has either no previous abnormality, only previous low-grade results already resolved/returned to routine screening, or a previous high-grade result with successful Test of Cure |
| Do not use when | Participant remains in active high-grade/glandular follow-up, has incomplete Test of Cure, has unresolved colposcopy referral, has symptoms, is post-hysterectomy, or has invalid HPV / unsatisfactory cytology pending repeat |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Transition status from cytology pathway | Mandatory | Determines whether Figure 1 rather than Figure 3 applies | Safety stop; do not auto-route |
| Previous screening history | Mandatory | Distinguishes never/under-screened/overdue from regularly screened | Defaulting to routine invite timing is unsafe |
| Previous abnormality history | Mandatory | Confirms eligibility for Figure 1 | Route to clinician review if unknown |
| Test of Cure completion status for previous high-grade disease | Conditional but mandatory if prior high-grade exists | Figure 1 only applies if Test of Cure already successfully completed | If unknown, do not use Figure 1 |
| Symptoms/pregnancy/hysterectomy status | Conditional exclusion checks | Prevents misrouting into routine transition figure | Escalate to the appropriate special pathway |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1-R1 | Participant is never screened, under-screened, or overdue, and no exclusion from Figure 1 applies | **Invite now**; then perform HPV screening test at next scheduled visit under Figure 3 | Primary/community screening; routine | Immediate invitation; subsequent testing per Figure 3 | No extra cytology at this step | No | No | No | No | No | Safe deterministic provisional recommendation | If prior abnormal history is unclear, block automation |
| F1-R2 | Participant is regularly screened with normal results, or previous low-grade results, or previous high-grade results with successful completion of Test of Cure | **Invite at next scheduled visit**; then perform HPV screening test at next scheduled visit under Figure 3 | Primary/community screening; routine | Next scheduled screening event | No extra cytology at this step | No | No | No | No | No | Safe deterministic provisional recommendation | If Test of Cure status is unknown, do not auto-assign this rule |

**D. Safety interpretation**

The unsafe automation failure in Figure 1 is incorrectly classifying someone as “resolved” when they actually still have an unresolved high-grade pathway or incomplete Test of Cure. That error would inappropriately delay colposcopy or annual co-testing. Figure 1 is therefore safe for deterministic automation only if prior abnormality status and Test of Cure completion are both fully known. citeturn15view0turn16view0

**E. Updated official guidance**

I did not identify a post-2023 official update that explicitly changes the Figure 1 transition logic itself. The later official addendum does not target this figure. citeturn5view0

**4. Figure 2 full rule extraction**

The supplied figure corresponds to **Figure 2** on **p20**, titled **“Transition to HPV primary screening – participants with previous high-grade results and not returned to regular screening.”** The content is clarified by transition recommendations R2.04 to R2.08. citeturn7view1turn16view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 2 |
| Title | Transition to HPV primary screening – participants with previous high-grade results and not returned to regular screening |
| Guideline page | p20 |
| Clinical scope | First-time transition into HPV primary screening for participants with unresolved prior high-grade or certain glandular histories |
| Use when | Participant is moving from the cytology-era programme to HPV primary screening and has not yet returned to regular screening after prior high-grade or defined glandular results |
| Do not use when | Participant is already in the HPV pathway, has symptoms, is not truly in transition, or has missing prior abnormality details |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Prior abnormality type | Mandatory | Distinguishes HSIL / AGC / AIS / atypical endometrial cells | Safety stop |
| Return-to-regular-screening status | Mandatory | Figure 2 only applies if not returned to regular screening | Safety stop |
| Outstanding colposcopy recommendation from last cytology | Conditional but mandatory for HSIL/AGC branches | Determines whether immediate colposcopy is required | Clinician review required |
| Test of Cure completion status | Conditional | Needed for HSIL/AGC branch closure | Safety stop if unresolved |
| Total hysterectomy status | Mandatory for prior AIS branch | Determines whether R2.08 applies | Clinician review required if unknown |
| Status after atypical endometrial cells | Mandatory for that branch | Determines specialist referral versus primary HPV screening | Do not automate if unknown |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F2-R1 | Previous possible/definite HSIL or atypical glandular cells, excluding atypical endometrial cells, and last cytology recommended colposcopy that has not already occurred | Refer to colposcopy first | Colposcopy; high priority | As soon as practicable | Per specialist pathway | Yes | No | No | No | Yes | Provisional only | If last report status unknown, do not auto-route |
| F2-R2 | Same history as F2-R1, but no outstanding colposcopy referral remains and Test of Cure incomplete | Complete a Test of Cure | Primary/community or colposcopy setting depending original treatment pathway | Annual co-testing until successful completion | Yes | Conditional | No | No | No | Yes | Provisional only | If prior treatment context unknown, clinician review required |
| F2-R3 | Same history as F2-R1 or F2-R2 and Test of Cure successfully completed | Route to regular interval screening under Figure 3 | Routine screening | Next appropriate screening event | Per Figure 3 | No | No | No | No | No | Safe deterministic if history complete | If “successful completion” cannot be proven, block |
| F2-R4 | Previous AIS and no total hysterectomy | Refer to R2.08 post-treatment follow-up | Specialist/combined pathway | Initial post-treatment colposcopy or annual co-testing depending HPV status and margin context | Yes | Often yes | No | Conditional | No | Yes | Clinician-only | AIS is not safe for autonomous closure logic |
| F2-R5 | Previous atypical endometrial cells not returned to 3-yearly cytology, and either already seen by specialist services and discharged to primary care, or the atypical endometrial report was >3 years previously | Do primary HPV screening test at next scheduled visit, then follow Figure 3 | Routine screening | Next scheduled visit | Per Figure 3 | No unless Figure 3 says so | No | No | No | No | Safe deterministic if conditions proven | If prior specialist discharge or date not known, hold |
| F2-R6 | Previous atypical endometrial cells not returned to 3-yearly cytology, and neither discharge-to-primary-care nor >3 years condition is met | Refer to specialist gynaecologist services | Gynaecology; non-routine specialist referral | As soon as practicable | No routine cytology-only substitution | No unless specialist decides | Yes | Conditional | No | Yes | Provisional only | Endometrial lesions are not appropriate for Test of Cure |

**D. Safety interpretation**

Figure 2 contains several branches where incorrect automation could defer cancer work-up: unresolved HSIL, AGC, AIS, and atypical endometrial pathways. **Routine recall is unsafe** when prior cytology recommended colposcopy and it has not occurred, when Test of Cure remains incomplete, or when atypical endometrial cells have not yet met the “specialist discharged” or “>3 years” conditions. These branches are suitable only for provisional decision support with clinician confirmation, except where a fully documented transition rule can safely send the participant to Figure 3. citeturn16view0turn15view2

**E. Updated official guidance**

I did not identify a later official document that directly changes Figure 2 itself. However, AIS follow-up is affected by the February 2026 addendum for clear-margin HPV detected AIS, so any Figure 2 branch that routes into AIS post-treatment follow-up should be checked against the updated official AIS rules before implementation. citeturn5view0

**5. Figure 3 full rule extraction**

The supplied figure corresponds to **Figure 3** on **p25**, titled **“Cervical screening pathway: HPV primary screening for asymptomatic participants.”** The adjacent text on pp24-26 explains the age-50 threshold, the use of LBC for persistent HPV detected Other, and that cytology is reflex-only when HPV is detected on an LBC sample. citeturn7view2turn12view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 3 |
| Title | Cervical screening pathway: HPV primary screening for asymptomatic participants |
| Guideline page | p25 |
| Clinical scope | Core HPV primary screening pathway for asymptomatic participants |
| Use when | Participant is asymptomatic, is being screened in the HPV primary pathway, and is not in a transition-only, pregnancy high-grade, post-hysterectomy, or symptomatic bleeding scenario |
| Do not use when | Invalid HPV, unsuitable for analysis, unsatisfactory cytology, pregnancy high-grade pathway, post-hysterectomy pathway, active Test of Cure, symptomatic abnormal bleeding, or cancer symptoms |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| HPV result | Mandatory | Primary branch determinant | Safety stop |
| HPV type grouping | Mandatory when HPV detected | Distinguishes HPV detected 16 or 18 from HPV detected Other | Safety stop |
| Sample type: swab or LBC | Mandatory | Determines whether cytology is already reportable or a return visit is needed | If unknown, do not auto-issue cytology instructions |
| Cytology result | Conditional when HPV detected Other or when LBC with HPV detected 16/18 is relevant to reporting context | Determines referral versus repeat testing | If pending/absent, hold at cytology step |
| Age | Mandatory in persistent HPV detected Other branch | The age threshold at 50 changes referral timing | Safety stop |
| Immune deficiency status | Mandatory for recall interval and Figure 4 overlap | Changes 5-year to 3-year return interval and affects some escalations | If unknown, do not default to 5-year recall |
| Symptoms | Mandatory exclusion | Figure 3 is for asymptomatic participants only | Route away from Figure 3 |
| Missing test-validity flags | Mandatory exclusion | Invalid HPV / unsuitable for analysis / unsatisfactory cytology belong to Section 3 | Repeat test pathway instead |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F3-R1 | Primary HPV screening test result = **HPV not detected** | Return for screening in **5 years** or **3 years if immune deficient** | Routine screening | 5 years, or 3 if immune deficient | No | No | No | No | No | No | Safe deterministic | If immune deficiency unknown, do not default to 5 years |
| F3-R2 | Primary HPV screening test result = **HPV detected 16 or 18** | Refer to colposcopy; if LBC, cytology reported; if swab, cytology will be taken at colposcopy | Colposcopy; prompt specialist referral | No routine delay | Cytology yes if LBC or at colposcopy if swab | Yes | No | No | No | Yes | Provisional only | Very high-risk branch; not safe to downgrade |
| F3-R3 | Primary HPV screening test result = **HPV detected Other** | Obtain cytology; if swab sample, return visit with clinical examination for cytology | Primary/community test completion | As soon as practicable | Yes | Not yet | No | No | No | No | Safe provisional routing | If cytology unavailable, branch cannot complete |
| F3-R4 | HPV detected Other + cytology = **possible/definite high-grade** | Refer to colposcopy | Colposcopy; prompt | No routine delay | Already obtained or take at colposcopy if needed | Yes | No | No | No | Yes | Provisional only | Includes ASC-H, HSIL, SCC, atypical glandular cells, AIS, adenocarcinoma |
| F3-R5 | HPV detected Other + cytology = **negative / ASC-US / LSIL** at first event | First repeat HPV test in 12 months; recommend LBC | Community care | 12 months | Yes if LBC or if HPV detected again | No | No | No | No | No | Safe deterministic | Persistent HPV detected Other should use LBC so cytology is available |
| F3-R6 | First repeat at 12 months = **HPV not detected** | Return to regular interval screening | Routine screening | 5 years or 3 years if immune deficient | No | No | No | No | No | No | Safe deterministic | Confirm immune deficiency status |
| F3-R7 | First repeat at 12 months = **HPV detected 16 or 18** | Refer to colposcopy | Colposcopy; prompt | Immediate referral after result | Cytology yes if LBC / at colposcopy if swab | Yes | No | No | No | Yes | Provisional only | High-risk progression branch |
| F3-R8 | First repeat at 12 months = **HPV detected Other**, then cytology = **possible/definite high-grade** | Refer to colposcopy | Colposcopy; prompt | Immediate after cytology | Yes | Yes | No | No | No | Yes | Provisional only | High-grade trumps age |
| F3-R9 | First repeat at 12 months = **HPV detected Other**, cytology = **negative / ASC-US / LSIL**, and **age ≥ 50 years** | Refer to colposcopy | Colposcopy | Immediate after result set complete | Yes | Yes | No | No | No | No | Safe deterministic | Age threshold is load-bearing |
| F3-R10 | First repeat at 12 months = **HPV detected Other**, cytology = **negative / ASC-US / LSIL**, and **age < 50 years** | Second repeat HPV test in 12 months; recommend LBC | Community care | Another 12 months | Yes if needed | No | No | No | No | No | Safe deterministic | If age missing, do not choose branch |
| F3-R11 | Second repeat at 24 months = **HPV not detected** | Return to regular interval screening | Routine screening | 5 years or 3 years if immune deficient | No | No | No | No | No | No | Safe deterministic | Confirm immune deficiency if relevant |
| F3-R12 | Second repeat at 24 months = **HPV detected (any type)** | Cytology should be available or obtained; refer to colposcopy regardless of cytology branch outcome | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Figure shows cytology still needs to be captured, especially if swab sample |

**D. Safety interpretation**

Figure 3 is one of the best candidates for deterministic provisional support, but only if the system has **HPV genotype**, **age**, **immune deficiency status**, **sample type**, and **cytology result** where needed. Unsafe automation errors here are mostly of two kinds: failing to escalate **HPV detected 16 or 18** or **possible/definite high-grade**, and misapplying the **age 50** threshold or the **immune deficiency** recall interval. Invalid HPV, unsuitable for analysis, and unsatisfactory cytology must trigger a safety stop into the Section 3 repeat-testing pathway rather than a routine recall outcome. citeturn12view0turn15view1

**E. Updated official guidance**

I did not identify a later official source that changes the internal Figure 3 branch logic. The current official NCSP page confirms that HPV testing became the main screening test in September 2023. citeturn19view0

**6. Figure 4 full rule extraction**

The supplied figure corresponds to **Figure 4** on **p46**, titled **“Normal colposcopy following HPV detected (any type) and a cytology result that is negative/ASC-US/LSIL.”** The nearby recommendations place this pathway in the **type 3 TZ / unsatisfactory colposcopy** context, even though the figure title itself does not state that explicitly. Diagnostic excision is not routine, though certain exceptions may exist. citeturn7view3turn13view0turn13view1

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 4 |
| Title | Normal colposcopy following HPV detected (any type) and a cytology result that is negative/ASC-US/LSIL |
| Guideline page | p46 |
| Clinical scope | Post-colposcopy surveillance after low-grade referral context with normal colposcopy; surrounding recommendations link this to type 3 TZ management |
| Use when | Participant has HPV detected (any type), low-grade cytology context, has undergone colposcopy, and colposcopy is normal |
| Do not use when | Cytology is ≥ ASC-H at referral, visible lesion is present, colposcopy is not normal, pregnancy pathway applies, or invalid/unsatisfactory tests remain unresolved |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Colposcopy result = normal | Mandatory | Entry criterion | Safety stop |
| TZ context / type 3 context | Conditional but operationally important | Surrounding text frames Figure 4 in type 3 TZ management | Clinician review if uncertain |
| HPV result at surveillance | Mandatory | Determines recall versus colposcopy | Safety stop |
| HPV type | Mandatory when HPV detected | Distinguishes HPV detected 16 or 18 from HPV detected Other | Safety stop |
| Cytology result at surveillance | Conditional when HPV detected Other | Determines escalation versus repeat | Hold until available |
| Sample type | Conditional | Determines whether return visit for cytology is needed | Hold workflow if unknown |
| Immune deficiency | Mandatory for second low-grade persistence branch | Changes repeat versus colposcopy | Do not default to repeat if unknown |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F4-R1 | Entry state: normal colposcopy after HPV detected (any type) with negative / ASC-US / LSIL cytology context | Repeat HPV test in 12 months in community care; recommend LBC | Community care | 12 months | No extra at entry | No | No | No | No | No | Safe deterministic | Do not use if colposcopy not truly normal |
| F4-R2 | First post-colposcopy repeat = **HPV not detected** | Return to regular interval screening | Routine screening | Standard interval | No | No | No | No | No | No | Safe deterministic | Confirm not immune-deficient only if applying later branches |
| F4-R3 | First post-colposcopy repeat = **HPV detected 16 or 18** | Refer to colposcopy | Colposcopy | Immediate after result | Cytology as per sample/LBC context | Yes | No | No | No | Yes | Provisional only | High-risk persistence branch |
| F4-R4 | First post-colposcopy repeat = **HPV detected Other** | Obtain cytology; if swab, return visit with clinical examination for cytology | Community / test completion | As soon as practicable | Yes | Not yet | No | No | No | No | Safe provisional routing | Cytology is needed before final disposition |
| F4-R5 | HPV detected Other + cytology **≥ ASC-H** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | High-grade cytology overrides surveillance |
| F4-R6 | HPV detected Other + cytology **negative / ASC-US / LSIL** + participant **immune deficient** | Refer to colposcopy | Colposcopy | Immediate after completed result set | Yes | Yes | No | No | No | No | Safe deterministic if immune status known | Do not default to non-colposcopy if immune status missing |
| F4-R7 | HPV detected Other + cytology **negative / ASC-US / LSIL** + participant **not immune deficient** | Repeat HPV test in 12 months in community care; recommend LBC | Community care | 12 months | Conditional | No | No | No | No | No | Safe deterministic | Persistent low-grade non-immune-deficient branch |
| F4-R8 | Second surveillance repeat = **HPV not detected** | Return to regular interval screening | Routine screening | Standard interval | No | No | No | No | No | No | Safe deterministic | — |
| F4-R9 | Second surveillance repeat = **HPV detected (any type)** | Refer to colposcopy | Colposcopy | Immediate | Cytology should be collected/reported | Yes | No | No | No | Yes | Provisional only | The adjacent text confirms any HPV detected at 24 months returns to colposcopy |

**D. Safety interpretation**

Unsafe automation would be most serious in three places: missing an **HPV detected 16 or 18** result; failing to account for **immune deficiency** after persistent HPV detected Other with low-grade cytology; or defaulting someone with missing cytology into repeat surveillance rather than colposcopy. The figure is well suited to deterministic provisional support once the structured inputs are complete. Clinician-only judgement remains necessary where the pathway is being used in the broader type 3 TZ context to consider exceptional diagnostic excision or ECC. citeturn13view0turn13view1turn9view0

**E. Updated official guidance**

The February 2026 official addendum specifically changes the surrounding text for this clinical scenario: for participants with **type 3 TZ**, **HPV positive**, **low-grade cytology**, and **normal colposcopy**, **MDM cytological review is no longer required**. That update simplifies the original surrounding recommendation and makes this branch more suitable for deterministic provisional support, but it does not alter the figure’s core surveillance/referral endpoints. citeturn5view0

**7. Figure 5 full rule extraction**

The supplied figure corresponds to **Figure 5** on **p48**, titled **“Normal colposcopy following HPV detected (any type) and a cytology result that is ≥ ASC-H.”** The surrounding recommendations on pp47-49 show that this is a specialist pathway involving **MDM case review**, possible diagnostic excision, and an observation option for selected confirmed ASC-H cases. citeturn7view4turn14view0turn13view2

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 5 |
| Title | Normal colposcopy following HPV detected (any type) and a cytology result that is ≥ ASC-H |
| Guideline page | p48 |
| Clinical scope | Specialist management after high-grade referral cytology with normal colposcopy |
| Use when | HPV detected (any type), referral cytology is ≥ ASC-H, colposcopy is normal, and specialist review is occurring |
| Do not use when | Low-grade cytology pathway, pregnancy pathway, visible lesion already present, biopsy-defined invasion, or routine primary screening |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| HPV detected status | Mandatory | Entry criterion | Safety stop |
| Cytology result and review result | Mandatory | Distinguishes downgraded LSIL, confirmed ASC-H, upgraded HSIL | MDM review required |
| Colposcopy result = normal, no visible lesion | Mandatory | Entry criterion for this figure | Safety stop |
| TZ type 1 / 2 context | Conditional but important | Surrounding text frames most recommendations in type 1 or 2 TZ context | Clinician confirmation required |
| MDM case review result | Mandatory | Central branch determinant | Clinician-only until known |
| Whether treatment deferred | Conditional | Changes confirmed ASC-H pathway | Clinician-only |
| Follow-up HPV / cytology / colposcopy findings if observation chosen | Conditional | Determines next step after deferred treatment | Clinician-only |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F5-R1 | After normal colposcopy, MDM review downgrades cytology to **LSIL** | Follow the pathway for LSIL | LSIL management pathway | Per LSIL pathway | As required by LSIL pathway | Conditional | No | No | Yes | Yes | Provisional only | Route out to LSIL logic; do not stay in Figure 5 |
| F5-R2 | After normal colposcopy, MDM review confirms **HSIL** or upgrades to HSIL | Follow the pathway for HSIL; treatment recommended | Specialist treatment pathway | Prompt specialist treatment planning | Yes | Conditional | No | No | Yes | Yes | Clinician-only | Includes diagnostic excision pathway |
| F5-R3 | After normal colposcopy, MDM review confirms **ASC-H** | Treatment recommended | Specialist pathway | Prompt | Yes | Conditional | No | No | Yes | Yes | Clinician-only | Observation is an exception, not the default |
| F5-R4 | Confirmed ASC-H and treatment is **deferred** after informed specialist decision | Determine next step based on result of review/follow-up testing | Specialist follow-up | Surrounding text clarifies initial repeat colposcopy/HPV/cytology occurs at **6 months**, despite the figure compressing later outcomes | Yes | Yes | No | No | Yes | Yes | Clinician-only | Timepoint is ambiguous in figure and must be resolved from nearby text |
| F5-R5 | Deferred-treatment follow-up shows **abnormal cytology, HPV detected, and/or visible lesion** | Treatment recommended; consider type 2 excision TZ | Specialist treatment | Prompt | Yes | Yes | No | No | Yes | Yes | Clinician-only | Cancer-sensitive branch |
| F5-R6 | Deferred-treatment follow-up shows **HPV detected, normal colposcopy, negative cytology** | Repeat colposcopy, HPV and cytology in 12 months | Specialist follow-up | 12 months after that follow-up state | Yes | Yes | No | No | Yes | Yes | Clinician-only | Not safe for autonomous closure |
| F5-R7 | Deferred-treatment follow-up shows **HPV not detected, no visible lesion** | Test of Cure (co-testing) | Specialist-to-surveillance transition | Begin Test of Cure | Yes | Conditional | No | No | Yes | Yes | Provisional only | Only after specialist-confirmed observation pathway |

**D. Safety interpretation**

Figure 5 is **not suitable for autonomous automation**. The reasons are structural: it depends on MDM case review, cytology review, colposcopic adequacy, visible-lesion assessment, and an explicitly discretionary decision about whether treatment may be deferred. The only reasonably automatable output is a provisional reminder of the likely next step after the specialist review result is already known. Incorrect automation here could delay diagnostic excision or cancer diagnosis. citeturn14view0turn13view2turn13view3

**E. Updated official guidance**

I did not identify a later official source that directly changes the Figure 5 pathway itself. The 2026 addendum affects R6.05, which is adjacent but pertains to the low-grade/type 3 TZ scenario rather than this high-grade/MDM figure. citeturn5view0

**8. Figure 6 full rule extraction**

The supplied figure corresponds to **Figure 6** on **p57**, titled **“Test of Cure following treatment for HSIL (CIN2/3).”** The adjacent recommendations on pp56-57 clarify that co-testing occurs at **6 months and 18 months** after treatment, that incomplete excision in the 2023 PDF implies colposcopy-clinic follow-up, and that any HPV-detected result or high-grade/glandular cytology can return to colposcopy. citeturn7view5turn9view2turn17view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 6 |
| Title | Test of Cure following treatment for HSIL (CIN2/3) |
| Guideline page | p57 |
| Clinical scope | Post-treatment co-testing surveillance following HSIL (CIN2/3) |
| Use when | Participant has been treated for HSIL (CIN2/3) and is entering or continuing Test of Cure |
| Do not use when | No confirmed prior HSIL treatment, AIS-only pathway, pregnancy high-grade pathway, or missing treatment/follow-up timing |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Confirmed prior treatment for HSIL (CIN2/3) | Mandatory | Entry criterion | Safety stop |
| Time since treatment | Mandatory | Distinguishes 6-month from later checkpoints | Delay/hold until timing known |
| HPV result | Mandatory | Major branch determinant | Safety stop |
| Cytology result | Mandatory | Major branch determinant | Safety stop |
| Cytology grade grouping | Mandatory if abnormal | Distinguishes low grade from possible/definite high grade | Safety stop |
| Excision completeness / margin status | Conditional but important | Determines setting of follow-up and is affected by 2026 update | Clinician review if unknown |
| Age under/over 50 for positive margins | Conditional | Required to apply updated official guidance | If unknown, do not auto-apply update |
| Sample setting: primary/community or colposcopy clinic | Conditional | Relevant to operational follow-up destination | Clinician review if conflicting |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F6-R1 | 6 months post-treatment: **HPV not detected + cytology negative** | Repeat cytology and HPV testing in 12 months | Primary/community care if pathway allows | 12 months | Yes | No | No | No | No | No | Safe deterministic | Needs correct treatment date |
| F6-R2 | 6 months post-treatment: **HPV detected + any cytology** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Cancer-sensitive persistence branch |
| F6-R3 | 6 months post-treatment: **HPV not detected + cytology abnormal** and cytology = **possible/definite high-grade** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | High-grade cytology trumps HPV negativity |
| F6-R4 | 6 months post-treatment: **HPV not detected + cytology abnormal** and cytology = **low grade** | Repeat cytology and HPV testing in 12 months | Surveillance | 12 months | Yes | No | No | No | No | No | Safe deterministic | This is one of the few low-grade residual branches |
| F6-R5 | After F6-R1, 18-month co-test = **HPV not detected + cytology negative** | Return to regular screening | Routine screening | Exit Test of Cure | No further Test of Cure | No | No | No | No | No | Safe deterministic | Requires two consecutive negative co-tests |
| F6-R6 | After F6-R1, 18-month co-test = **HPV detected + any cytology** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Matches R8.07 |
| F6-R7 | After F6-R1, 18-month co-test = **HPV not detected + cytology abnormal**, cytology = **possible/definite high-grade** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Matches R8.08 |
| F6-R8 | After F6-R1, 18-month co-test = **HPV not detected + cytology abnormal**, cytology = **low grade** | Repeat cytology and HPV testing in 12 months | Surveillance | 12 months | Yes | No | No | No | No | No | Safe deterministic | Persistent-low-grade logic |
| F6-R9 | After any low-grade repeat branch, next annual co-test = **HPV not detected + cytology negative** | Continue Test of Cure until successful completion | Surveillance | Annual until two consecutive negative co-tests achieved | Yes | No | No | No | No | Yes | Provisional only | “Successful completion” must be counted carefully |
| F6-R10 | After any low-grade repeat branch, next annual co-test = **HPV detected + any cytology** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Matches R8.07 |
| F6-R11 | After any low-grade repeat branch, next annual co-test = **HPV not detected + cytology abnormal** | Refer to colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | R8.07 specifies two consecutive low-grade cytology results with negative HPV return to colposcopy |
| F6-R12 | At any time during Test of Cure, cytology shows **ASC-H / HSIL / any glandular abnormality** | Refer to colposcopy regardless of HPV result | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Highest-risk override rule |

**D. Safety interpretation**

Figure 6 has several branches that are safe for deterministic provisional support, but only if timing and prior Test-of-Cure status are carefully tracked. The dangerous failure mode is concluding that a participant has successfully completed Test of Cure when they have not yet met the requirement for **two consecutive negative co-tests 12 months apart**. Routine recall is unsafe if HPV is detected at any point, if there are high-grade or glandular cytology findings, or if negative-HPV plus abnormal cytology has recurred. citeturn9view2turn17view0

**E. Updated official guidance**

The official February 2026 addendum changes one important pathway-entry condition relevant to Figure 6. In the 2023 PDF, if the treatment histology does not show complete excision, follow-up is in colposcopy clinic. The updated official guidance states that, for participants **aged under 50 with positive excision margins at the time of HSIL treatment**, **Test of Cure follow-up can be done in primary/community care**. This changes the follow-up **setting**, not the internal logic of Figure 6 once Test of Cure testing is underway. Participants aged 50 and over still follow the original 2023 incomplete-excision logic unless a later official update says otherwise. citeturn9view2turn5view0

**9. Figure 7 full rule extraction**

The supplied figure corresponds to **Figure 7** on **p60**, titled **“Management for participants with atypical and abnormal glandular abnormalities.”** The surrounding recommendations on pp58-60 clarify which cytology categories go to colposcopy versus gynaecology, when type 3 excision is recommended, and when urgent oncological referral is needed. citeturn7view6turn17view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 7 |
| Title | Management for participants with atypical and abnormal glandular abnormalities |
| Guideline page | p60 |
| Clinical scope | Specialist management of atypical glandular cells, AIS, and adenocarcinoma-related cytology |
| Use when | Participant has AG1-AG5, AIS, AC1-AC4, or equivalent glandular abnormality pathway entry |
| Do not use when | Routine squamous screening only, isolated low-grade squamous pathway, or non-glandular post-colposcopy pathways |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Exact glandular abnormality category | Mandatory | Determines entry branch | Safety stop |
| Visible lesion at colposcopy | Mandatory after colposcopy | Determines MDM review versus biopsy | Clinician-only |
| Cytology review confirmation result | Mandatory in no-visible-lesion branch | Determines type 3 excision versus repeat colposcopy | MDM required |
| Biopsy result | Mandatory in visible-lesion branch | Determines type 3 excision versus oncology referral | Clinician-only |
| Whether cytology is AG2 / AC2 | Mandatory | Determines direct gynaecology route | Safety stop |
| Any features consistent with cancer | Mandatory when biopsy performed | Determines urgent specialist route | Clinician-only |
| HPV result | Often present but not decisive for all branches | Glandular pathways are managed as high risk irrespective of many HPV details | Do not use HPV to down-triage without guideline support |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F7-R1 | Glandular abnormality category = **AG2** or **AC2** | Refer to gynaecology | Gynaecology; prompt, and urgent if invasive cancer/endometrial carcinoma context applies | Immediate referral workflow | No extra triage cytology beyond existing work-up | Not as default unless another indication | Yes | Conditional | No | Yes | Clinician-only | This is not a routine colposcopy-first branch |
| F7-R2 | Glandular abnormality category = **AG1, AG3-AG5, AC1, AC3, AC4, AIS** | Refer to colposcopy | Colposcopy; specialist | Immediate referral workflow | Existing cytology already entry trigger | Yes | Conditional | Conditional | No | Yes | Provisional only | High-risk entry branch |
| F7-R3 | After colposcopy, **no visible lesion** and **cytology confirmed (not AG2)** | Type 3 excision | Specialist procedure | Prompt | Review cytology already required | Yes/colposcopy already done | No | No | Yes | Yes | Clinician-only | Type 3 TZ logic; not autonomous |
| F7-R4 | After colposcopy, **no visible lesion**, MDM case review, **AG2 cytology confirmed** | Investigate further for other gynaecological malignancies | Gynaecology | Prompt | Cytology confirmation required | Colposcopy already done | Yes | Conditional | Yes | Yes | Clinician-only | Endometrial / non-cervical malignancy path |
| F7-R5 | After colposcopy, **no visible lesion**, and **cytology not confirmed** | Repeat colposcopy in 6 months | Specialist follow-up | 6 months | As needed by specialist | Yes | Conditional | No | Yes | Yes | Clinician-only | Not safe for routine recall |
| F7-R6 | After colposcopy, **visible lesion** and biopsy = **AIS** | Type 3 excision | Specialist procedure | Prompt | Existing cytology plus biopsy | Colposcopy already done | No | No | No | Yes | Clinician-only | If HPV status unknown, guideline says test before treatment if AIS confirmed without prior HPV testing |
| F7-R7 | After colposcopy, **visible lesion** and biopsy **consistent with cancer** | Refer to gynaecological oncologist | Oncology; urgent | Immediate/urgent | Existing cytology plus biopsy | Colposcopy already done | No | Yes | No | Yes | Clinician-only | This is one of the least automatable branches |

**D. Safety interpretation**

Figure 7 contains several of the highest-risk branches in the entire document. **Routine recall is unsafe** in all glandular abnormality scenarios until specialist work-up is complete. Branches requiring **MDM case review**, **biopsy interpretation**, **type 3 excision**, or **oncology referral** are unsuitable for autonomous automation. A practical CDS system can safely do only three things here: identify the pathway, prevent routine down-triage, and issue a **provisional recommendation** that specialist review is mandatory. citeturn17view0turn9view3

**E. Updated official guidance**

I did not identify a later official source that directly changes Figure 7 itself. The 2026 addendum changes AIS follow-up after excision with clear margins, but not the initial diagnostic/colposcopic glandular abnormality logic shown in Figure 7. citeturn5view0

**10. Figure 8 full rule extraction**

The supplied figure corresponds to **Figure 8** on **p68**, titled **“Screening after total hysterectomy.”** The surrounding text on pp63-66 and Table 1 on pp66-67 provide the exact combination rules. The section text repeatedly says “See Table 1 and Figure 9,” but the displayed hysterectomy image is Figure 8; I treated that as an internal reference error. citeturn7view7turn10view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 8 |
| Title | Screening after total hysterectomy |
| Guideline page | p68 |
| Clinical scope | Summary router for screening/surveillance after **total** hysterectomy |
| Use when | Participant has had a **total hysterectomy** and cervical pathology / prior screening history must be used to determine surveillance |
| Do not use when | Subtotal hysterectomy, specialist follow-up after cervical or vaginal cancer, or vaginal bleeding after hysterectomy being managed as a symptom pathway |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Hysterectomy type: total vs subtotal | Mandatory | Figure 8 applies only to total hysterectomy | Safety stop |
| Indication for hysterectomy | Mandatory | Benign disease vs treatment-related context changes pathway | Safety stop |
| Prior screening history category | Mandatory | Determines initial grouping | Safety stop |
| Prior high-grade history / Test of Cure completeness | Mandatory where relevant | Determines no-further-screening vs Test of Cure vs colposcopy | Safety stop |
| Cervical pathology in hysterectomy specimen | Mandatory | Core determinant | Do not route if pathology unavailable |
| Whether excision is complete | Conditional when HSIL/AIS present | Determines Test of Cure versus colposcopy | Clinician review required if unknown |
| Screening history known? | Conditional in left branch | Determines no-further-screening versus HPV test | If unknown, do not cease screening |
| Cancer history | Mandatory exclusion | Updated official guidance removes cervical/vaginal cancer survivors from these pathways in most cases | Specialist review required |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F8-R1 | Prior history is negative / resolved low-grade / completed Test of Cure, total hysterectomy done, cervical pathology = **no cervical pathology**, and screening history known | No further screening required | Exit pathway | None | No | No | No | No | No | No | Safe deterministic | Do not stop screening if “history known” is false |
| F8-R2 | Same broad group as F8-R1, but screening history unknown or pathology shows unexpected low grade requiring vault testing | HPV test | Community care | Usually at 6 months if unknown-history low-grade context, otherwise per Table 1 / Figure 3 | Cytology only if HPV detected and pathway requires | No initially | No | No | No | No | Safe deterministic if row clearly identified | Use Table 1 to resolve exact row |
| F8-R3 | Post-hysterectomy HPV test = **HPV not detected** | No further screening required | Exit pathway | None | No | No | No | No | No | No | Safe deterministic | Applies only where HPV-test branch is the correct row |
| F8-R4 | Post-hysterectomy HPV test = **HPV detected (any type)** | Follow Primary HPV pathway Figure 3 | Community/specialist per Figure 3 | Immediate routing into Figure 3 | Conditional | Conditional | No | No | No | No | Safe deterministic | Must only be used in rows that call for HPV-test follow-up |
| F8-R5 | Prior low-grade not returned to regular screening or unresolved high-grade/Test of Cure branch, hysterectomy specimen shows **HSIL (CIN2/3) or AIS** and excision **complete** | Test of Cure until successful completion | Surveillance | Co-testing per Test-of-Cure logic | Yes | No initially | No | No | No | Yes | Provisional only | Use Table 1 for exact row category |
| F8-R6 | Same as F8-R5 but excision **incomplete** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | Incomplete excision is not safe for autonomous closure |
| F8-R7 | Rightmost unresolved branch with no cervical pathology or low-grade histology after hysterectomy | Test of Cure until successful completion | Surveillance | Co-testing until completion | Yes | Conditional if abnormal | No | No | No | Yes | Provisional only | Exact rowing depends on Table 1 |
| F8-R8 | Any cervical or vaginal cancer follow-up scenario | Do not use Figure 8 as the governing follow-up rule | Specialist cancer follow-up | Per specialist guideline | Variable | Variable | Yes/No per cancer team | Conditional | MDT often | Yes | Clinician-only | Updated official guidance supersedes 2023 ambiguity |

**D. Safety interpretation**

Figure 8 is a **summary router**, not the best place to encode exact surveillance rules. Safe automation depends on having the exact prior-history row and pathology row, which is why **Table 1** should be treated as the operational matrix. Routine cessation of surveillance is unsafe if screening history is unknown, if the hysterectomy specimen shows unexpected HSIL/AIS, or if excision completeness is not known. citeturn10view0turn7view7

**E. Updated official guidance**

Two later official updates matter here. First, the February 2026 addendum says that people with previous **cervical or vaginal cancer** are generally outside NCSP-managed screening follow-up, except specified **stage 1a1 cervical cancer** situations; they are unenrolled and followed by specialist care. That changes the practical **do-not-use** boundary for Figure 8/Table 1. Second, the addendum changes follow-up of **HPV detected AIS with clear margins** to **primary/community care with a co-test at 6 and 18 months**, replacing the 2023 requirement for first follow-up at colposcopy. Where a Figure 8 or Table 1 branch says “Test of Cure” after clear-margin HPV detected AIS, the updated official setting and timing should be applied instead of the 2023 colposcopy-first follow-up rule. citeturn5view0turn18view1

**11. Table 1 full rule extraction**

Table 1 is the exact row-level post-total-hysterectomy decision matrix on **pp66-67**, titled **“Vaginal screening after total hysterectomy.”** It provides the most precise rule set for hysterectomy follow-up and should control implementation over the more schematic Figure 8 whenever both are available. citeturn7view10turn10view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Table 1 |
| Title | Vaginal screening after total hysterectomy |
| Guideline page | pp66-67 |
| Clinical scope | Exact row-level surveillance recommendations after total hysterectomy |
| Use when | Total hysterectomy has occurred and the prior screening history, indication, and cervical pathology in the hysterectomy specimen are known |
| Do not use when | Subtotal hysterectomy or specialist cancer follow-up is the governing pathway |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Prior screening history row | Mandatory | Table row selector | Safety stop |
| Indication for hysterectomy | Mandatory | Benign disease vs treatment context | Safety stop |
| Cervical pathology in histology specimen | Mandatory | Determines output in every row | Safety stop |
| Excision completeness | Mandatory when HSIL/AIS present | Distinguishes Test of Cure from colposcopy | Safety stop |
| Cancer history exclusion | Mandatory | Updated official boundary | Clinician review required |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Repeat timing / recall | Cytology required | Colposcopy required | Gynae referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1-R1 | Prior history: negative / previous ASC-US/LSIL returned to regular screening; benign disease; histology: **no cervical pathology** | No further screening | Exit pathway | None | No | No | No | No | No | No | Safe deterministic | — |
| T1-R2 | Same row group; histology: **LSIL (CIN1) excised or not** | HPV test (follow Figure 3) | Community care | Per Figure 3 | Conditional | No initially | No | No | No | No | Safe deterministic | — |
| T1-R3 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | AIS clear-margin update applies if HPV detected AIS |
| T1-R4 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |
| T1-R5 | Prior history: previous ASC-US/LSIL not returned to regular screening; benign disease; histology: **no cervical pathology** | HPV test (follow Figure 3) | Community care | Per Figure 3 | Conditional | No initially | No | No | No | No | Safe deterministic | — |
| T1-R6 | Same row group; histology: **LSIL (CIN1) excised or not** | HPV test (follow Figure 3) | Community care | Per Figure 3 | Conditional | No initially | No | No | No | No | Safe deterministic | — |
| T1-R7 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | AIS clear-margin update may alter care setting |
| T1-R8 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |
| T1-R9 | Prior history: treated HSIL (CIN2/3) with completed Test of Cure; benign disease; histology: **no cervical pathology** | No further screening | Exit pathway | None | No | No | No | No | No | No | Safe deterministic | — |
| T1-R10 | Same row group; histology: **LSIL (CIN1) excised or not** | HPV test (follow Figure 3) | Community care | Per Figure 3 | Conditional | No initially | No | No | No | No | Safe deterministic | — |
| T1-R11 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | Unexpected high-grade at hysterectomy specimen matters |
| T1-R12 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |
| T1-R13 | Prior history: abnormal screening with diagnosed HSIL (CIN2/3) or AIS before hysterectomy, untreated or incompletely treated, +/- benign disease; histology: **no cervical pathology or low grade** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | Routine exit would be unsafe |
| T1-R14 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | — |
| T1-R15 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |
| T1-R16 | Prior history: previous treatment for HSIL (CIN2/3) or AIS with incomplete Test of Cure; benign disease; histology: **no cervical pathology or low grade** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | — |
| T1-R17 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | AIS clear-margin update may alter setting |
| T1-R18 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |
| T1-R19 | Prior history: **no known screening history**; benign disease; histology: **no cervical pathology or low grade** | HPV at 6 months post hysterectomy | Community care | 6 months | No initially | No | No | No | No | No | Safe deterministic | Do not cease screening without this negative HPV |
| T1-R20 | Same row group; histology: **HSIL (CIN2/3) or AIS, completely excised** | Test of Cure | Surveillance | Per Test of Cure pathway | Yes | No initially | No | No | No | Yes | Provisional only | — |
| T1-R21 | Same row group; histology: **HSIL (CIN2/3) or AIS, incompletely excised** | Colposcopy | Colposcopy | Immediate | Yes | Yes | No | No | No | Yes | Provisional only | — |

**D. Safety interpretation**

Table 1 is the single most useful source for deterministic post-hysterectomy provisional logic, but only after the system has **exact prior history**, **indication for hysterectomy**, **specimen pathology**, and **excision completeness**. The branch most vulnerable to unsafe under-management is the **history unknown + benign disease + no cervical pathology/low grade** row; it requires **HPV at 6 months post hysterectomy**, not immediate cessation. Rows leading to Test of Cure or colposcopy should not be collapsed into a “routine recall” state. citeturn7view10turn10view0

**E. Updated official guidance**

The same two 2026 updates noted for Figure 8 apply here: cancer-survivor specialist follow-up is generally outside NCSP pathway management, and clear-margin **HPV detected AIS** follow-up is now in primary/community care with co-testing at **6 and 18 months**. Those updates change the care setting and timing behind some “Test of Cure” labels in Table 1 when the underlying pathology is HPV detected AIS with clear margins. citeturn5view0

**12. Figure 9 full rule extraction**

The supplied figure corresponds to **Figure 9** on **p72**, titled **“Management of pregnant participant with possible/definite high-grade in situ cytology (ASC-H, HSIL, Atypical glandular cells, AIS).”** The nearby recommendations on pp69-71 clarify that colposcopy in pregnancy should be performed by an experienced colposcopist, that biopsy is usually unnecessary unless invasion is suspected, and that invasive disease requires very urgent specialist review. citeturn7view8turn11view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 9 |
| Title | Management of pregnant participant with possible/definite high-grade in situ cytology (ASC-H, HSIL, Atypical glandular cells, AIS) |
| Guideline page | p72 |
| Clinical scope | Pregnancy-specific management of possible/definite high-grade in situ cytology |
| Use when | Participant is pregnant and cytology shows ASC-H, HSIL, atypical glandular cells, or AIS |
| Do not use when | Participant is not pregnant, cytology is only low-grade, or symptoms/invasion already place the participant directly in cancer management |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Pregnancy status | Mandatory | Entry criterion | Safety stop |
| Cytology category | Mandatory | Entry criterion | Safety stop |
| Colposcopic visible lesion / TZ appearance | Mandatory | Determines MDM vs abnormal-TZ branches | Clinician-only |
| Colposcopic impression of invasion | Conditional | Triggers biopsy/oncology escalation | Clinician-only |
| Biopsy result if performed | Conditional | Determines oncology referral versus MDM case review | Clinician-only |
| Postpartum interval | Conditional | Needed for deferred follow-up timing | Hold timing-dependent actions |
| Breastfeeding / need for vaginal oestrogen before postpartum colposcopy | Optional but relevant | Practical optimisation of postpartum assessment | Does not change core branch but matters clinically |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F9-R1 | Pregnant participant with ASC-H, HSIL, atypical glandular cells or AIS cytology | Colposcopy | Colposcopy; as soon as practicable | Prompt | Existing cytology already present | Yes | No | No | No | Yes | Provisional only | Pregnancy-specific colposcopy requires experience |
| F9-R2 | Colposcopy shows **normal TZ / no concerning visible lesion**, MDM review downgrades to **negative** | Follow HPV primary screening pathway Figure 3 | Return to screening pathway | Per Figure 3 | As per pathway | No immediate repeat | No | No | Yes | Yes | Provisional only | Only after specialist review |
| F9-R3 | Same entry, MDM review downgrades to **LSIL / ASC-US** | Follow the pathway for LSIL | LSIL pathway | Per LSIL pathway | As required | Conditional | No | No | Yes | Yes | Provisional only | Still pregnancy context; clinician oversight remains necessary |
| F9-R4 | Same entry, MDM review confirms **possible/definite high-grade** | Colposcopy review in 6 months or at 6-12 weeks postpartum | Specialist follow-up | 6 months or postpartum 6-12 weeks | Yes if taken at follow-up | Yes | No | No | Yes | Yes | Clinician-only | Treatment generally deferred until postpartum unless invasion suspected |
| F9-R5 | Colposcopy shows **abnormal TZ** and colposcopic impression = **LSIL, HSIL (CIN2/3) or AIS** | Colposcopy review in 6 months or at 6-12 weeks postpartum | Specialist follow-up | 6 months or postpartum 6-12 weeks | Conditional | Yes | No | No | No | Yes | Clinician-only | Not a routine surveillance branch |
| F9-R6 | Colposcopy shows **abnormal TZ** and impression suggests **invasion** | Biopsy | Specialist diagnostic step | Immediate | Existing cytology plus biopsy | Yes | No | Conditional | No | Yes | Clinician-only | Biopsy is usually unnecessary unless invasion suspected |
| F9-R7 | Biopsy **positive for invasion** | Refer to gynaecological oncologist | Oncology; urgent, within 2 weeks per surrounding recommendation | Immediate | Yes | Yes / already done | No | Yes | MDT required | Yes | Clinician-only | Very high-risk branch |
| F9-R8 | Biopsy **negative for invasion** | MDM case review | Specialist multidisciplinary review | Immediate review | Yes | Yes | No | No | Yes | Yes | Clinician-only | Negative biopsy does not equal routine discharge |

**D. Safety interpretation**

Figure 9 is **not suitable for autonomous automation**. It depends on pregnancy-specific colposcopic interpretation, suspicion of invasion, biopsy necessity, and MDT-informed decisions. The load-bearing safety rule is that suspected or confirmed invasive disease in pregnancy should be seen by an experienced gynaecological oncologist within **two weeks** and managed by a multidisciplinary team. Routine recall would be unsafe in any branch short of explicit downgrade by specialist review. citeturn11view0

**E. Updated official guidance**

I did not identify a later official source that explicitly changes the Figure 9 pregnancy pathway itself. citeturn5view0

**13. Figure 10 full rule extraction**

The supplied figure corresponds to **Figure 10** on **p84**, titled **“Investigation of participants with abnormal vaginal bleeding (inter-menstrual or post-coital).”** The surrounding recommendations on pp81-84 show that persistent/unexplained intermenstrual bleeding needs specialist gynaecological assessment regardless of test results, that recurrent/persistent postcoital bleeding may need specialist assessment despite a negative co-test, and that postmenopausal bleeding requires referral without waiting for co-test results. The section text says “See Figure 11,” but the displayed flowchart is Figure 10; I treated that as an internal numbering error. citeturn7view9turn8view0

**A. Identity**

| Field | Extraction |
|---|---|
| Figure/table number | Figure 10 |
| Title | Investigation of participants with abnormal vaginal bleeding (inter-menstrual or post-coital) |
| Guideline page | p84 |
| Clinical scope | Symptomatic investigation pathway, not routine screening |
| Use when | Participant presents with abnormal vaginal bleeding, especially intermenstrual or postcoital bleeding |
| Do not use when | Participant is asymptomatic and attending routine screening only; or the clinical issue is clearly postmenopausal bleeding follow-up already requiring immediate specialist referral |

**B. Required inputs**

| Input | Status | Why needed | If missing |
|---|---|---|---|
| Bleeding type | Mandatory | Distinguishes intermenstrual, postcoital, postmenopausal patterns | Clinician review required |
| History: menstrual / contraceptive / sexual | Mandatory | Entry assessment step and determines oral contraceptive / STI branches | Do not automate final outcome without history |
| Speculum and pelvic exam result | Mandatory | Determines abnormal cervix branch | Clinician-only |
| Co-test status and result | Conditional | Needed in several branches but should not delay urgent referral when suspected cancer/postmenopausal bleeding | If pending, do not delay referral when urgent |
| Suspicion of cancer | Mandatory | Critical escalation determinant | Safety stop |
| STI identified | Conditional | Determines treatment branch | If not yet tested, do not auto-close |
| Oral contraceptive problem suspected | Conditional | Determines adjustment branch | If uncertain, clinician review |
| Bleeding resolved at 6-8 weeks | Conditional | Determines return to routine screening versus gynaecology referral | Not safe to assume resolution |
| Age for regular screening recommencement | Conditional | Needed when returning to routine screening | If <25, screening commencement wording matters |

**C. Decision tree in rule form**

| Rule ID | Input conditions | Output recommendation | Destination / urgency | Recall / repeat timing | Cytology required | Colposcopy required | Gynaecology referral | Oncology referral | MDM/MDT | Clinician review required | Automation | Missing-data behaviour / edge cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F10-R1 | Participant has abnormal vaginal bleeding | Take history (menstrual, contraceptive, sexual), perform speculum and pelvic exam, and obtain co-test | Symptom assessment | Immediate work-up | Yes, co-test | No initially | Conditional | No | No | Yes | Provisional only | Symptomatic pathway; not routine screening |
| F10-R2 | At any point there are signs/symptoms suggestive of cervical cancer | Refer for gynaecological assessment without delay; co-test should not delay referral | Specialist gynaecology / cancer exclusion; urgent | Immediate | Yes, but do not delay referral | Conditional | Yes | Conditional | No | Yes | Clinician-only | Highest-risk override rule |
| F10-R3 | Exam finds **abnormal cervix** and there is **suspicion of cancer** | Co-test and colposcopy | Urgent specialist work-up | Immediate | Yes | Yes | Yes/conditional | Conditional | No | Yes | Clinician-only | Do not wait for co-test before referral if concern is high |
| F10-R4 | Exam finds **abnormal cervix** but **no suspicion of cancer** | Treat according to Healthcare Pathways or refer to gynaecology | Clinical management or specialist referral | As directed by symptoms/local pathway | Co-test may still inform work-up | Conditional | Yes/conditional | No | No | Yes | Provisional only | Intermenstrual bleeding may still need specialist referral regardless of tests |
| F10-R5 | Cervix not abnormal and **oral contraceptive problem suspected** | Adjust oral contraceptive | Clinical management | Reassess bleeding in 6-8 weeks | No automatic extra cytology beyond co-test already considered | No | No initially | No | No | Yes | Provisional only | Needs follow-up resolution check |
| F10-R6 | Cervix not abnormal and no oral contraceptive problem suspected | Investigations as per Healthcare Pathways or consult local gynaecology | Clinical work-up | Immediate next-step investigation | Co-test if due / suspected cervical abnormality | No initially | Conditional | No | No | Yes | Provisional only | STI branch sits downstream |
| F10-R7 | STI identified | Treat STI | Clinical treatment | Reassess bleeding in 6-8 weeks | No extra unless otherwise indicated | No | No initially | No | No | Yes | Provisional only | Persistent bleeding after STI treatment re-escalates |
| F10-R8 | After non-cancer branch management, bleeding **resolved in 6-8 weeks** | Continue regular cervical screening if ≥25 or commence at age 25 | Routine screening re-entry | Resume standard recall | Per routine screening | No | No | No | No | No | Safe deterministic if resolution proven | Do not auto-close without documented resolution |
| F10-R9 | After non-cancer branch management, bleeding **not resolved in 6-8 weeks** | Refer to gynaecology | Gynaecology | Prompt | Co-test results do not negate referral need | No by default | Yes | No | No | Yes | Provisional only | Persistent/unexplained intermenstrual bleeding requires specialist assessment |

**D. Safety interpretation**

Figure 10 is only partly automatable. It is fundamentally a **symptom-investigation** pathway, and routine screening logic can be dangerous if applied too early. The branches that must remain clinician-led are those involving an abnormal cervix, cancer suspicion, postmenopausal bleeding, persistent/unexplained bleeding, or unclear bleeding cause. A safe CDS tool can help by recognizing when symptomatic pathways override routine screening and by preventing a false “routine recall” closure. citeturn8view0

**E. Updated official guidance**

I did not identify a later official source that explicitly changes the Figure 10 pathway. The biggest implementation issue is instead the June 2023 PDF’s own internal reference inconsistency: the recommendations say “See Figure 11,” while the displayed flowchart is Figure 10. The surrounding recommendation text should therefore be used to resolve ambiguous operational details, especially for **postmenopausal bleeding** and **persistent intermenstrual bleeding**. citeturn8view0

## Consolidated data model and rule matrix

**14. Consolidated input data model**

| Field | Allowed / expected values | Mandatory contexts | Used in items | If missing |
|---|---|---|---|---|
| Participant age | Numeric; important cut-points 25, 50, 70, 74 | Figure 3, symptom return-to-screening, transition age-out scenarios | 2, 5, 13 | Safety stop where age changes disposition |
| Immune deficiency | Yes / No / Unknown | Figure 3, Figure 4 | 2, 5, 16, 18 | Do not default to longer recall if unknown |
| HPV result | HPV not detected / HPV detected / invalid HPV / unsuitable for analysis | Most pathways | 5, 6, 8, 10, 11, 16 | Route to Section 3 repeat-testing if invalid/unsuitable |
| HPV type | HPV detected 16 or 18 / HPV detected Other / any type | Figures 3, 4, 6 | 5, 6, 8, 15, 18 | Do not collapse HPV detected 16 or 18 into HPV detected Other |
| Sample type | Swab / LBC | Figures 3, 4 | 5, 6, 14 | Needed to know whether cytology is already available |
| Cytology result | Negative / ASC-US / LSIL / ASC-H / HSIL / SCC / atypical glandular cells / AIS / adenocarcinoma / atypical endometrial cells / unsatisfactory cytology | Many pathways | 4-13, 16-18 | If missing, hold branch requiring cytology |
| Cytology adequacy | Adequate / unsatisfactory | Sections with cytology dependence | 5, 6, 14, 16 | Repeat LBC within guideline timeframe |
| Previous screening history | Structured category | Transition and hysterectomy pathways | 3, 4, 10, 11, 14 | Safety stop |
| Previous abnormality type | None / low grade / HSIL / glandular abnormality / AIS / atypical endometrial cells | Transition, special follow-up | 3, 4, 10, 11, 14 | Safety stop |
| Previous colposcopy referral completed | Yes / No / Unknown | Figure 2 | 4, 16 | Do not routine-recall if unknown |
| Test of Cure status | Not started / in progress / complete / incomplete | Transition, post-treatment, hysterectomy | 3, 4, 8, 10, 11, 14 | Safety stop |
| Treatment date | Date | Figure 6, some AIS follow-up | 8, 14 | Cannot calculate 6- and 18-month checkpoints |
| Excision completeness / margins | Complete / incomplete / unknown | Figure 6 update, Figure 8, Table 1 | 8, 10, 11, 17 | Safety stop for routing between Test of Cure and colposcopy |
| Pregnancy status | Pregnant / not pregnant / unknown | Figure 9 exclusion and routing | 2, 12, 14 | Safety stop |
| Hysterectomy type | Total / subtotal / unknown | Figure 8 / Table 1 | 10, 11, 14 | Safety stop |
| Hysterectomy indication | Benign disease / treatment-related / cancer | Figure 8 / Table 1 | 10, 11, 14 | Safety stop |
| Cervical pathology in specimen | No cervical pathology / LSIL(CIN1) / HSIL(CIN2/3) / AIS / low grade / unknown | Figure 8 / Table 1 | 10, 11, 14 | Safety stop |
| Abnormal bleeding type | Intermenstrual / postcoital / postmenopausal / other | Figure 10 | 13, 16 | Clinician review required |
| Visible lesion | Yes / No | Figures 7 and 9 | 9, 12, 17 | Clinician-only branch |
| Colposcopy result | Normal / abnormal / type 3 TZ / type 1/2 TZ / impression of invasion | Figures 4, 5, 7, 9 | 6, 7, 9, 12, 17 | Clinician-only if absent |
| Biopsy result | AIS / consistent with cancer / positive for invasion / negative for invasion / other | Figures 7 and 9 | 9, 12, 17 | Safety stop |
| Histology result | LSIL / HSIL / AIS / malignancy / none | Figures 5, 6, 8, 11 | 7-11, 17 | Safety stop |
| MDM/MDT review status | Required / completed / outcome known | Figures 5, 7, 9 | 7, 9, 12, 17 | Do not automate without outcome |
| Cancer history | Cervical cancer / vaginal cancer / stage 1a1/local excision history / none | Figure 8 / Table 1 exclusion | 10, 11, 16 | Specialist review required |

The current guideline also defines how to handle **invalid HPV**, **unsuitable for analysis**, and **unsatisfactory cytology** outside the figure set: repeat invalid or unsuitable HPV testing as soon as practicable, and repeat unsatisfactory cytology no sooner than 6 weeks and no later than 3 months; HPV detected 16 or 18 with unsatisfactory cytology still goes to colposcopy, and HPV detected Other with two consecutive unsatisfactory cytology results goes to colposcopy. These are essential cross-cutting safety stops for any implementation of the figures. citeturn12view0

**15. Consolidated rule matrix**

| Rule family | Core determinant | Main outputs |
|---|---|---|
| F1 | Transition-only, resolved or low-risk prior history | Invite now or at next scheduled visit, then start Figure 3 |
| F2 | Transition-only, unresolved prior high-grade or glandular history | Colposcopy outstanding, complete Test of Cure, specialist gynaecology, or enter Figure 3 |
| F3 | HPV genotype + cytology + age 50 + immune deficiency | Routine recall, repeat HPV in 12 months, or colposcopy |
| F4 | Post-colposcopy low-grade scenario + HPV persistence + immune status | Regular interval screening, repeat HPV in 12 months, or colposcopy |
| F5 | MDM-reviewed high-grade discordance after normal colposcopy | LSIL pathway, HSIL treatment pathway, observation with repeat specialist review, or Test of Cure |
| F6 | Test-of-Cure timing + HPV + cytology | Continue surveillance, return to regular screening, or colposcopy |
| F7 | Glandular category + visible lesion + cytology/biopsy confirmation | Gynaecology, colposcopy, type 3 excision, repeat colposcopy, or oncology |
| F8/T1 | Post-total-hysterectomy prior-history matrix + specimen pathology + completeness | No further screening, HPV test / Figure 3, Test of Cure, or colposcopy |
| F9 | Pregnancy + high-grade cytology + colposcopic impression | Pregnancy colposcopy surveillance, postpartum review, biopsy, or oncology |
| F10 | Symptomatic bleeding + exam findings + cancer suspicion + response to treatment | Co-test/exam, colposcopy, treat STI, adjust oral contraceptive, gynaecology referral, or return to routine screening |

**16. Missing-data and safety-stop matrix**

| Missing / uncertain data | Unsafe default | Required action |
|---|---|---|
| HPV genotype unknown while HPV detected is known | Treating as HPV detected Other | Hold and obtain genotype before routing |
| Cytology pending where HPV detected Other requires it | Choosing repeat or colposcopy without cytology | Hold at cytology step |
| Immune deficiency unknown | Defaulting to 5-year recall or non-colposcopy branch | Clinician review required |
| Prior high-grade/Test of Cure status unknown | Entering Figure 1 or ceasing surveillance | Safety stop |
| Outstanding colposcopy completion unknown | Assuming resolved transition in Figure 2 | Safety stop |
| Hysterectomy type unknown | Applying Figure 8/Table 1 | Safety stop |
| Histology specimen result unknown after hysterectomy | Using no-further-screening branch | Safety stop |
| Excision completeness unknown | Choosing Test of Cure rather than colposcopy | Safety stop |
| Pregnancy status unknown | Using non-pregnancy pathway for high-grade cytology | Safety stop |
| Visible lesion / colposcopic impression unknown | Auto-applying Figure 5, 7, or 9 results | Clinician-only |
| Biopsy result pending | Closing glandular or pregnancy invasion branch | Safety stop |
| Bleeding symptom type unclear | Treating as routine screening issue | Clinician review required |
| Abnormal cervix not examined | Closing symptomatic branch based on history alone | Clinician review required |
| Invalid HPV / unsuitable for analysis / unsatisfactory cytology | Returning to routine recall | Route to repeat-testing recommendations in Section 3 |

**17. Clinician-review and MDT-required matrix**

| Trigger | Review level required | Why |
|---|---|---|
| MDM case review in Figure 5 | MDM / specialist colposcopy | Cytology downgrading/upgrading changes treatment |
| Glandular abnormalities in Figure 7 | Specialist; often MDM | High risk of glandular neoplasia/cancer |
| Pregnancy high-grade pathway in Figure 9 | Experienced pregnancy colposcopist; MDT if invasion suspected | Pregnancy alters biopsy/treatment thresholds |
| Any branch with suspected invasion or cancer | Specialist; oncology / MDT as appropriate | Cancer-delay risk |
| Hysterectomy rows with HSIL/AIS and unclear completeness | Specialist review | Surveillance intensity depends on pathology/margins |
| Atypical endometrial cells not meeting release criteria | Specialist gynaecology | Endometrial lesions are outside Test-of-Cure logic |
| Persistent abnormal Test of Cure results | Specialist colposcopy | Recurrence risk |
| Internal figure/PDF reference ambiguities | Clinician governance review | Prevents implementation of the wrong figure or timing |

**18. Automation suitability matrix**

| Category | Suitable rule sets | Conditions |
|---|---|---|
| Safe deterministic provisional recommendation | Most of Figure 1; much of Figure 3; low-risk surveillance branches of Figure 4; clear Table 1 rows like no further screening or HPV at 6 months | Only when all required structured inputs are complete |
| Provisional recommendation with mandatory clinician sign-off | Figure 2 transition-high-risk branches; Figure 6 surveillance escalation branches; many Figure 8 and Table 1 Test-of-Cure rows; Figure 10 non-cancer symptomatic branches | System may suggest next step but must not close loop autonomously |
| Clinician-only | Figure 5; most of Figure 7; most of Figure 9; any cancer suspicion branch; any visible-lesion/biopsy/MDM/MDT branch | Autonomous recommendation unsafe |
| Hard safety-stop | Invalid HPV, unsuitable for analysis, unsatisfactory cytology, missing critical pathology, uncertain pregnancy status, unresolved colposcopy completion, unknown hysterectomy type | No recommendation beyond “clinician review required” |

## Test catalogue and verification checklist

**19. Golden test-case catalogue for each figure/table**

| Item | Case ID | Scenario | Expected result |
|---|---|---|---|
| Figure 1 | G1-A | Never screened participant entering HPV programme | Invite now, then HPV screening at next scheduled visit |
| Figure 1 | G1-B | Prior HSIL, documented successful Test of Cure, routinely screened | Invite at next scheduled visit, then Figure 3 |
| Figure 2 | G2-A | Prior HSIL, last cytology recommended colposcopy, colposcopy not yet done | Refer to colposcopy before any routine HPV recall |
| Figure 2 | G2-B | Prior atypical endometrial cells 18 months ago, never discharged by specialist | Refer to specialist gynaecology |
| Figure 3 | G3-A | Primary screen: HPV not detected, immune competent | Return in 5 years |
| Figure 3 | G3-B | Primary screen: HPV detected Other on swab, cytology LSIL, age 32 | Repeat HPV in 12 months, recommend LBC |
| Figure 3 | G3-C | 12-month repeat: HPV detected Other, cytology LSIL, age 52 | Colposcopy |
| Figure 3 | G3-D | 24-month repeat: HPV detected Other, negative cytology | Colposcopy after cytology is captured |
| Figure 4 | G4-A | Normal colposcopy, 12 months later HPV not detected | Return to regular interval screening |
| Figure 4 | G4-B | Normal colposcopy, 12 months later HPV detected Other, cytology LSIL, immune deficient | Colposcopy |
| Figure 5 | G5-A | Normal colposcopy after referral ASC-H, MDM downgrades to LSIL | Follow LSIL pathway |
| Figure 5 | G5-B | Confirmed ASC-H, treatment deferred, follow-up shows HPV not detected and no visible lesion | Test of Cure |
| Figure 6 | G6-A | 6-month co-test HPV not detected / cytology negative; 18-month same | Return to regular screening |
| Figure 6 | G6-B | 6-month co-test HPV not detected / cytology low grade; 18-month HPV not detected / cytology low grade | Colposcopy after consecutive low-grade abnormal cytology |
| Figure 6 | G6-C | Any Test of Cure point with ASC-H cytology | Colposcopy regardless of HPV status |
| Figure 7 | G7-A | AG2 cytology | Refer to gynaecology |
| Figure 7 | G7-B | AIS, visible lesion, biopsy confirms AIS | Type 3 excision |
| Figure 7 | G7-C | Visible lesion, biopsy consistent with cancer | Refer to gynaecological oncologist |
| Figure 8 | G8-A | Total hysterectomy, prior normal screening, benign disease, no cervical pathology | No further screening required |
| Figure 8 | G8-B | Total hysterectomy, prior unresolved high-grade history, specimen low grade only | Test of Cure |
| Table 1 | T1-A | No known screening history, benign disease, no cervical pathology/low grade | HPV at 6 months post hysterectomy |
| Table 1 | T1-B | Prior completed Test of Cure, benign disease, unexpected HSIL completely excised in specimen | Test of Cure |
| Figure 9 | G9-A | Pregnant, HSIL cytology, normal TZ, MDM confirms high grade | Colposcopy review in 6 months or at 6-12 weeks postpartum |
| Figure 9 | G9-B | Pregnant, atypical glandular cells, abnormal TZ suspicious for invasion, biopsy positive | Refer to gynaecological oncologist |
| Figure 10 | G10-A | Premenopausal postcoital bleeding, normal cervix, STI identified, bleeding resolves after treatment | Continue regular screening if ≥25 or commence at 25 |
| Figure 10 | G10-B | Intermenstrual bleeding persistent despite negative co-test | Refer to gynaecology |
| Figure 10 | G10-C | Abnormal cervix with suspicion of cancer | Co-test and colposcopy; urgent assessment |

**20. Final Codex verification checklist**

Before any codification or structured implementation of these rules, verify each of the following against the source figures and official updates:

1. Confirm that **transition figures** are only invoked for **first-time entry** into HPV primary screening, never for participants already in the HPV pathway. citeturn15view0  
2. Confirm that **HPV detected 16 or 18** always remains a **direct colposcopy trigger** in routine and post-colposcopy pathways. citeturn12view0turn13view1  
3. Confirm the **age 50** threshold is implemented exactly for persistent **HPV detected Other + negative / ASC-US / LSIL** in Figure 3. citeturn12view0  
4. Confirm **immune deficiency** shortens routine recall and strengthens colposcopy escalation where specified. citeturn12view0turn7view3  
5. Confirm that **invalid HPV**, **unsuitable for analysis**, and **unsatisfactory cytology** invoke repeat-sample safety stops rather than routine recall. citeturn12view0  
6. Confirm that Figure 4 is implemented in the **type 3 TZ** context despite the figure title itself not saying so. citeturn13view0turn13view1  
7. Confirm that Figure 5 remains **clinician-only** because it depends on **MDM case review** and discretionary treatment deferral. citeturn14view0  
8. Confirm that **two consecutive negative co-tests 12 months apart** are required to complete Test of Cure in Figure 6. citeturn9view2turn16view0  
9. Apply the **February 2026 addendum** to Figure 6 entry conditions for **under-50 positive margins after HSIL treatment**. citeturn5view0  
10. Keep all **glandular abnormality** pathways out of autonomous automation except for provisional routing to specialist review. citeturn17view0  
11. Treat **Figure 8 + Table 1** as applying only to **total hysterectomy**; subtotal hysterectomy continues ordinary cervical screening rules. citeturn10view0  
12. For post-hysterectomy cases, never cease follow-up unless prior history, specimen pathology, and completeness are known and match a cessation row. citeturn10view0turn7view10  
13. Apply the **2026 AIS follow-up update** for **clear-margin HPV detected AIS** by using primary/community care co-tests at **6 and 18 months**. citeturn5view0  
14. Exclude most **cervical/vaginal cancer survivor** follow-up from Figure 8/Table 1 and route to specialist follow-up per updated official guidance. citeturn5view0  
15. Keep the **pregnancy high-grade pathway** fully clinician-led, with urgent oncology referral for suspected or confirmed invasion. citeturn11view0  
16. Treat **abnormal vaginal bleeding** as a **symptom pathway**, not a routine-screening branch. citeturn8view0  
17. For bleeding pathways, do not delay urgent referral because blood is present or because co-test results are pending. citeturn8view0  
18. Flag and document the June 2023 PDF’s internal cross-reference inconsistencies: Section 10 says Figure 9 but uses Figure 8, and Section 15 says Figure 11 but uses Figure 10. citeturn10view0turn8view0  
19. Treat any branch involving **visible lesion**, **biopsy**, **histology review**, **MDM/MDT**, or **cancer suspicion** as **clinician review required**. citeturn17view0turn11view0  
20. Store outputs as **provisional recommendation** unless the branch is explicitly classified above as safe deterministic routing. This preserves a safety boundary around cancer-sensitive decisions. citeturn5view0turn19view0