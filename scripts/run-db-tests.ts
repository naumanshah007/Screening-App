import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import {
  applySchema,
  createIsolatedDatabase,
} from "../tests/db/support/isolated-db";

const ROOT = process.cwd();
const DB_TEST_DIRECTORY = join(ROOT, "tests", "db");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

// These historical suites intentionally share one fully initialised database.
// The remaining DB suites create and clean up their own isolated database and
// must therefore run in separate processes so DATABASE_URL cannot bleed across
// module initialisation.
const SHARED_SCHEMA_TESTS = new Set([
  "stack-02-case-authority-pinning.test.ts",
  "stack-03-demo-mode-auth.test.ts",
  "stack-04-demo-governance-isolation.test.ts",
  "stack-05-current-governed-ruleset.test.ts",
  "stack-06-single-authoritative-pipeline.test.ts",
  "stack-07-organisation-scope.test.ts",
  "stack-08-source-identity.test.ts",
  "stack-09-episode-register.test.ts",
  "stack-10-phase1-acceptance.test.ts",
  "stack-11-usage-ledger.test.ts",
]);

function run(files: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(
    TSX,
    ["--test", "--test-concurrency=1", ...files],
    { cwd: ROOT, env, stdio: "inherit" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`DB test process failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const files = readdirSync(DB_TEST_DIRECTORY)
    .filter((file) => file.endsWith(".test.ts"))
    .sort();
  const sharedDatabase = createIsolatedDatabase("db-shared-suite");

  try {
    await applySchema(sharedDatabase.file);
    const sharedEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: sharedDatabase.url,
    };
    delete sharedEnv.TURSO_DATABASE_URL;
    delete sharedEnv.LIBSQL_AUTH_TOKEN;
    delete sharedEnv.VERCEL;

    let sharedRunComplete = false;
    for (const file of files) {
      if (SHARED_SCHEMA_TESTS.has(file)) {
        if (!sharedRunComplete) {
          run(
            files
              .filter((candidate) => SHARED_SCHEMA_TESTS.has(candidate))
              .map((candidate) => join(DB_TEST_DIRECTORY, candidate)),
            sharedEnv
          );
          sharedRunComplete = true;
        }
        continue;
      }
      run([join(DB_TEST_DIRECTORY, file)], sharedEnv);
    }
  } finally {
    sharedDatabase.cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
