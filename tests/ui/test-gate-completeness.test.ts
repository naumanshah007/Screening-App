/**
 * The gate must run every test on disk.
 *
 * WHY THIS EXISTS
 * ---------------
 * `lib/cases/__tests__` sat outside `test:all` and never ran in CI or in any
 * release gate. Nothing failed, because nothing looked. A freeze declared on a
 * gate that silently skips a directory is a freeze on an unverified claim, so
 * the composition of the gate is itself now asserted.
 *
 * It checks DIRECTORIES rather than files: a new test file inside an already
 * covered directory is picked up by that directory's glob automatically, but a
 * new directory is invisible until someone wires it in. That is the failure
 * mode worth catching.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

/** Every directory under the repo that contains at least one *.test.ts. */
function testDirectories(dir: string, found = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      testDirectories(full, found);
    } else if (entry.endsWith(".test.ts")) {
      found.add(dir.slice(ROOT.length + 1));
    }
  }
  return found;
}

/** Directory globs reachable from `test:all`, following npm-script indirection. */
function directoriesCoveredByGate(): Set<string> {
  const covered = new Set<string>();
  const seen = new Set<string>();

  const expand = (scriptName: string) => {
    if (seen.has(scriptName)) return;
    seen.add(scriptName);
    const body = pkg.scripts[scriptName];
    if (!body) return;

    for (const [, referenced] of body.matchAll(/npm run ([\w:-]+)/g)) {
      expand(referenced);
    }
    for (const [, glob] of body.matchAll(/"([^"]*\*\.test\.ts)"/g)) {
      covered.add(glob.slice(0, glob.lastIndexOf("/")));
    }
    // The DB suite is executed by a runner script rather than a glob.
    if (/scripts\/run-db-tests\.ts/.test(body)) covered.add("tests/db");
  };

  expand("test:all");
  return covered;
}

test("every directory containing tests is reachable from test:all", () => {
  const onDisk = testDirectories(ROOT);
  const covered = directoriesCoveredByGate();
  const missing = [...onDisk].filter((dir) => !covered.has(dir)).sort();

  assert.deepEqual(
    missing,
    [],
    `these test directories never run in the gate: ${missing.join(", ")}. ` +
      "Add a script for each and include it in test:all."
  );
});

test("test:all does not run the same file twice", () => {
  // `test:router` targets a file inside the `test:engine` glob. Chaining both
  // ran it twice and inflated the reported total by that suite's size, which
  // makes the headline number untrue even though coverage was fine.
  const body = pkg.scripts["test:all"];
  assert.ok(
    !/npm run test:router\b/.test(body),
    "test:router duplicates a file already covered by test:engine; keep it as a " +
      "standalone script for targeted runs, but not inside test:all"
  );
  // It must still exist as a focused entry point.
  assert.ok(pkg.scripts["test:router"], "the focused router suite must remain runnable");
});

test("typecheck generates the Prisma client first", () => {
  // Schema-derived types do not exist in a clean checkout until the client is
  // generated, so `tsc --noEmit` alone fails for reasons unrelated to the code.
  assert.match(
    pkg.scripts.typecheck,
    /^prisma generate && tsc --noEmit$/,
    "typecheck must not depend on whatever happens to be in node_modules"
  );
});
