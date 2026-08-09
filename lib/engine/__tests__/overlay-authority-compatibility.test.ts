/**
 * The guideline overlay must never be silently dropped by an authority change.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertOverlayCompatibleWithAuthority,
  findInapplicableOverlayEntries,
  type GuidelineOverlay,
} from "../overlay";

const overlay: GuidelineOverlay = {
  enabled: true,
  entries: {
    "F3-HPV-NOT-DETECTED-5Y": { requireReview: true },
    "F3-1618-COLP": { extraWarnings: ["Local escalation policy applies."] },
    "F6-FIRST-NEGATIVE-REPEAT-12M": { disabled: true, requireReview: true },
  },
};

test("under legacy authority every entry still applies", () => {
  assert.deepEqual(findInapplicableOverlayEntries({ overlay, authorityEngine: "LEGACY" }), []);
  assert.doesNotThrow(() =>
    assertOverlayCompatibleWithAuthority({ overlay, authorityEngine: "LEGACY" })
  );
});

test("under canonical authority legacy-keyed entries are reported, not dropped", () => {
  const inapplicable = findInapplicableOverlayEntries({ overlay, authorityEngine: "CANONICAL" });
  assert.deepEqual(inapplicable, ["F3-HPV-NOT-DETECTED-5Y", "F3-1618-COLP"]);
  assert.equal(
    inapplicable.includes("F6-FIRST-NEGATIVE-REPEAT-12M"),
    false,
    "an already-disabled entry is not a silent loss"
  );
});

test("canonical authority refuses to proceed with an enabled legacy-keyed overlay", () => {
  assert.throws(
    () => assertOverlayCompatibleWithAuthority({ overlay, authorityEngine: "CANONICAL" }),
    /cannot apply under canonical clinical authority/
  );
  assert.throws(
    () => assertOverlayCompatibleWithAuthority({ overlay, authorityEngine: "CANONICAL" }),
    /09-guideline-overlay-transition/
  );
});

test("an explicitly disabled overlay is compatible with canonical authority", () => {
  const disabled: GuidelineOverlay = { ...overlay, enabled: false };
  assert.deepEqual(findInapplicableOverlayEntries({ overlay: disabled, authorityEngine: "CANONICAL" }), []);
  assert.doesNotThrow(() =>
    assertOverlayCompatibleWithAuthority({ overlay: disabled, authorityEngine: "CANONICAL" })
  );
});

test("no overlay at all is compatible with either authority", () => {
  for (const authorityEngine of ["LEGACY", "CANONICAL"] as const) {
    assert.deepEqual(findInapplicableOverlayEntries({ overlay: undefined, authorityEngine }), []);
    assert.doesNotThrow(() =>
      assertOverlayCompatibleWithAuthority({ overlay: undefined, authorityEngine })
    );
  }
});
