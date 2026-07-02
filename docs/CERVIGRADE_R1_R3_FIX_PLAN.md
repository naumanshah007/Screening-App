# CerviGrade — R1 (age-gate ordering) & R3 (pregnancy hard-stop) + wizard age capture — Implementation Plan

**Status:** PLAN ONLY — **no product code was changed in this pass.** This document is the deliverable (per instruction "markdown plan only, no code"). It specifies the exact edits, before/after router precedence, wizard change, and tests to implement when the code pass is authorised.
**Scope guardrails honoured:** no DES work; no invalid/unsuitable/unsatisfactory sample work; no two-engine reconciliation; no removal of specialist mandatory-review posture; no ethnicity-based decisioning; no unrelated UI/schema/batch/marketing refactor.
**Source files in scope:** `lib/engine/decision-engine.ts`, `lib/wizard/steps.ts`, `lib/engine/__tests__/*`.
**Baseline verified this session:** 104 engine tests + 181 batch tests green; typecheck clean; `prisma migrate status` up to date; 5 pre-existing lint errors in `components/batch/*` and `components/marketing/*` (unrelated — leave alone).

---

## 1. Root cause (verified in code)

`evaluateClinicalDecision` (`lib/engine/decision-engine.ts:1637–1728`) evaluates the **age gates at lines 1653–1687 BEFORE** the current-result specialist/high-risk routing that follows it (Figure 2 `:1689`, Figure 1 `:1693`, first-time transition `:1697`, Test of Cure/Figure 6 `:1711`, glandular cytology → Figure 7 `:1715`, Figure 5 `:1719`, Figure 4 `:1723`, Figure 3 default `:1727`).

Each age gate returns a **`riskLevel: "LOW"`** decision with **no `safetyOutcome`, no `referral`, no `clinicianReview`**, and reassuring wording:

- `AGE-UNDER-25` (`:1654–1663`): `"Patient is under 25 years old. Routine cervical screening does not apply."`
- `AGE-75-DISCHARGE` (`:1665–1675`): `"Discharge from routine cervical screening programme."`
- `AGE-70-74-DEFERRED` (`:1676–1686`): `"…offer final HPV screen if not recently tested."` — **ignores `hpvResult` entirely.**

Because these fire first, the following unsafe outputs are reachable (mainly via the **batch** surface and `/api/rules/evaluate`, which set `patientAge`; the wizard currently sets no age so it never reaches the gate — that is R3-adjacent gap fixed in §4):

| Case | Current (unsafe) | Required |
|---|---|---|
| 23yo, HSIL cytology, HPV Other, no bleeding | intercepted by `AGE-UNDER-25` → LOW reassurance | colposcopy / clinician review |
| 23yo, AG3 glandular cytology | `AGE-UNDER-25` → LOW reassurance | Figure 7 / specialist review |
| 72yo, HPV 16/18 | `AGE-70-74-DEFERRED` → "offer final HPV screen" | colposcopy / clinician review |
| 72yo, HPV Other | `AGE-70-74-DEFERRED` | colposcopy / clinician review (exit-testing HPV-detected) |
| 76yo, AG1 glandular | `AGE-75-DISCHARGE` → discharge | Figure 7 / specialist review |
| pregnant, HPV Other, LSIL | falls through to routine Figure 3/4, no review flag | provisional pathway + mandatory clinician review |

---

## 2. Design decision (recommended: guarded age gates, not full reorder)

Two options were considered:

- **(A) Full reorder** — move Figure 2 / Figure 6 / Figure 7 / glandular routing above the age gates.
- **(B) Guarded age gates (RECOMMENDED)** — keep the block position but (i) add fall-through guards so high-grade/glandular/cancer-suspicion cases skip reassurance and reach the existing downstream routing, and (ii) branch the 70–74 gate on `hpvResult`.

