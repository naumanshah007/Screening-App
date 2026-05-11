import { PrismaLibSql } from "@prisma/adapter-libsql";

const LOCAL_DATABASE_URL = "file:./prisma/dev.db";

export type DatabaseRuntimeSummary = {
  adapter: "libsql";
  mode: "local-file" | "remote-libsql";
  url: string;
  displayTarget: string;
  authConfigured: boolean;
};

function normalizeEnvValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveDatabaseUrl() {
  return (
    normalizeEnvValue(process.env.DATABASE_URL) ??
    normalizeEnvValue(process.env.TURSO_DATABASE_URL) ??
    LOCAL_DATABASE_URL
  );
}

export function resolveDatabaseAuthToken() {
  return (
    normalizeEnvValue(process.env.LIBSQL_AUTH_TOKEN) ??
    normalizeEnvValue(process.env.TURSO_AUTH_TOKEN)
  );
}

export function isRemoteLibSqlUrl(url: string) {
  return /^(libsql|https?|wss?):/i.test(url) && !url.startsWith("file:");
}

function formatDisplayTarget(url: string) {
  if (url.startsWith("file:")) {
    return url.replace(/^file:\.?\/?/, "");
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function getDatabaseRuntimeSummary(): DatabaseRuntimeSummary {
  const url = resolveDatabaseUrl();
  const authToken = resolveDatabaseAuthToken();
  const remote = isRemoteLibSqlUrl(url);

  return {
    adapter: "libsql",
    mode: remote ? "remote-libsql" : "local-file",
    url,
    displayTarget: formatDisplayTarget(url),
    authConfigured: Boolean(authToken),
  };
}

export function createPrismaAdapter() {
  const runtime = getDatabaseRuntimeSummary();

  if (runtime.mode === "remote-libsql" && !runtime.authConfigured) {
    throw new Error(
      "Remote libsql database requires LIBSQL_AUTH_TOKEN or TURSO_AUTH_TOKEN."
    );
  }

  return new PrismaLibSql({
    url: runtime.url,
    ...(runtime.authConfigured
      ? { authToken: resolveDatabaseAuthToken() }
      : {}),
  });
}
