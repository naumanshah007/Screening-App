/**
 * Reprocessing awareness.
 *
 * When a patient (matched by NHI) was processed in an earlier run, the new item
 * records a link to the most recent prior item so the worklist can flag it and
 * the drill-in can show a previous-vs-now comparison. Pure diff helper lives
 * here; the DB lookup is in lib/batch/persistence.ts (saveBatchRun).
 */

export type DecisionSnapshot = {
  recommendation: string;
  recommendationCode: string;
  riskLevel: string;
  referralPriority: string | null;
  triagePriority: string | null;
  disposition: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  date: string | null;
};

export type ComparisonField = {
  label: string;
  previous: string;
  current: string;
  changed: boolean;
};

export type PriorComparison = {
  previousDate: string | null;
  fields: ComparisonField[];
  anyChanged: boolean;
};

function norm(value: string | null | undefined): string {
  return (value ?? "—").toString();
}

/** Build the field-by-field previous-vs-now comparison for the drill-in. */
export function buildPriorComparison(
  previous: DecisionSnapshot,
  current: DecisionSnapshot
): PriorComparison {
  const rows: Array<[string, string | null, string | null]> = [
    ["Risk level", previous.riskLevel, current.riskLevel],
    ["Booking priority", previous.triagePriority, current.triagePriority],
    ["Referral priority", previous.referralPriority, current.referralPriority],
    ["Recommendation", previous.recommendation, current.recommendation],
    ["Recommendation code", previous.recommendationCode, current.recommendationCode],
    ["Prior disposition", previous.disposition, current.disposition],
  ];

  const fields: ComparisonField[] = rows.map(([label, prev, curr]) => ({
    label,
    previous: norm(prev),
    current: norm(curr),
    changed: norm(prev) !== norm(curr),
  }));

  return {
    previousDate: previous.date,
    fields,
    anyChanged: fields.some((f) => f.changed),
  };
}