**(B) is recommended** because it is the smallest change that satisfies every required behaviour, keeps the existing (well-tested) downstream routing authoritative for abnormal results, and avoids destabilising the 104 green tests. The guideline intent ("urgent/specialist before age discharge") is met: an abnormal current result now *bypasses* the age gate and lands in its correct figure. Option (A) is documented as the fallback if reviewers prefer explicit precedence.

---

## 3. Router edit — `lib/engine/decision-engine.ts`

### 3a. New shared predicate (add near the other helpers, ~`:83–93`)

```ts
// Possible/definite high-grade OR any glandular category — used to prevent age-gate reassurance.
function isHighGradeOrGlandularCytology(cytologyResult?: string): boolean {
  return isHighGradeCytology(cytologyResult); // already includes ASC_H, HSIL, SCC, AIS, AG1–5, AC1–4
}
// (isHighGradeCytology at :83 already covers ASC-H/HSIL/SCC/AIS + GLANDULAR_CODES, i.e. adenocarcinoma AC1–4.)
```

> Note: `isHighGradeCytology` (`:83`) already returns true for `ASC_H, HSIL, SCC, AIS, AG1..AG5, AC1..AC4`. Reuse it directly; the wrapper is optional and only for readability.

### 3b. Under-25 gate (`:1654–1663`) — add fall-through guard

**Before** (reassures unconditionally):
```ts
if (input.patientAge < 25) {
  return withDefaults({ figure: "FIGURE_3", riskLevel: "LOW",
    recommendation: "Patient is under 25 years old. Routine cervical screening does not apply.",
    recommendationCode: "AGE-UNDER-25", ... });
}
```

**After** (only reassure when there is no abnormal current result / suspicion; otherwise fall through to normal routing below):
```ts
if (input.patientAge < 25) {
  const under25HasRedFlags =
    isHighGradeCytology(input.cytologyResult) ||   // ASC-H/HSIL/SCC/AIS/AG1-5/AC1-4
    input.hasCancerSymptoms === true ||
    input.suspicionOfCancer === true;
  if (!under25HasRedFlags) {
    return withDefaults({
      figure: "FIGURE_3", riskLevel: "LOW",
      recommendation: "Participant is under 25 years old with no symptoms or high-grade result. Routine cervical screening does not apply.",
      recommendationCode: "AGE-UNDER-25",
      nextAction: "Do not perform routine screening; investigate any symptoms through the appropriate symptomatic pathway.",
      guidelineReference: "Age eligibility — under 25 asymptomatic",
      rationale: "Age gate applies to routine asymptomatic screening only; symptomatic/high-grade/glandular results are routed to their pathway before this gate.",
      branchPath: ["AGE_UNDER_25", "ASYMPTOMATIC", "NO_ROUTINE_SCREENING"],
    });
  }
  // Red flags present → do NOT reassure. Fall through so glandular→Figure 7,
  // high-grade+HPV→Figure 3 colposcopy branch, etc. handle it below.
}
```

Downstream effect for under-25 red-flag cases:
- Glandular cytology (AG1–5/AC1–4) → reaches `isGlandularCytology` router branch (`:1715`) → **Figure 7** (specialist review). ✔
- HSIL/ASC-H/SCC/AIS + `hpvResult` present → **Figure 3** high-grade branch → colposcopy (`:408–457`). ✔
- HSIL cytology but `hpvResult` missing → **Figure 3** returns `F3-HPV-REQUIRED` insufficient (`:343`) — *needs information*, not reassurance. ✔ (acceptable; do not silently reassure).

### 3c. 75+ gate (`:1665–1675`) — add fall-through guard

