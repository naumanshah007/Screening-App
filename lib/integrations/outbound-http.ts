import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";

import {
  approveOutboundUrl,
  OutboundPolicyError,
  type ApprovedOutboundTarget,
  type OutboundPolicyOptions,
} from "@/lib/integrations/outbound-policy";

export type SafeOutboundRequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  sensitiveHeaders?: string[];
  connectTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  allowRedirects?: boolean;
  policy?: OutboundPolicyOptions;
};

export type SafeOutboundResponse = {
  statusCode: number;
  body: Buffer;
  contentType: string | null;
  latencyMs: number;
  tls: "PASS" | "NOT_REQUIRED";
  target: ApprovedOutboundTarget;
  redirects: number;
};

export class SafeOutboundRequestError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    readonly networkStatus: "FAIL" | "NOT_TESTED" = "FAIL",
    readonly tlsStatus: "FAIL" | "NOT_TESTED" = "NOT_TESTED"
  ) {
    super(safeMessage);
    this.name = "SafeOutboundRequestError";
  }
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "x-api-key",
]);

function headerValue(headers: IncomingHttpHeaders, key: string) {
  const value = headers[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function requestOnce(args: {
  target: ApprovedOutboundTarget;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
  maxResponseBytes: number;
}): Promise<Omit<SafeOutboundResponse, "latencyMs" | "redirects"> & { headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const transport = args.target.url.protocol === "https:" ? https : http;
    let settled = false;
    let connected = false;
    const timers: { total?: NodeJS.Timeout; connect?: NodeJS.Timeout } = {};
    const finishReject = (error: SafeOutboundRequestError) => {
      if (settled) return;
      settled = true;
      if (timers.total) clearTimeout(timers.total);
      if (timers.connect) clearTimeout(timers.connect);
      reject(error);
    };
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [{
          address: args.target.pinnedAddress.address,
          family: args.target.pinnedAddress.family,
        }]);
        return;
      }
      callback(null, args.target.pinnedAddress.address, args.target.pinnedAddress.family);
    };

    timers.total = setTimeout(() => {
      finishReject(new SafeOutboundRequestError("TOTAL_TIMEOUT", "Live connection test timed out."));
      request.destroy();
    }, args.totalTimeoutMs);

    const request = transport.request(
      args.target.url,
      {
        method: args.method,
        headers: args.headers,
        lookup: pinnedLookup,
        servername: args.target.hostname,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > args.maxResponseBytes) {
            finishReject(new SafeOutboundRequestError("RESPONSE_TOO_LARGE", "Remote response exceeded the safe size limit."));
            response.destroy();
            request.destroy();
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          if (settled) return;
          settled = true;
          if (timers.total) clearTimeout(timers.total);
          if (timers.connect) clearTimeout(timers.connect);
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks),
            contentType: headerValue(response.headers, "content-type"),
            headers: response.headers,
            tls: args.target.url.protocol === "https:" ? "PASS" : "NOT_REQUIRED",
            target: args.target,
          });
        });
      }
    );

    timers.connect = setTimeout(() => {
      if (!connected) {
        finishReject(new SafeOutboundRequestError("CONNECT_TIMEOUT", "Unable to reach the configured endpoint within the connection timeout."));
        request.destroy();
      }
    }, Math.min(args.connectTimeoutMs, args.totalTimeoutMs));

    request.on("socket", (socket) => {
      const event = args.target.url.protocol === "https:" ? "secureConnect" : "connect";
      socket.once(event, () => {
        connected = true;
        if (timers.connect) clearTimeout(timers.connect);
      });
    });
    request.on("error", (error: NodeJS.ErrnoException) => {
      if (timers.connect) clearTimeout(timers.connect);
      if (timers.total) clearTimeout(timers.total);
      const tlsFailure = args.target.url.protocol === "https:" && [
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "ERR_TLS_CERT_ALTNAME_INVALID",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      ].includes(error.code ?? "");
      finishReject(
        new SafeOutboundRequestError(
          tlsFailure ? "TLS_FAILED" : "NETWORK_FAILED",
          tlsFailure ? "TLS negotiation failed." : "Unable to reach the configured endpoint.",
          "FAIL",
          tlsFailure ? "FAIL" : "NOT_TESTED"
        )
      );
    });
    if (args.body) request.write(args.body);
    request.end();
  });
}

