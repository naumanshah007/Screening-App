import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";

import {
  safeOutboundRequest,
  SafeOutboundRequestError,
} from "../../lib/integrations/outbound-http";
import { OutboundPolicyError } from "../../lib/integrations/outbound-policy";

let server: Server;
let port = 0;
let capturedHeaders: Record<string, string | string[] | undefined> = {};

const testPolicy = {
  resolveDns: async () => [{ address: "127.0.0.1", family: 4 as const }],
  allowNonPublicAddress: (_address: string, hostname: string) => ["public.test", "second.test"].includes(hostname),
};

before(async () => {
  server = createServer((request, response) => {
    if (request.url === "/slow") return;
    if (request.url === "/large") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("x".repeat(32 * 1024));
      return;
    }
    if (request.url === "/loop") {
      response.writeHead(302, { Location: "/loop" });
      response.end();
      return;
    }
    if (request.url === "/blocked") {
      response.writeHead(302, { Location: `http://127.0.0.1:${port}/capture` });
      response.end();
      return;
    }
    if (request.url === "/cross-origin") {
      response.writeHead(302, { Location: `http://second.test:${port}/capture` });
      response.end();
      return;
    }
    if (request.url === "/capture") {
      capturedHeaders = request.headers;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  port = address.port;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("bounded requester enforces the total timeout and sanitizes the error", async () => {
  const secret = "do-not-leak-timeout-secret";
  await assert.rejects(
    safeOutboundRequest(`http://public.test:${port}/slow`, {
      totalTimeoutMs: 50,
      connectTimeoutMs: 25,
      headers: { Authorization: `Bearer ${secret}` },
      policy: testPolicy,
    }),
    (error: unknown) => {
      assert.ok(error instanceof SafeOutboundRequestError);
      assert.equal(error.code, "TOTAL_TIMEOUT");
      assert.doesNotMatch(error.safeMessage, new RegExp(secret));
      return true;
    }
  );
});

test("bounded requester rejects oversized responses and redirect loops", async () => {
  await assert.rejects(
    safeOutboundRequest(`http://public.test:${port}/large`, {
      maxResponseBytes: 1024,
      policy: testPolicy,
    }),
    (error: unknown) => error instanceof SafeOutboundRequestError && error.code === "RESPONSE_TOO_LARGE"
  );
  await assert.rejects(
    safeOutboundRequest(`http://public.test:${port}/loop`, {
      maxRedirects: 1,
      policy: testPolicy,
    }),
    (error: unknown) => error instanceof SafeOutboundRequestError && error.code === "REDIRECT_LIMIT"
  );
});

test("every redirect is revalidated and a public-to-loopback redirect is blocked", async () => {
  await assert.rejects(
    safeOutboundRequest(`http://public.test:${port}/blocked`, { policy: testPolicy }),
    (error: unknown) => error instanceof OutboundPolicyError && error.code === "NON_PUBLIC_ADDRESS"
  );
});

test("credentials are stripped on cross-origin redirects", async () => {
  const secret = "never-forward-this-value";
  const response = await safeOutboundRequest(`http://public.test:${port}/cross-origin`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "X-Special-Token": secret,
      "X-Safe-Trace": "safe",
    },
    sensitiveHeaders: ["X-Special-Token"],
    policy: testPolicy,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(capturedHeaders.authorization, undefined);
  assert.equal(capturedHeaders["x-special-token"], undefined);
  assert.equal(capturedHeaders["x-safe-trace"], "safe");
  assert.doesNotMatch(JSON.stringify(response), new RegExp(secret));
});