Mirror the under-25 guard: discharge only when asymptomatic **and** no abnormal current result; otherwise fall through.
```ts
if (input.patientAge >= 75) {
  const over75HasRedFlags =
    isHighGradeCytology(input.cytologyResult) ||
    input.hpvResult === "HPV_16_18" ||
    input.hasCancerSymptoms === true ||
    input.suspicionOfCancer === true;
  if (!over75HasRedFlags) {
    return withDefaults({ figure: "FIGURE_3", riskLevel: "LOW",
      recommendation: "Participant is 75 or older with no symptoms or abnormal current result. Discharge from routine cervical screening programme.",
      recommendationCode: "AGE-75-DISCHARGE",
      nextAction: "Discharge from routine cervical screening; investigate any symptoms clinically.",
      guidelineReference: "Age eligibility — 75+ asymptomatic",
      rationale: "Routine screening exit applies only after symptom/high-grade/glandular routing.",
      branchPath: ["AGE_75_PLUS", "ASYMPTOMATIC", "DISCHARGE"] });
  }
  // Red flags present → fall through (glandular→Fig7, HPV16/18/high-grade→Fig3 colposcopy).
}
```

### 3d. 70–74 gate (`:1676–1686`) — branch on `hpvResult` (the core R1 fix)

**Replace** the single deferred-exit return with three explicit branches:
```ts
if (input.patientAge >= 70) { // 70–74 (75+ handled above)
  // Specialist/high-grade current results still take precedence — fall through.
  if (isHighGradeCytology(input.cytologyResult) || input.suspicionOfCancer === true) {
    // fall through to Figure 7 / Figure 3 colposcopy routing below
  } else if (input.hpvResult === undefined) {
    return insufficient("FIGURE_3", "AGE-70-74-HPV-REQUIRED", ["hpvResult"],
      "Enter exit HPV result for the 70–74 exit-testing decision");
  } else if (input.hpvResult === "NOT_DETECTED") {
    return withDefaults({ figure: "FIGURE_3", riskLevel: "LOW",
      recommendation: "Participant aged 70–74 with HPV not detected on exit testing. Discharge from routine cervical screening at exit.",
      recommendationCode: "AGE-70-74-HPV-NOT-DETECTED-DISCHARGE",
      nextAction: "Discharge from routine screening after documented exit HPV not detected.",
      guidelineReference: "Age eligibility — 70–74 exit testing, HPV not detected",
      rationale: "70–74 exit testing: HPV not detected supports discharge from the programme.",
      branchPath: ["AGE_70_74", "HPV_NOT_DETECTED", "DISCHARGE"] });
  } else { // HPV_16_18 or HPV_OTHER — HPV detected any type
    return withDefaults({ figure: "FIGURE_3", riskLevel: "HIGH",
      recommendation: "Participant aged 70–74 with HPV detected on exit testing. Refer to colposcopy; clinician review required.",
      recommendationCode: "AGE-70-74-HPV-DETECTED-COLP",
      nextAction: "Refer to colposcopy.",
      referralRequired: true, referralType: "COLPOSCOPY",
      referralPriority: input.hpvResult === "HPV_16_18" ? "P1" : "P2",
      referralReason: "HPV detected any type on 70–74 exit testing",
      safetyOutcome: "CLINICIAN_REVIEW_REQUIRED",
      validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",
      guidelineReference: "Age eligibility — 70–74 exit testing, HPV detected any type",
      rationale: "70–74 exit testing: HPV detected any type is routed to colposcopy, not routine reassurance.",
      branchPath: ["AGE_70_74", "HPV_DETECTED_ANY_TYPE", "COLPOSCOPY"] });
  }
}
```
(For the `INADEQUATE` HPV value this reaches the `else` branch; acceptable as a conservative colposcopy/clinician-review route in this pass. Precise invalid/unsuitable handling is explicitly out of scope.)

### 3e. Pregnancy mandatory-review overlay (R3)

Figure 9 gating (`:1642`) is correct for qualifying cytology and must stay. The gap is the *non-qualifying* pregnant case. Add a **post-computation overlay** at the very end of `evaluateClinicalDecision`, wrapping the default/downstream result so we do not duplicate routing logic:

