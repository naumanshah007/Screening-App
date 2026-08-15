import { spawnSync } from "node:child_process";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be explicitly set for a deployment migration. Environment fallbacks are not accepted."
  );
}

if (/^(libsql|https?|wss?):/i.test(databaseUrl)) {
  throw new Error(
    "Prisma Migrate cannot apply migrations over remote libSQL/HTTP. Use pilot:migrations:deploy-remote for the governed remote-libSQL path."
  );
}

if (!databaseUrl.startsWith("file:")) {
  throw new Error("This repository's Prisma datasource accepts only an explicit file: SQLite URL.");
}

const prismaCli = path.resolve("node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    // Prisma 7's schema-engine reports the expected P1003/create-database
    // signal at INFO. An ambient RUST_LOG=warn suppresses that structured
    // result and the CLI collapses it to an empty "Schema engine error".
    RUST_LOG: "info",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