function withoutCrossOriginCredentials(
  headers: Record<string, string>,
  sensitiveHeaders: string[]
) {
  const blocked = new Set([...DEFAULT_SENSITIVE_HEADERS, ...sensitiveHeaders.map((value) => value.toLowerCase())]);
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase()))
  );
}

export async function safeOutboundRequest(
  rawUrl: string | URL,
  options: SafeOutboundRequestOptions = {}
): Promise<SafeOutboundResponse> {
  const started = Date.now();
  const deadline = started + (options.totalTimeoutMs ?? 8_000);
  const maxRedirects = options.maxRedirects ?? 2;
  const allowRedirects = options.allowRedirects ?? true;
  let currentUrl: URL;
  try {
    currentUrl = rawUrl instanceof URL ? new URL(rawUrl.href) : new URL(rawUrl);
  } catch {
    throw new OutboundPolicyError("MALFORMED_URL");
  }
  let method = options.method ?? "GET";
  let body = options.body;
  let headers: Record<string, string> = {
    Accept: "application/json, application/fhir+json;q=0.9, */*;q=0.1",
    "User-Agent": "CerviGrade-Connectivity-Check/3B",
    ...(options.headers ?? {}),
  };

  for (let redirects = 0; ; redirects += 1) {
    const beforePolicy = deadline - Date.now();
    if (beforePolicy <= 0) {
      throw new SafeOutboundRequestError("TOTAL_TIMEOUT", "Live connection test timed out.");
    }
    let target: ApprovedOutboundTarget;
    try {
      target = await approveOutboundUrl(currentUrl, {
        ...options.policy,
        dnsTimeoutMs: Math.min(options.policy?.dnsTimeoutMs ?? 2_000, beforePolicy),
      });
    } catch (error) {
      if (error instanceof OutboundPolicyError) throw error;
      throw new OutboundPolicyError("POLICY_EVALUATION_FAILED");
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new SafeOutboundRequestError("TOTAL_TIMEOUT", "Live connection test timed out.");
    }
    const response = await requestOnce({
      target,
      method,
      headers,
      ...(body ? { body } : {}),
      connectTimeoutMs: options.connectTimeoutMs ?? 3_000,
      totalTimeoutMs: remaining,
      maxResponseBytes: options.maxResponseBytes ?? 256 * 1024,
    });

    const location = headerValue(response.headers, "location");
    if (!REDIRECT_CODES.has(response.statusCode) || !location) {
      return {
        statusCode: response.statusCode,
        body: response.body,
        contentType: response.contentType,
        tls: response.tls,
        target: response.target,
        redirects,
        latencyMs: Math.max(0, Date.now() - started),
      };
    }
    if (!allowRedirects) {
      throw new SafeOutboundRequestError("REDIRECT_NOT_ALLOWED", "Remote endpoint returned a redirect that is not allowed.");
    }
    if (redirects >= maxRedirects) {
      throw new SafeOutboundRequestError("REDIRECT_LIMIT", "Remote endpoint exceeded the safe redirect limit.");
    }
    let next: URL;
    try {
      next = new URL(location, currentUrl);
    } catch {
      throw new SafeOutboundRequestError("INVALID_REDIRECT", "Remote endpoint returned an invalid redirect.");
    }
    if (next.origin !== currentUrl.origin) {
      headers = withoutCrossOriginCredentials(headers, options.sensitiveHeaders ?? []);
    }
    if (response.statusCode === 303 && method !== "GET") {
      method = "GET";
      body = undefined;
      delete headers["Content-Length"];
      delete headers["content-length"];
      delete headers["Content-Type"];
      delete headers["content-type"];
    }
    currentUrl = next;
  }
}
