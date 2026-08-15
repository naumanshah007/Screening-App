import { spawn, type ChildProcess } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";

function requireSafeDatabasePath() {
  if (process.env.C0_SYNTHETIC_REHEARSAL !== "1") {
    throw new Error("C0_SYNTHETIC_REHEARSAL=1 is required.");
  }
  const url = process.env.C0_SYNTHETIC_DATABASE_URL?.trim();
  if (!url?.startsWith("file:")) throw new Error("C0 browser environment requires an isolated file: database.");
  const databasePath = path.resolve(url.slice("file:".length));
  const realDatabasePath = path.join(realpathSync(path.dirname(databasePath)), path.basename(databasePath));
  const inTemp = [realpathSync(os.tmpdir()), realpathSync("/tmp")].some((root) => {
    const relative = path.relative(root, realDatabasePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });
  if (!inTemp || !databasePath.includes("cervigrade-c0-")) {
    throw new Error("C0 browser database must be an explicitly named OS-temporary path.");
  }
  return databasePath;
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => (error || !port ? reject(error ?? new Error("No port")) : resolve(port)));
    });
  });
}

function createToken(privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"]) {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60, sub: "c0-synthetic-app" })
  ).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString("base64url")}`;
}

function signalProcessGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function waitForDatabase(url: string, authToken: string, child: ChildProcess) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Local authenticated libSQL server exited early.");
    const client = createClient({ url, authToken });
    try {
      await client.execute("SELECT 1");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      client.close();
    }
  }
  throw new Error("Local authenticated libSQL server did not become ready.");
}

async function main() {
  const databasePath = requireSafeDatabasePath();
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "cervigrade-c0-runtime-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPath = path.join(runtimeDir, "sqld-public-key.pem");
  await writeFile(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o600 });
  const authToken = createToken(privateKey);
  const [databasePort, applicationPort] = await Promise.all([freePort(), freePort()]);
  const databaseUrl = `http://127.0.0.1:${databasePort}`;
  const applicationUrl = `http://127.0.0.1:${applicationPort}`;

  const database = spawn(
    "turso",
    ["dev", "--db-file", databasePath, "--port", String(databasePort), "--auth-jwt-key-file", publicKeyPath],
    { cwd: runtimeDir, env: process.env, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  let application: ChildProcess | null = null;

  const stop = async () => {
    if (application) signalProcessGroup(application, "SIGTERM");
    signalProcessGroup(database, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (application) signalProcessGroup(application, "SIGKILL");
    signalProcessGroup(database, "SIGKILL");
    await rm(runtimeDir, { recursive: true, force: true });
  };

  process.once("SIGINT", () => void stop().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void stop().finally(() => process.exit(0)));

  try {
    await waitForDatabase(databaseUrl, authToken, database);
    application = spawn(
      "npm",
      ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(applicationPort)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          LIBSQL_AUTH_TOKEN: authToken,
          CERVIGRADE_RUNTIME_MODE: "PILOT",
          PILOT_AUTH_MODE: "LOCAL_MFA",
          PILOT_IDLE_TIMEOUT_MINUTES: "15",
          PILOT_REAUTH_MINUTES: "60",
          PILOT_RETENTION_POLICY_ID: "C0-SYNTHETIC-POLICY",
          AUTH_SECRET: randomBytes(32).toString("base64url"),
          AUTH_TRUST_HOST: "true",
          DEMO_MODE: "false",
          BOOTSTRAP_DEMO_DB: "false",
          // C0 explicitly rehearses the existing batch/review/decision
          // workflow with synthetic records. This does not enable demo login,
          // demo identities, or reset behaviour.
          ENABLE_BATCH_DEMO: "true",
        },
        stdio: ["ignore", "inherit", "inherit"],
        detached: true,
      }
    );
    console.log(
      JSON.stringify({
        status: "READY",
        data: "synthetic-only",
        applicationUrl,
        databaseMode: "authenticated-loopback-libsql",
        runtimeMode: "PILOT",
      })
    );
    await new Promise<void>((resolve, reject) => {
      application!.once("error", reject);
      application!.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`Application server exited with ${code}.`))
      );
    });
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "C0 browser environment failed.");
  process.exit(1);
});