```ts
// ... existing routing produces `decision` (refactor the trailing returns to assign a
//     `decision` variable instead of returning directly), then:
if (input.isPregnant && decision.figure !== "FIGURE_9") {
  return withDefaults({
    ...decision,
    riskLevel: decision.riskLevel === "URGENT" ? "URGENT" : "HIGH",
    safetyOutcome: "CLINICIAN_REVIEW_REQUIRED",
    validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",
    clinicalWarnings: [
      ...(decision.clinicalWarnings ?? []),
      "Participant is pregnant — pregnancy requires clinician review before this provisional pathway is actioned.",
    ],
    rationale: `${decision.rationale ?? ""} Pregnancy requires clinician confirmation; routine management must not proceed without pregnancy review.`.trim(),
    branchPath: [...(decision.branchPath ?? [decision.figure]), "PREGNANCY_REVIEW_OVERLAY"],
  });
}
return decision;
```

Implementation note: the trailing chain (`:1689–1727`) currently `return`s directly. Minimal refactor = compute into `const decision = (() => { ... })();` or convert the tail to assignments. Keep the Figure 9 early-return at `:1642` untouched so qualifying-cytology pregnancy keeps its dedicated pathway. The overlay preserves the provisional pathway (so the UI can still show it) while forcing `CLINICIAN_REVIEW_REQUIRED`.

**Net router precedence — before → after**

| Step | Before | After |
|---|---|---|
| 1 | Abnormal bleeding / cancer symptoms → Fig 10 | *unchanged* |
| 2 | Pregnant **+ qualifying cytology** → Fig 9 | *unchanged* |
| 3 | Table 1 / hysterectomy | *unchanged* |
| 4 | **Age gates (unconditional reassurance)** | **Age gates GUARDED** — reassure only if no high-grade/glandular/HPV-detected/suspicion; 70–74 branches on HPV result; else fall through |
| 5 | Fig 2 / Fig 1 / transition / ToC / Fig 7 / Fig 5 / Fig 4 / Fig 3 | *unchanged, now reachable for age-boundary red-flag cases* |
| 6 | (none) | **Pregnancy overlay**: any non-Fig-9 result for a pregnant participant is wrapped with `CLINICIAN_REVIEW_REQUIRED` |

---

## 4. Wizard age capture — `lib/wizard/steps.ts`

Currently the `answers → ClinicalInput` builder (`:1043–1150`) sets **no `patientAge`**, so the wizard never reaches the age gates. Add capture:

1. **New step** (place early, after `patient_context`/`consent_confirmed`, before pathway-specific branches). Prefer a numeric **age in years** field (the wizard is a string-answer `option-cards`/`boolean-cards` model; adding a numeric free-entry step is the smallest change — if the product later adds DOB entry, derive age from `dateOfBirth` on `Patient` which already exists at `schema.prisma:416`).
   ```ts
   {
     id: "patient_age",
     question: "What is the participant's age in years?",
     hint: "Age determines screening eligibility (25–69 routine; 70–74 exit testing; under 25 / 75+ special handling).",
     type: "option-cards" /* or a numeric input type if one is added */,
     isVisible: (ans) => consentConfirmed(ans),
   }
   ```
   If a numeric input widget does not exist, add a minimal numeric step type OR reuse the patient record's DOB (recommended: source age from the already-loaded patient DOB in the pathway page rather than asking the nurse to re-enter — verify `app/(app)/pathway/[sessionId]/page.tsx` has the patient DOB in scope).
2. **Mapping** — in the return object (`:1043`) add:
   ```ts
   patientAge: (() => {
     const raw = answers.patient_age ?? "";
     const n = Number(raw);
     return raw !== "" && Number.isFinite(n) && n >= 0 && n <= 120 ? n : undefined;
   })(),
   ```
   - numeric, rejects impossible ages (`>120`/negative/non-numeric → `undefined`).
   - **no silent default** — leaving `patientAge` `undefined` means the age gates simply do not fire (existing behaviour) and, where age is required (70–74 exit), the engine returns the `AGE-70-74-HPV-REQUIRED` missing-data stop from §3d.
