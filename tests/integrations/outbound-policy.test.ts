import assert from "node:assert/strict";
import test from "node:test";

import {
  approveOutboundUrl,
  isNonPublicAddress,
  OutboundPolicyError,
} from "../../lib/integrations/outbound-policy";

async function assertBlocked(url: string) {
  await assert.rejects(
    approveOutboundUrl(url, {
      resolveDns: async () => [{ address: "1.1.1.1", family: 4 }],
    }),
    (error: unknown) => error instanceof OutboundPolicyError
  );
}

test("outbound policy rejects local, private, link-local, metadata and numeric bypass targets", async () => {
  const blocked = [
    "http://localhost/",
    "http://api.localhost/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
    "http://0.0.0.0/",
    "http://10.20.30.40/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://[::1]/",
    "http://[::]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[fd12::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://metadata.google.internal/",
    "http://instance-data/",
    "http://singlelabel/",
    "http://service.internal/",
  ];
  for (const url of blocked) await assertBlocked(url);
});

test("outbound policy rejects unsupported schemes, embedded credentials and malformed URLs", async () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://public.example.test/file",
    "unix:///var/run/socket",
    "gopher://public.example.test/",
    "https://user:password@public.example.test/",
    "not a url",
    "http://bad_host.example.test/",
    "http://.example.test/",
  ]) {
    await assertBlocked(url);
  }
});

test("DNS validation rejects any non-public answer and pins an approved answer", async () => {
  await assert.rejects(
    approveOutboundUrl("https://public.example.test/metadata", {
      resolveDns: async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "10.0.0.4", family: 4 },
      ],
    }),
    (error: unknown) => error instanceof OutboundPolicyError && error.code === "NON_PUBLIC_ADDRESS"
  );

  const approved = await approveOutboundUrl("https://public.example.test/metadata", {
    resolveDns: async () => [
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "1.1.1.1", family: 4 },
    ],
  });
  assert.equal(approved.hostname, "public.example.test");
  assert.deepEqual(approved.pinnedAddress, { address: "1.1.1.1", family: 4 });
});

test("DNS resolution itself is bounded", async () => {
  await assert.rejects(
    approveOutboundUrl("https://public.example.test/", {
      resolveDns: async () => new Promise(() => undefined),
      dnsTimeoutMs: 10,
    }),
    (error: unknown) => error instanceof OutboundPolicyError && error.code === "DNS_TIMEOUT"
  );
});

test("address classifier default-denies non-global IPv4 and IPv6 ranges", () => {
  for (const address of [
    "0.0.0.0",
    "127.0.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
  ]) {
    assert.equal(isNonPublicAddress(address), true, `${address} must be blocked`);
  }
  assert.equal(isNonPublicAddress("1.1.1.1"), false);
  assert.equal(isNonPublicAddress("2606:4700:4700::1111"), false);
});
