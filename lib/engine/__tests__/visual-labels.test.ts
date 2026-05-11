import test from "node:test";
import assert from "node:assert/strict";
import { ALL_FIGURES } from "../../decision-trees";
import { getFigureLabel } from "../../utils";

const expectedTitles: Record<string, string> = {
  FIGURE_1: "HPV Transition Invitation Pathway",
  FIGURE_2: "Previous High-Grade / History Transition Pathway",
  FIGURE_3: "Primary HPV Screening Pathway",
  FIGURE_4: "Post-Normal Colposcopy Follow-up After Low-Grade Cytology",
  FIGURE_5: "Post-Normal Colposcopy Follow-up After High-Grade Cytology",
  FIGURE_6: "Test of Cure After HSIL/CIN2/3 Treatment",
  FIGURE_7: "Atypical and Abnormal Glandular Abnormalities",
  FIGURE_8: "Screening After Total Hysterectomy",
  FIGURE_9: "Pregnancy High-Grade/Glandular Cytology Pathway",
  FIGURE_10: "Abnormal Vaginal Bleeding Pathway",
};

const expectedLabels: Record<string, string> = {
  FIGURE_1: "HPV transition invitation pathway",
  FIGURE_2: "Previous high-grade/history transition pathway",
  FIGURE_3: "Primary HPV Screening",
  FIGURE_4: "Post-normal colposcopy follow-up after low-grade cytology",
  FIGURE_5: "Post-normal colposcopy follow-up after high-grade cytology",
  FIGURE_6: "Test of Cure pathway",
  FIGURE_7: "Glandular abnormality pathway",
  FIGURE_8: "Post-hysterectomy screening pathway",
  FIGURE_9: "Pregnancy high-grade/glandular cytology pathway",
  FIGURE_10: "Abnormal vaginal bleeding pathway",
  TABLE_1: "Vaginal screening after total hysterectomy",
};

test("visual decision tree titles remain clinically named and marked under validation", () => {
  assert.equal(ALL_FIGURES.length, 10);

  for (const figure of ALL_FIGURES) {
    assert.equal(figure.title, expectedTitles[figure.id], figure.id);
    assert.match(figure.subtitle, /Under validation/i, figure.id);
    assert.match(figure.subtitle, /rule output is source of truth/i, figure.id);
  }
});

test("pathway labels avoid internal source numbering", () => {
  for (const [figure, label] of Object.entries(expectedLabels)) {
    assert.equal(getFigureLabel(figure), label, figure);
    assert.doesNotMatch(label, /Figure \d|Table 1/i, figure);
  }
});
