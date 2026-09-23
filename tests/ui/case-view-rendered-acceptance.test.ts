/**
 * Rendered acceptance for the clinician case view.
 *
 * The other UI tests read the component source. That catches a section being
 * deleted; it does not catch a section that renders the wrong thing, or one
 * that renders nothing because the data never arrives. These tests render the
 * component to HTML with real reconstructed cases and assert what a clinician
 * would actually read.
 *
 * Rendering is done with React's server renderer rather than a browser, so this
 * runs in the ordinary test suite. It exercises markup, ordering and content —
 * not layout or colour, which remain manual checks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { BatchResultDetail } from "@/components/batch/BatchResultDetail";
import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";
import { mapCanonicalToClinicalInput } from "@/lib/batch/processor";
import type { BatchCaseResult } from "@/lib/batch/types";
import type { ClinicalDecision } from "@/lib/engine/types";

function caseResult(
  caseId: string,
  decision: Partial<ClinicalDecision> = {},
  overrides: Partial<BatchCaseResult> = {}
): BatchCaseResult {
  const batchCase = CHCH_PUBLIC_DATASET.find(
    (c) => c.source.externalPatientId === caseId
  )!;
  return {
    case: batchCase,
    input: mapCanonicalToClinicalInput(batchCase),
    decision: {
      figure: "FIGURE_3",
      riskLevel: "NOT_ASSESSED",
      recommendation: "Refer to colposcopy.",
      recommendationCode: "F3-03",
      nextAction: "Refer to colposcopy.",
      ...decision,
    },
    processingTimeMs: 1,
    status: "success",
    ...overrides,
  };
}

/**
 * The technical disclosure contains a client component that calls useRouter, so
 * the tree needs an app-router context. A stub is enough: nothing under test
 * navigates.
 */
const routerStub = {
  push: () => {}, replace: () => {}, refresh: () => {},
  back: () => {}, forward: () => {}, prefetch: () => {},
} as unknown as React.ContextType<typeof AppRouterContext>;

function render(result: BatchCaseResult): string {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: routerStub },
      React.createElement(BatchResultDetail, {
        result,
        open: true,
        onClose: () => {},
      })
    )
  );
}

/** Everything before the technical disclosure is the clinician-facing view. */
function primaryView(html: string): string {
  const index = html.indexOf("Technical and audit details");
  return index === -1 ? html : html.slice(0, index);
}

test("the primary view shows the exact source text, not engine values", () => {
  const html = primaryView(render(caseResult("chch-001")));
  assert.ok(html.includes("First HPV screen"), "the source circumstance must be shown");
  assert.ok(html.includes("HPV 16 positive"), "the source HPV text must be shown");
  assert.ok(html.includes("No previous CIN"), "the source history must be shown");
  assert.ok(
    !html.includes("HPV_16_18"),
    "the legacy grouped enum must never appear in the clinician view"
  );
  assert.ok(!html.includes("BASELINE"), "a derived repeat stage is not a source fact");
  assert.ok(!html.includes("LBC"), "an assumed sample type is not a source fact");
});

test("a pending cytology reads as pending, not as an absent result", () => {
  const html = primaryView(render(caseResult("chch-001")));
  assert.ok(html.includes("Pending"), "the cytology state must be named");
  assert.ok(html.includes("Cytology pending"), "and the source text retained");
});

test("a prior-only cytology is labelled as a previous result", () => {
  const html = primaryView(render(caseResult("chch-027")));
  assert.ok(html.includes("Previous result only"));
  assert.ok(html.includes("Negative cytology previously"));
});

test("a case with no current HPV result says so", () => {
  const html = primaryView(render(caseResult("chch-009")));
  assert.ok(html.includes("HPV 16 positive (previous)"));
  assert.ok(html.includes("no current HPV result"));
});

test("the case identifier renders as a Case ID and never as an NHI", () => {
  const html = render(caseResult("chch-001"));
  assert.ok(html.includes("Case chch-001"), "the identifier must be labelled Case");
  assert.ok(!html.includes("NHI chch-001"), "a synthetic ID must never be labelled NHI");
});

test("no risk or priority badge reaches the clinician view", () => {
  const html = primaryView(
    render(caseResult("chch-003", { riskLevel: "URGENT", referralPriority: "P1" }))
  );
  assert.ok(!html.includes("Urgent clinical priority"));
  assert.ok(!html.includes("P1 Urgent"));
  assert.ok(!html.includes("Risk:"));
});

test("technical identifiers stay out of the clinician view", () => {
  const html = primaryView(render(caseResult("chch-001")));
  for (const leak of [
    "business-figures-table1-v1",
    "F3-03",
    "Routing service",
    "Recommendation code",
    "chch-public-v2",
    "Sheet1!",
  ]) {
    assert.ok(!html.includes(leak), `${leak} must not appear in the clinician view`);
  }
});

test("needs-information renders the actionable question, not the fact name", () => {
  const html = primaryView(
    render(
      caseResult("chch-001", {
        safetyOutcome: "INSUFFICIENT_INFORMATION",
        missingInformation: ["sampleType"],
      })
    )
  );
  assert.ok(html.includes("Missing information"));
  assert.ok(
    html.includes("Sample collection method required"),
    "a clinician must be asked a question they can answer"
  );
  assert.ok(!html.includes(">sampleType<"), "the raw fact name belongs in technical details");
});

test("missing information is absent entirely when nothing is missing", () => {
  const html = primaryView(render(caseResult("chch-002")));
  assert.ok(
    !html.includes("Missing information"),
    "an empty section is noise; the section must not render at all"
  );
});

test("an unavailable evaluation shows no recommendation and no action", () => {
  const html = primaryView(
    render(
      caseResult("chch-001", {
        recommendationCode: "EVALUATION-UNAVAILABLE",
        recommendation: "Governed evaluation unavailable — clinician review required.",
        recallIntervalMonths: 12,
      })
    )
  );
  assert.ok(html.includes("Evaluation unavailable"));
  assert.ok(
    !html.includes("Repeat in 12 months"),
    "an unavailable evaluation must not render a recall it never determined"
  );
});

test("no decision path renders without a persisted trace", () => {
  const html = render(caseResult("chch-001"));
  assert.ok(
    !html.includes("View decision path"),
    "a case with no evaluation trace must show no path at all"
  );
});

test("a decision path renders only from the persisted trace", () => {
  const html = render(
    caseResult("chch-001", {}, {
      canonicalShadow: {
        evaluationId: "eval-1",
        evaluationMode: "LIVE_DEMO",
        ruleVersionDisplay: "CG-NCSP-3.1.0",
        rulesetChecksum: "a".repeat(64),
        engineVersion: "canonical-graph-v2",
        provisionalRecommendation: "Refer to colposcopy.",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        matchedRuleIds: ["F3-03"],
        branchPath: ["node:root", "node:section:figure-3", "node:rule:F3-03"],
        missingInformation: [],
        sourceReferences: [],
      },
    })
  );
  assert.ok(html.includes("View decision path"));
  assert.ok(html.includes("Rule F3-03 applied"), "steps come from the recorded branch path");
});

test("the safety notice is present and the drawer has an accessible structure", () => {
  const html = render(caseResult("chch-001"));
  assert.ok(html.includes("Not for direct clinical action"));
  assert.ok(html.includes('role="note"'), "the safety notice must be announced as a note");
  // Section headings, not styled divs, so a screen reader can navigate them.
  assert.match(html, /<h[23][^>]*>/, "sections must use real headings");
});
