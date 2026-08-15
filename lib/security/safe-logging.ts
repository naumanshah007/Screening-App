type LogLevel = "info" | "warn" | "error";

type SafeLogRecord = {
  level: LogLevel;
  event: string;
  metadata?: Record<string, unknown>;
};

type SafeLogSink = (record: SafeLogRecord) => void;

const SENSITIVE_KEY =
  /(authorization|cookie|credential|password|secret|token|apikey|accesskey|refreshtoken|login|username|nhi|patient|name|email|phone|address|dob|dateofbirth|body|payload|content|raw|clinical)/i;
const NHI_LIKE = /\b[A-Z]{3}\d{4}\b/gi;
const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_LIKE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function sanitizeString(input: string) {
  return input
    .replace(BEARER_LIKE, "[REDACTED_CREDENTIAL]")
    .replace(EMAIL_LIKE, "[REDACTED_EMAIL]")
    .replace(NHI_LIKE, "[REDACTED_IDENTIFIER]")
    .slice(0, 500);
}

export function sanitizeForLog(
  input: unknown,
  seen = new WeakSet<object>()
): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return sanitizeString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (input instanceof Date) return input.toISOString();
  if (input instanceof Error) {
    const candidate = input as Error & { code?: unknown };
    return {
      errorName: input.name,
      errorCode:
        typeof candidate.code === "string" ? sanitizeString(candidate.code) : null,
      // Error messages frequently interpolate request data. Retain only a
      // short, pattern-redacted diagnostic; never serialize stack/cause.
      errorMessage: sanitizeString(input.message),
    };
  }
  if (typeof input !== "object") return "[UNSUPPORTED]";
  if (seen.has(input)) return "[CIRCULAR]";
  seen.add(input);

  if (Array.isArray(input)) {
    return input.slice(0, 20).map((item) => sanitizeForLog(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input).slice(0, 50)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    output[key] = SENSITIVE_KEY.test(normalizedKey)
      ? "[REDACTED]"
      : sanitizeForLog(value, seen);
  }
  return output;
}

const defaultSink: SafeLogSink = ({ level, event, metadata }) => {
  const message = metadata ? `${event} ${JSON.stringify(metadata)}` : event;
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.info(message);
};

export function writeSafeLog(
  level: LogLevel,
  event: string,
  metadata?: Record<string, unknown>,
  sink: SafeLogSink = defaultSink
) {
  sink({
    level,
    event: sanitizeString(event),
    ...(metadata
      ? { metadata: sanitizeForLog(metadata) as Record<string, unknown> }
      : {}),
  });
}

export function safeLogError(
  event: string,
  error: unknown,
  metadata?: Record<string, unknown>,
  sink?: SafeLogSink
) {
  writeSafeLog(
    "error",
    event,
    { error, ...(metadata ?? {}) },
    sink ?? defaultSink
  );
}

export type { SafeLogRecord, SafeLogSink };