3. Surface a **missing-age warning** in the pathway result UI when a decision's `missingInformation` includes an age field (the result page already renders `missingInformation`).

Update `lib/engine/__tests__/wizard-flow.test.ts` / `wizard-integration.test.ts` only if adding the step shifts step indices or the completion mapping snapshot.

---

## 5. Tests to add

### 5a. `lib/engine/__tests__/age-eligibility.test.ts` (new)

Use `baseInput` from `./helpers` (defaults `patientAge: 35`, all flags false). Suggested assertions (codes match §3):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision } from "../decision-engine";
import { baseInput } from "./helpers";

test("under 25 + HSIL + HPV Other → colposcopy, not reassurance", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 23, cytologyResult: "HSIL", hpvResult: "HPV_OTHER" }));
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
  assert.notEqual(d.riskLevel, "LOW");
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.recallIntervalMonths, undefined); // no routine recall
});

test("under 25 + glandular AG3 → Figure 7 specialist review", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 23, cytologyResult: "AG3", isFirstTimeHPVTransition: true, screeningStatus: "REGULAR_SCREENING" }));
  assert.equal(d.figure, "FIGURE_7");
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
});

test("under 25 asymptomatic + no abnormal result → routine does not apply (safe)", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 24 }));
  assert.equal(d.recommendationCode, "AGE-UNDER-25");
  assert.equal(d.riskLevel, "LOW");
  assert.notEqual(d.referralType, "COLPOSCOPY");
});

test("25 + HPV not detected → routine, 5-year recall", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" }));
  assert.equal(d.figure, "FIGURE_3");
  assert.equal(d.recallIntervalMonths, 60);
});

test("70 + HPV not detected → discharge", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 70, hpvResult: "NOT_DETECTED" }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-NOT-DETECTED-DISCHARGE");
});

test("72 + HPV 16/18 → colposcopy, not final-screen reassurance", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72, hpvResult: "HPV_16_18" }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-DETECTED-COLP");
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});

test("72 + HPV Other → colposcopy / clinician review", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72, hpvResult: "HPV_OTHER" }));
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.recallIntervalMonths, undefined);
});

test("72 + no HPV result → needs information, not reassurance", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72 }));
  assert.equal(d.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("75 asymptomatic + no abnormal result → discharge", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 75 }));
  assert.equal(d.recommendationCode, "AGE-75-DISCHARGE");
});

test("76 + glandular AG1 → NOT discharge, specialist pathway", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 76, cytologyResult: "AG1", isFirstTimeHPVTransition: true, screeningStatus: "REGULAR_SCREENING" }));
  assert.notEqual(d.recommendationCode, "AGE-75-DISCHARGE");
  assert.equal(d.figure, "FIGURE_7");
});
```

### 5b. `lib/engine/__tests__/pregnancy-hardstop.test.ts` (new)

```ts
test("pregnant + HSIL → Figure 9, clinician review", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 30, isPregnant: true, cytologyResult: "HSIL" }));
  assert.equal(d.figure, "FIGURE_9");
});

test("pregnant + HPV Other + LSIL → clinician review overlay, not routine-only", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 30, isPregnant: true, hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }));
  assert.equal(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
  assert.ok((d.branchPath ?? []).includes("PREGNANCY_REVIEW_OVERLAY"));
});

test("pregnant + HPV not detected → no urgent colposcopy but pregnancy review surfaced", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 30, isPregnant: true, hpvResult: "NOT_DETECTED" }));
  assert.notEqual(d.referralType, "COLPOSCOPY");
  assert.equal(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});

test("non-pregnant equivalent → ordinary Figure 3 unchanged", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 30, hpvResult: "NOT_DETECTED" }));
  assert.equal(d.figure, "FIGURE_3");
  assert.equal(d.recallIntervalMonths, 60);
  assert.notEqual(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});
