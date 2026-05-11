# Decision Tree Rule Coverage

| Source | Branch | Expected outcome | Implemented? | Test file | Remaining issue |
| --- | --- | --- | --- | --- | --- |
| Figure 1 | Never screened / under-screened / overdue | Invite now, then Figure 3 at next scheduled HPV screening visit | Yes | `lib/engine/__tests__/figure1.test.ts` | Invitation scheduling remains external |
| Figure 1 | Regular screening / low-grade only / high-grade with successful Test of Cure | Invite at next scheduled visit, then Figure 3 | Yes | `lib/engine/__tests__/figure1.test.ts` | Needs verified history source |
| Figure 1 | Unknown screening history | `EXTERNAL_HISTORY_REQUIRED` | Yes | `lib/engine/__tests__/figure1.test.ts` | NCSR/history integration |
| Figure 2 | Prior possible/definite HSIL or atypical glandular cells with outstanding colposcopy recommendation | Refer to colposcopy | Yes | `lib/engine/__tests__/figure2.test.ts` | Requires last cytology report data |
| Figure 2 | Prior high-grade/glandular without outstanding colposcopy and not returned | Complete Test of Cure | Yes | `lib/engine/__tests__/figure2.test.ts` | Requires Test of Cure state source |
| Figure 2 | Previous AIS, no total hysterectomy | R2.08/service-defined post-treatment follow-up | Partial | `lib/engine/__tests__/figure2.test.ts` | Clinical/service confirmation required |
| Figure 2 | Previous atypical endometrial cells report >3 years ago | Primary HPV screening / Figure 3 | Yes | `lib/engine/__tests__/figure2.test.ts` | AG2 report date source |
| Figure 2 | Previous atypical endometrial cells discharged to primary care | Primary HPV screening / Figure 3 | Yes | `lib/engine/__tests__/figure2.test.ts` | Specialist discharge source |
| Figure 2 | Previous atypical endometrial cells otherwise | Specialist gynaecology | Yes | `lib/engine/__tests__/figure2.test.ts` | Referral policy confirmation |
| Figure 3 | HPV not detected | Return in 5 years, or 3 years if immune deficient | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | HPV 16/18 | Colposcopy; cytology reported if available/LBC | Yes | `lib/engine/__tests__/figure3.test.ts` | Confirm local cytology-pending display policy |
| Figure 3 | HPV Other on SWAB with cytology-dependent branch | Require return visit/clinical examination | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | HPV Other + negative/ASC-US/LSIL at baseline | First repeat HPV in 12 months, recommend LBC | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | First repeat HPV not detected | Return to screening | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | First repeat HPV 16/18 | Colposcopy | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | First repeat HPV Other + high-grade cytology | Colposcopy | Yes | `lib/engine/__tests__/figure3.test.ts` | Endometrial malignant exception may need local pathway detail |
| Figure 3 | First repeat HPV Other + negative/ASC-US/LSIL age >=50 | Colposcopy | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | First repeat HPV Other + negative/ASC-US/LSIL age <50 | Second repeat HPV in 12 months | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | Second repeat HPV not detected | Return to screening | Yes | `lib/engine/__tests__/figure3.test.ts` | None |
| Figure 3 | Second repeat HPV detected any type | Cytology then colposcopy | Yes | `lib/engine/__tests__/figure3.test.ts` | Cytology-pending operational state can be refined |
| Figure 4 | Entry HPV detected + negative/ASC-US/LSIL cytology + normal colposcopy | Repeat HPV in 12 months in community care, LBC | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Repeat HPV not detected | Return to regular interval screening | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Repeat HPV 16/18 | Colposcopy | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Repeat HPV Other + cytology >= ASC-H | Colposcopy | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Repeat HPV Other + negative/ASC-US/LSIL + immune deficient | Colposcopy | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Repeat HPV Other + negative/ASC-US/LSIL + not immune deficient | Second repeat HPV in 12 months | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 4 | Second repeat HPV detected any type | Colposcopy | Yes | `lib/engine/__tests__/figure4.test.ts` | None |
| Figure 5 | MDM downgraded to LSIL | Follow LSIL pathway | Yes | `lib/engine/__tests__/figure5.test.ts` | LSIL pathway detail not expanded beyond source reference |
| Figure 5 | MDM upgraded to HSIL | Follow HSIL pathway; treatment recommended | Yes | `lib/engine/__tests__/figure5.test.ts` | Procedure workflow outside scope |
| Figure 5 | Confirmed ASC-H + abnormal cytology/HPV detected/visible lesion | Treatment recommended; consider type 2 excision TZ | Yes | `lib/engine/__tests__/figure5.test.ts` | Exact procedure wording needs clinical confirmation |
| Figure 5 | Confirmed ASC-H + HPV not detected + no visible lesion | Test of Cure / co-testing | Yes | `lib/engine/__tests__/figure5.test.ts` | None |
| Figure 5 | Confirmed ASC-H + HPV detected + normal colposcopy + negative cytology | Repeat colposcopy, HPV and cytology in 12 months | Yes | `lib/engine/__tests__/figure5.test.ts` | None |
| Figure 6 | First HPV/cytology 6 months post-treatment HPV not detected + cytology negative | Repeat HPV/cytology in 12 months | Yes | `lib/engine/__tests__/figure6.test.ts` | Treatment date source |
| Figure 6 | Second negative co-test | Return to regular screening | Yes | `lib/engine/__tests__/figure6.test.ts` | Prior negative count source |
| Figure 6 | HPV detected any type / any cytology | Colposcopy | Yes | `lib/engine/__tests__/figure6.test.ts` | None |
| Figure 6 | HPV not detected + high-grade cytology | Colposcopy | Yes | `lib/engine/__tests__/figure6.test.ts` | None |
| Figure 6 | HPV not detected + low-grade cytology | Repeat HPV/cytology in 12 months | Yes | `lib/engine/__tests__/figure6.test.ts` | None |
| Figure 7 | AG2 or AC2 | Refer to gynaecology | Yes | `lib/engine/__tests__/figure7.test.ts` | Confirm local AC2 service destination |
| Figure 7 | AG1, AG3-AG5, AC1, AC3, AC4 | Colposcopy | Yes | `lib/engine/__tests__/figure7.test.ts` | Confirm AC3/AC4 local acceptance |
| Figure 7 | Visible lesion, no biopsy result yet | Biopsy required | Yes | `lib/engine/__tests__/figure7.test.ts` | None |
| Figure 7 | Visible lesion biopsy AIS | Type 3 excision | Yes | `lib/engine/__tests__/figure7.test.ts` | Procedure booking outside scope |
| Figure 7 | Visible lesion biopsy consistent with cancer | Refer to gynaecological oncologist | Yes | `lib/engine/__tests__/figure7.test.ts` | Oncology booking outside scope |
| Figure 7 | No visible lesion + cytology confirmed not AG2 | Type 3 excision | Yes | `lib/engine/__tests__/figure7.test.ts` | MDM source capture |
| Figure 7 | No visible lesion + AG2 confirmed | Investigate other gynaecological malignancies | Yes | `lib/engine/__tests__/figure7.test.ts` | Investigation workflow outside scope |
| Figure 7 | No visible lesion + cytology not confirmed | Repeat colposcopy in 6 months | Yes | `lib/engine/__tests__/figure7.test.ts` | None |
| Figure 8 | Negative/low-grade returned to regular + no pathology | No further screening | Yes | `lib/engine/__tests__/figure8.test.ts` | Requires history/specimen source |
| Figure 8 | Unknown history + no/low-grade pathology | HPV at 6 months post hysterectomy | Yes | `lib/engine/__tests__/figure8.test.ts`, `lib/engine/__tests__/table1.test.ts` | Hysterectomy date source |
| Figure 8 | LSIL/CIN1 specimen | HPV test then follow Figure 3 | Yes | `lib/engine/__tests__/figure8.test.ts` | None |
| Figure 8 | HSIL/CIN2/3 or AIS completely excised | Test of Cure | Yes | `lib/engine/__tests__/figure8.test.ts`, `lib/engine/__tests__/table1.test.ts` | ToC service state |
| Figure 8 | HSIL/CIN2/3 or AIS incompletely excised | Colposcopy | Yes | `lib/engine/__tests__/figure8.test.ts`, `lib/engine/__tests__/table1.test.ts` | None |
| Figure 8 | Post-hysterectomy HPV not detected where HPV test indicated | No further screening | Yes | `lib/engine/__tests__/figure8.test.ts` | None |
| Figure 8 | Post-hysterectomy HPV detected any type | Follow primary HPV pathway Figure 3 | Yes | `lib/engine/__tests__/figure8.test.ts` | None |
| Figure 9 | Pregnant + ASC-H/HSIL/glandular/AIS cytology | Initial colposcopy | Yes | `lib/engine/__tests__/figure9.test.ts` | None |
| Figure 9 | Normal TZ/no visible lesion + MDM downgraded negative | Follow Figure 3 | Yes | `lib/engine/__tests__/figure9.test.ts` | None |
| Figure 9 | Normal TZ/no visible lesion + MDM downgraded LSIL/ASC-US | Follow LSIL pathway | Yes | `lib/engine/__tests__/figure9.test.ts` | LSIL detail outside source |
| Figure 9 | Normal TZ/no visible lesion + MDM confirmed high-grade | Colposcopy review in 6 months or 6-12 weeks postpartum | Yes | `lib/engine/__tests__/figure9.test.ts` | Postpartum scheduling confirmation |
| Figure 9 | Abnormal TZ + LSIL/HSIL/CIN2/3/AIS impression | Colposcopy review in 6 months or postpartum | Yes | `lib/engine/__tests__/figure9.test.ts` | None |
| Figure 9 | Invasion impression | Biopsy before oncology | Yes | `lib/engine/__tests__/figure9.test.ts` | None |
| Figure 9 | Biopsy positive for invasion | Refer to gynaecological oncologist | Yes | `lib/engine/__tests__/figure9.test.ts` | None |
| Figure 9 | Biopsy negative for invasion | MDM case review | Yes | `lib/engine/__tests__/figure9.test.ts` | MDM workflow |
| Figure 10 | Cancer signs/symptoms | Urgent gynaecological assessment without delay | Yes | `lib/engine/__tests__/figure10.test.ts`, `lib/engine/__tests__/routing-precedence.test.ts` | None |
| Figure 10 | Initial abnormal bleeding workup incomplete | Capture history, speculum/pelvic exam, co-test, cervix assessment | Yes | `lib/engine/__tests__/figure10.test.ts` | Co-test result capture can be expanded later |
| Figure 10 | Abnormal cervix + suspicion of cancer | Co-test and colposcopy | Yes | `lib/engine/__tests__/figure10.test.ts` | None |
| Figure 10 | Abnormal cervix + no suspicion | Healthcare Pathways / gynaecology; 6-8 week review | Yes | `lib/engine/__tests__/figure10.test.ts` | Local pathway wording/priority |
| Figure 10 | Normal cervix + suspected OCP issue | Adjust OCP; 6-8 week review | Yes | `lib/engine/__tests__/figure10.test.ts` | None |
| Figure 10 | Normal cervix + STI identified | Treat STI; 6-8 week review | Yes | `lib/engine/__tests__/figure10.test.ts` | None |
| Figure 10 | Bleeding resolved at 6-8 weeks | Continue regular screening if age >=25 or commence at 25 | Yes | `lib/engine/__tests__/figure10.test.ts` | None |
| Figure 10 | Bleeding not resolved at 6-8 weeks | Refer to gynaecology | Yes | `lib/engine/__tests__/figure10.test.ts` | None |
| Table 1 | Negative/ASC-US/LSIL returned to regular + no pathology | No further screening | Yes | `lib/engine/__tests__/table1.test.ts` | Requires history/specimen source |
| Table 1 | Negative/returned regular + LSIL/CIN1 | HPV test / follow Figure 3 | Yes | `lib/engine/__tests__/table1.test.ts` | None |
| Table 1 | Negative/returned regular + HSIL/AIS complete | Test of Cure | Yes | `lib/engine/__tests__/table1.test.ts` | None |
| Table 1 | Negative/returned regular + HSIL/AIS incomplete | Colposcopy | Yes | `lib/engine/__tests__/table1.test.ts` | None |
| Table 1 | Previous ASC-US/LSIL not returned + no/low-grade pathology | HPV test / follow Figure 3 | Yes | `lib/engine/__tests__/table1.test.ts` | None |
| Table 1 | Abnormal screening with HSIL/AIS untreated/incomplete or incomplete ToC + no/low-grade pathology | Test of Cure | Yes | `lib/engine/__tests__/table1.test.ts` | ToC status source |
| Table 1 | No known screening history + no/low-grade pathology | HPV at 6 months post hysterectomy | Yes | `lib/engine/__tests__/table1.test.ts` | Hysterectomy date source |
| Routing | Abnormal bleeding with cancer signs vs routine HPV/age gates | Figure 10 takes precedence | Yes | `lib/engine/__tests__/routing-precedence.test.ts` | None |
| Routing | Pregnancy applies only to pregnant + qualifying cytology | Figure 9 only for qualifying context | Yes | `lib/engine/__tests__/routing-precedence.test.ts`, `lib/engine/__tests__/figure9.test.ts` | None |
| Routing | Total hysterectomy | Figure 8/Table 1 before routine screening | Yes | `lib/engine/__tests__/routing-precedence.test.ts` | History/specimen source |
| Routing | Test of Cure | Figure 6 before glandular/general routes when ToC state is explicit | Yes | `lib/engine/__tests__/routing-precedence.test.ts` | None |
