import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const enginePath = resolve(root, "lib/engine/decision-engine.ts");
const relativeEnginePath = "lib/engine/decision-engine.ts";
const sourceText = readFileSync(enginePath, "utf8");
const sourceFile = ts.createSourceFile(enginePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const testDir = resolve(root, "lib/engine/__tests__");
const testFiles = readdirSync(testDir).filter((name) => name.endsWith(".test.ts"));
const testsText = testFiles.map((name) => ({ name, text: readFileSync(resolve(testDir, name), "utf8") }));

type Entry = {
  internalRuleId: string;
  pathway: string;
  function: string;
  file: string;
  line: number;
  conditions: string[];
  outputCode: string;
  actionText: string;
  interval: string | null;
  risk: string | null;
  urgency: string | null;
  referralDestination: string | null;
  mandatoryReviewFlag: string;
  missingInformation: string | null;
  ruleVersion: string;
  branchPath: string;
  accessibleThroughWizard: "YES" | "NO" | "PARTIAL";
  accessibleThroughBatch: "YES" | "NO" | "PARTIAL";
  accessibleThroughApi: "YES" | "NO" | "PARTIAL";
  storedInPersistence: "YES" | "NO" | "PARTIAL";
  visibleInReviewQueue: "YES" | "NO" | "PARTIAL";
  representedInCompletedDecision: "YES" | "NO" | "PARTIAL";
  representedInExport: "YES" | "NO" | "PARTIAL";
  testCoverage: string[];
  extractionNote: string;
};

function lineOf(node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function functionName(node: ts.Node): string {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  }
  return "module scope";
}

function enclosingConditions(node: ts.Node): string[] {
  const conditions: string[] = [];
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isIfStatement(current)) conditions.unshift(current.expression.getText(sourceFile));
    if (ts.isConditionalExpression(current)) conditions.unshift(current.condition.getText(sourceFile));
    if (ts.isFunctionDeclaration(current)) break;
  }
  return [...new Set(conditions)];
}

function enclosingObject(node: ts.Node): ts.ObjectLiteralExpression | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isObjectLiteralExpression(current)) return current;
    if (ts.isFunctionDeclaration(current)) return undefined;
  }
  return undefined;
}