```

### 5c. Existing tests to re-check
- `routing-precedence.test.ts` — the 4 existing tests should still pass (none use age 70–74/75/under-25-asymptomatic-with-red-flags). Confirm and extend if desired.
- `figure3.test.ts` — verify no test relies on age-70–74/75 short-circuit wording (none observed; the figure tests default `patientAge: 35`).
- `wizard-integration.test.ts` — update only if the new age step changes indices/snapshots.

---

## 6. Verification commands to run after implementing

```bash
npm test                                          # engine suite (currently 104) — expect all pass + new tests
npx tsx --test "lib/batch/__tests__/*.test.ts"    # batch suite (181) — must remain green (batch sets patientAge)
npx tsc --noEmit                                  # must stay clean
npm run lint                                       # do NOT fix the 5 pre-existing errors unless your change causes them
```

**Watch item for the batch suite:** `lib/batch/processor.ts:36` passes `patientAge` straight through, and `lib/batch/demo-dataset*.ts` / processor tests may include 70–74 or 75+ rows. After the 70–74 branching change, any such fixture's expected `recommendationCode` may shift from the old deferred-exit code to `AGE-70-74-HPV-*`. Update those fixtures' expectations (not the engine) if they fail.

---

## 7. Section-E deliverable framing (fill in after the code pass)

1. **Files changed:** `lib/engine/decision-engine.ts` (age-gate guards + 70–74 HPV branching + pregnancy overlay + optional helper), `lib/wizard/steps.ts` (age step + mapping), new `lib/engine/__tests__/age-eligibility.test.ts`, new `lib/engine/__tests__/pregnancy-hardstop.test.ts`, plus any fixture expectation updates in `lib/batch/__tests__/*` / wizard tests.
2. **Router precedence before/after:** see §3 table.
3. **New tests:** §5a (10 cases) + §5b (4 cases).
4. **Test results:** paste `npm test`, batch, `tsc`, `lint` output.
5. **Remaining clinical-safety limitations (still open after this pass, by design):** DES exposure (R2), invalid/unsuitable/unsatisfactory sample handling (R4), two-engine reconciliation — grade page still uses booking engine (R5), terminology "patient"→"participant" beyond the strings touched here, and the practice point for postmenopausal >70 vaginal oestrogen before colposcopy.
6. **Audit-finding status after this pass:**
   - **R1 (age-gate ordering): FULLY FIXED** for the enumerated cases (under-25 red-flag, 70–74 HPV-detected, 75+ glandular) *provided* the batch/wizard supply `patientAge`; when age is absent the engine now returns a needs-information stop for the 70–74 exit case instead of reassurance.
   - **R3 (pregnancy hard-stop): FULLY FIXED** at engine level — every non-Figure-9 pregnant result now carries `CLINICIAN_REVIEW_REQUIRED`. **Wizard age capture (audit finding on the primary surface): FIXED** for age eligibility; DOB-vs-age entry choice noted in §4.

---

## 8. Risk / blast-radius notes for the implementer

- **Keep the Figure 9 early-return (`:1642`) intact** — the pregnancy overlay must only wrap *non-Figure-9* results, or qualifying-cytology pregnancies get double-handled.
- **Do not lower any existing `URGENT` result** in the pregnancy overlay (the snippet preserves `URGENT`).
- **Fall-through, not re-route:** the under-25 / 75+ guards must *fall through* to the existing chain, not call figures directly — this preserves single-source routing and avoids divergence.
- **`isHighGradeCytology` already includes glandular + adenocarcinoma** (`GLANDULAR_CODES` at `:14`), so one predicate covers HSIL/ASC-H/SCC/AIS/AG1–5/AC1–4. Verify AG1/AG3 specifically land in Figure 7 via the `isGlandularCytology` branch (`:1715`) — they do, because glandular routing sits below the age block and is now reachable.
- **Terminology:** the reworded age strings switch "Patient" → "Participant"; this is in-scope only for the strings you touch. A full terminology sweep is a separate pass.
