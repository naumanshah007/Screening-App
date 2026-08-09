# 09 — Guideline Overlay Transition

**Status:** implementation-phase finding. No overlay was configured, enabled, disabled or removed.

---

## 1. Correction to the feasibility report

Finding **OUT-03** in [02-input-output-compatibility.md](02-input-output-compatibility.md) stated that under canonical authority "every configured overlay entry silently stops applying", losing two admin-visible safety behaviours.

**That overstated the current risk.** Tracing the code shows the overlay is **not wired to anything**:

| Question | Finding | Evidence |
|---|---|---|
| Is there persistence for an overlay? | **No.** No `GuidelineOverlay` model, table or column. | `grep -i overlay prisma/schema.prisma` → no matches |
| Does any call site pass an overlay? | **No.** All four production call sites invoke `evaluateClinicalDecision(input)` with a single argument. | `app/api/sessions/route.ts:108`, `app/api/rules/evaluate/route.ts:26`, `app/api/pathway/sessions/[id]/complete/route.ts:129`, `lib/batch/processor.ts:154` |
| Is there an API route to author one? | **No.** | no route references `GuidelineOverlay` |
| Is the catalog consumed by the app? | **No.** `GUIDELINE_RULE_CATALOG` is referenced only by its own test. | `lib/engine/__tests__/overlay.test.ts` |

So there are **zero configured overlay entries in production**, and therefore **zero safety behaviours that canonical authority would drop today**. `applyGuidelineOverlay` is reached on every evaluation with `overlay === undefined` and returns the decision unchanged at its first line.

The overlay is a **designed-but-unwired capability**, shipped with the `fb933c3` production feature set as part of "guideline-figure overlay engine + rule catalog".

## 2. The risk that is real

The hazard is **prospective, not current**. The overlay is keyed on the legacy `recommendationCode`:

```ts
const entry = overlay.entries[decision.recommendationCode];   // lib/engine/overlay.ts:78
```

Under canonical authority the decision is identified by a CG-NCSP-3.1.0 `stableRuleId` (`F3-01`, `F9-14`, …), not by a legacy code (`F3-1618-COLP`, `AGE-75-DISCHARGE`, …). The two vocabularies do not intersect.

If someone wires the overlay up **after** canonical authority is active — an entirely plausible sequence, since the capability exists and looks finished — every entry an administrator configures would simply never match. The administrator would see the entry saved, and it would do nothing. **No error, no warning, no log.** A forced clinician review that an administrator believes is in force would not be in force.

That is a worse failure mode than the one originally described, because it would be introduced by ordinary, well-intentioned admin work long after the cutover, when nobody is looking for it.

## 3. What the clinical function of the overlay is

From `lib/engine/overlay.ts`, an entry may adjust only six things, and only in the safe direction:

| Field | Effect | Direction constraint |
|---|---|---|
| `recallIntervalMonths` | change recall interval | may lengthen — flagged as relaxing by `overlayRelaxesSafety` |
| `referralPriority` | change priority, only when the branch already refers | may lower — flagged as relaxing |
| `requireReview` | force clinician review | **add only**; also raises risk to at least HIGH |
| `recommendation` / `nextAction` | replace wording | presentational |
| `extraWarnings` | append warnings | **add only** |
| `disabled` | ignore the entry | — |

Hard guardrails already present: an overlay can never change `figure`, `referralType`, `recommendationCode`, or lower `riskLevel` (`ALLOWED_FIELDS`, and the risk floor at lines 127–130). Safety-stop codes are deliberately excluded from the admin-visible catalog.

So the overlay's clinical function is: **local operational adjustment of an otherwise national decision — chiefly forcing extra review and adding local warnings.**

## 4. Options assessed

**Option A — canonical output already carries the governed information.**
Partly true and the better long-term answer. `requireReview` is subsumed: every canonical result sets `mandatoryReviewerConfirmation: true`, and GOV-04 currently sets `clinicianOnly` on 152/179 cases. Local *warnings* and local *recall lengthening* are not expressible in a national governed ruleset, and should not be — they are local policy, not national guideline.

**Option B — an explicit audited compatibility adapter mapping canonical rule identities to overlay behaviour.**
Rejected **for now**, deliberately. Building a legacy-code → `stableRuleId` mapping would require asserting that a legacy branch and a canonical rule are clinically the same decision. That is exactly the kind of label-similarity equivalence the alias-registry defect taught us to distrust (`FIGURE_5_COTEST_SURVEILLANCE` vs `TEST_OF_CURE`). With **zero entries configured**, building that mapping would be inventing 40+ clinical equivalences to preserve a capability nobody is using.

**Option C (implemented) — make silence impossible.**

## 5. What was implemented

Two functions in `lib/engine/overlay.ts`, plus tests:

- `findInapplicableOverlayEntries({ overlay, authorityEngine })` — returns the enabled entries that could not apply under the given authority. Under `LEGACY` always empty; under `CANONICAL`, every enabled legacy-keyed entry.
- `assertOverlayCompatibleWithAuthority({ overlay, authorityEngine })` — throws under canonical authority when any enabled entry would be dropped, naming the entries and pointing at this document.

Behaviour today is unchanged: with no overlay configured, both are no-ops. The guard exists so that the day someone wires the overlay up, the mismatch is **loud at the point of use** rather than silent forever.

`lib/engine/__tests__/overlay-authority-compatibility.test.ts` covers: legacy authority applies everything; canonical authority reports legacy-keyed entries; already-disabled entries are not counted as a loss; an explicitly disabled overlay is compatible; no overlay is compatible with either authority.

## 6. Required before canonical activation

1. **Decide explicitly** whether the overlay capability is retained, re-keyed, or removed. Silence is now blocked by the guard, but an unmade decision is still an unmade decision.
2. **If retained under canonical authority**, it must be re-keyed to `stableRuleId` and every mapping must be individually clinically reviewed. Do not map by label similarity.
3. **If not retained**, the Admin surface must say so before it accepts an edit — an admin screen that saves an entry which cannot apply is a defect regardless of authority.
4. **Recommended:** do not retain it as-is. Canonical rules are themselves governed, versioned and checksummed. An ungoverned admin overlay sitting on top of a governed ruleset is a regression in governance, and `requireReview` — its main safety use — is already implied by canonical's mandatory reviewer confirmation.

**Classification:** downgraded from `GOVERNANCE_DECISION_REQUIRED` (blocking) to **`GOVERNANCE_DECISION_REQUIRED` (non-blocking for activation, blocking for wiring the overlay)**. It is no longer a hard activation blocker, because there is nothing configured to lose.