function propertyText(object: ts.ObjectLiteralExpression | undefined, propertyName: string): string | null {
  if (!object) return null;
  const property = object.properties.find((candidate) =>
    ts.isPropertyAssignment(candidate) && candidate.name.getText(sourceFile).replaceAll(/["']/g, "") === propertyName
  );
  if (!property || !ts.isPropertyAssignment(property)) return null;
  const value = property.initializer;
  return ts.isStringLiteralLike(value) ? value.text : value.getText(sourceFile).replaceAll(/\s+/g, " ");
}

function pathwayFor(code: string): string {
  if (code.startsWith("AGE-")) return "ROUTER/AGE";
  const match = code.match(/^(F\d+|T1)/);
  return match?.[1] ?? "UNKNOWN";
}

function channelProfile(pathway: string, code: string) {
  const specialist = ["F5", "F7", "F9"].includes(pathway);
  const history = ["F1", "F2", "F8", "T1"].includes(pathway);
  const wizard: Entry["accessibleThroughWizard"] = specialist || history ? "PARTIAL" : "YES";
  const batch: Entry["accessibleThroughBatch"] = ["F1", "F2", "F4", "F5", "F6", "F7", "F8", "T1", "F9", "F10"].includes(pathway) ? "PARTIAL" : "YES";
  const api: Entry["accessibleThroughApi"] = code.includes("EXTERNAL-HISTORY") ? "PARTIAL" : "YES";
  return {
    accessibleThroughWizard: wizard,
    accessibleThroughBatch: batch,
    accessibleThroughApi: api,
    storedInPersistence: "PARTIAL" as const,
    visibleInReviewQueue: "PARTIAL" as const,
    representedInCompletedDecision: "YES" as const,
    representedInExport: "PARTIAL" as const,
  };
}

function testsFor(code: string): string[] {
  return testsText.filter((candidate) => candidate.text.includes(code)).map((candidate) => `lib/engine/__tests__/${candidate.name}`);
}

const occurrences = new Map<string, ts.StringLiteralLike>();
function visit(node: ts.Node) {
  if (ts.isStringLiteralLike(node) && /^(F\d+|T1|AGE)-/.test(node.text) && !occurrences.has(node.text)) {
    occurrences.set(node.text, node);
  }
  ts.forEachChild(node, visit);
}
visit(sourceFile);

function entryFromNode(code: string, node: ts.StringLiteralLike): Entry {
  const object = enclosingObject(node);
  const pathway = pathwayFor(code);
  const safetyStop = /(REQUIRED|UNMAPPED|UNKNOWN|OUTSIDE-SOURCE)$/.test(code) || code.includes("REQUIRED");
  const actionText = propertyText(object, "nextAction") ?? propertyText(object, "recommendation") ?? "See the enclosing helper call in the cited function.";
  const interval = propertyText(object, "recallIntervalMonths") ?? propertyText(object, "nextScreeningIntervalMonths");
  const review = propertyText(object, "requiresMDMReview") === "true" || propertyText(object, "safetyOutcome") === '"CLINICIAN_REVIEW_REQUIRED"' || safetyStop;
  return {
    internalRuleId: code,
    pathway,
    function: functionName(node),
    file: relativeEnginePath,
    line: lineOf(node),
    conditions: enclosingConditions(node),
    outputCode: code,
    actionText,
    interval,
    risk: propertyText(object, "riskLevel"),
    urgency: propertyText(object, "referralPriority"),
    referralDestination: propertyText(object, "referralType"),
    mandatoryReviewFlag: review ? "YES" : "NO/NOT EXPLICIT",
    missingInformation: propertyText(object, "missingInformation"),
    ruleVersion: "business-figures-table1-v1",
    branchPath: propertyText(object, "branchPath") ?? "Generated by withDefaults from figure and recommendation code, or supplied by helper.",
    ...channelProfile(pathway, code),
    testCoverage: testsFor(code),
    extractionNote: object
      ? "Statically extracted from the enclosing return object; conditions are enclosing code predicates."
      : "Statically extracted from a helper-call argument or conditional code expression; inspect the cited line/function for the full output.",
  };
}

const entries = [...occurrences.entries()].map(([code, node]) => entryFromNode(code, node));

const hysterectomySuffixes = [
  ["HSIL-AIS-COMPLETE-TOC", 1051],
  ["HSIL-AIS-INCOMPLETE-COLP", 1063],
  ["HSIL-AIS-EXCISION-UNKNOWN-REVIEW", 1076],
  ["SUBTOTAL-FIG3", 1144],
  ["POST-HYST-HPV-NOT-DETECTED-NO-FURTHER", 1158],
  ["POST-HYST-HPV-DETECTED-FIG3", 1170],
  ["HYSTERECTOMY-HISTORY-REQUIRED", 1182],
  ["NEG-RETURNED-NO-PATH-NO-FURTHER", 1200],
  ["NEG-RETURNED-LSIL-HPV", 1208],
  ["HSIL-TOC-COMPLETE-NO-PATH-NO-FURTHER", 1220],
  ["HSIL-TOC-COMPLETE-LSIL-HPV", 1228],
  ["LOWGRADE-NOT-RETURNED-NO-PATH-HPV", 1240],
  ["LOWGRADE-NOT-RETURNED-LSIL-HPV", 1248],
  ["UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC", 1260],
  ["INCOMPLETE-TOC-NO-PATH-LOWGRADE-TOC", 1272],
  ["NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M", 1286],
  ["UNMAPPED-HYSTERECTOMY-BRANCH", 1299],
] as const;

for (const prefix of ["F8", "T1"] as const) {
  for (const [suffix, line] of hysterectomySuffixes) {
    const code = `${prefix}-${suffix}`;
    entries.push({
      internalRuleId: code,
      pathway: prefix,
      function: suffix.startsWith("HSIL-AIS-") ? "hysterectomyHighGradeOutcome" : "evaluateHysterectomyPathway",
      file: relativeEnginePath,
      line,
      conditions: ["Dynamic prefix selects Figure 8 or Table 1", `See evaluateHysterectomyPathway condition ending at line ${line}`],
      outputCode: code,
      actionText: sourceText.split("\n").slice(Math.max(0, line - 4), line + 4).join(" ").replaceAll(/\s+/g, " ").trim(),
      interval: suffix.includes("6M") ? "6" : null,
      risk: null,
      urgency: suffix.endsWith("COLP") ? "P2" : null,
      referralDestination: suffix.endsWith("COLP") ? "COLPOSCOPY" : null,
      mandatoryReviewFlag: suffix.includes("REVIEW") || suffix.endsWith("COLP") ? "YES" : "NO/NOT EXPLICIT",
      missingInformation: suffix.includes("REQUIRED") || suffix.includes("UNKNOWN") ? "See cited helper/branch" : null,
      ruleVersion: "business-figures-table1-v1",
      branchPath: "Emitted by the shared hysterectomy evaluator with a Figure 8/Table 1 prefix.",
      ...channelProfile(prefix, code),
      testCoverage: testsFor(code),
      extractionNote: "Expanded from a dynamic template-literal output code in the shared hysterectomy evaluator.",
    });
  }
}

const unique = [...new Map(entries.map((entry) => [entry.internalRuleId, entry])).values()].sort((a, b) =>
  a.pathway.localeCompare(b.pathway, undefined, { numeric: true }) || a.line - b.line || a.internalRuleId.localeCompare(b.internalRuleId)
);

const jsonPath = resolve(root, "docs/clinical-audit/expanded-implemented-rules.json");
writeFileSync(jsonPath, `${JSON.stringify(unique, null, 2)}\n`, "utf8");

const counts = unique.reduce<Record<string, number>>((result, entry) => {
  result[entry.pathway] = (result[entry.pathway] ?? 0) + 1;
  return result;
}, {});
const markdown = [
  "# Expanded implemented terminal-branch inventory",
  "",
  "This is a static inventory of what the current worktree's clinical decision engine emits. It is not a correctness claim and was not used to derive the independent guideline oracle.",
  "",
  `Engine rule version: \`business-figures-table1-v1\`. Distinct emitted/safety output codes: **${unique.length}**.`,
  "",
  "## Counts",
  "",
  "| Engine pathway | Distinct output branches |",
  "|---|---:|",
  ...Object.entries(counts).map(([pathway, count]) => `| ${pathway} | ${count} |`),
  "",
  "## Inventory",
  "",
  "| Code | Function:line | Enclosing condition summary | Actual action/output | Interval | Referral | Existing direct code assertion |",
  "|---|---|---|---|---|---|---|",
  ...unique.map((entry) => `| \`${entry.internalRuleId}\` | \`${entry.function}:${entry.line}\` | ${entry.conditions.join("; ") || "unconditional/helper outcome"} | ${entry.actionText.replaceAll("|", "\\|")} | ${entry.interval ?? "—"} | ${entry.referralDestination ?? "—"} | ${entry.testCoverage.length ? entry.testCoverage.join("; ") : "none found"} |`),
  "",
  "## Channel and persistence interpretation",
  "",
  "The JSON inventory records wizard, API, batch, persistence, review-queue, completed-decision, and export status per branch. `PARTIAL` means the engine branch exists but at least one required source fact, provenance element, longitudinal state, or independent review surface is not preserved end to end. The shared Figure 8/Table 1 evaluator emits only broad history/pathology codes; it does not implement 21 separately traceable Table 1 cell IDs.",
  "",
  "Static extraction deliberately includes insufficient-information, external-history, clinician-review, and unmapped outputs because they are terminal engine responses. Dynamic Figure 8/Table 1 template codes were expanded for both prefixes. Conditions and outputs are descriptions of code behavior only.",
  "",
].join("\n");
writeFileSync(resolve(root, "docs/clinical-audit/08-expanded-implemented-inventory.md"), markdown, "utf8");

console.log(JSON.stringify({ entries: unique.length, counts }, null, 2));
