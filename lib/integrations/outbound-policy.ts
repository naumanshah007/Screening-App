import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type OutboundDnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type OutboundPolicyOptions = {
  resolveDns?: OutboundDnsResolver;
  dnsTimeoutMs?: number;
  /** Reserved for an explicitly governed future deployment policy. Default denies. */
  allowNonPublicAddress?: (address: string, hostname: string) => boolean;
};

export type ApprovedOutboundTarget = {
  url: URL;
  hostname: string;
  addresses: ResolvedAddress[];
  pinnedAddress: ResolvedAddress;
};

export class OutboundPolicyError extends Error {
  readonly safeMessage = "Endpoint blocked by outbound security policy.";

  constructor(readonly code: string) {
    super("Outbound endpoint rejected");
    this.name = "OutboundPolicyError";
  }
}

const BLOCKED_METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google",
  "metadata.azure.internal",
  "instance-data",
]);

const defaultResolver: OutboundDnsResolver = async (hostname) => {
  const rows = await dns.lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({ address: row.address, family: row.family as 4 | 6 }));
};

async function resolveWithTimeout(
  resolver: OutboundDnsResolver,
  hostname: string,
  timeoutMs: number
) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      resolver(hostname),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new OutboundPolicyError("DNS_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseIpv4(address: string) {
  if (isIP(address) !== 4) return null;
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  return octets;
}

function blockedIpv4(address: string) {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a! >= 224
  );
}

function expandIpv6(address: string): number[] | null {
  let input = address.toLowerCase();
  const zone = input.indexOf("%");
  if (zone >= 0) return null;

  const ipv4Match = input.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]!);
    if (!ipv4) return null;
    const replacement = `${((ipv4[0]! << 8) | ipv4[1]!).toString(16)}:${((ipv4[2]! << 8) | ipv4[3]!).toString(16)}`;
    input = input.slice(0, input.length - ipv4Match[1]!.length) + replacement;
  }

  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function blockedIpv6(address: string) {
  const groups = expandIpv6(address);
  if (!groups) return true;
  const g0 = groups[0]!;
  const g1 = groups[1]!;
  const g5 = groups[5]!;
  const g6 = groups[6]!;
  const g7 = groups[7]!;
  const unspecified = groups.every((group) => group === 0);
  const loopback = groups.slice(0, 7).every((group) => group === 0) && g7 === 1;
  const mappedIpv4 = groups.slice(0, 5).every((group) => group === 0) && g5 === 0xffff;
  if (mappedIpv4) {
    return blockedIpv4(`${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`);
  }
  if (unspecified || loopback) return true;
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  // Default-deny non-global IPv6. Public global unicast is 2000::/3.
  return (g0 & 0xe000) !== 0x2000;
}

export function isNonPublicAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version === 6) return blockedIpv6(address);
  return true;
}

function normalizeHostname(hostname: string) {
  const unwrapped = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return unwrapped.endsWith(".") ? unwrapped.slice(0, -1).toLowerCase() : unwrapped.toLowerCase();
}

function validDnsHostname(hostname: string) {
  if (hostname.length < 1 || hostname.length > 253 || hostname.includes("%")) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (!hostname.includes(".")) return false;
  return hostname.split(".").every(
    (label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

export async function approveOutboundUrl(
  rawUrl: string | URL,
  options: OutboundPolicyOptions = {}
): Promise<ApprovedOutboundTarget> {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? new URL(rawUrl.href) : new URL(rawUrl);
  } catch {
    throw new OutboundPolicyError("MALFORMED_URL");
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new OutboundPolicyError("UNSUPPORTED_SCHEME");
  }
  if (url.username || url.password) throw new OutboundPolicyError("EMBEDDED_CREDENTIALS");
  if (!url.hostname || url.port === "0") throw new OutboundPolicyError("MALFORMED_HOST");

  const hostname = normalizeHostname(url.hostname);
  if (BLOCKED_METADATA_HOSTS.has(hostname)) throw new OutboundPolicyError("METADATA_HOST");

  let addresses: ResolvedAddress[];
  const literalVersion = isIP(hostname);
  if (literalVersion) {
    addresses = [{ address: hostname, family: literalVersion as 4 | 6 }];
  } else {
    if (!validDnsHostname(hostname)) throw new OutboundPolicyError("MALFORMED_HOST");
    try {
      const timeoutMs = Math.max(1, Math.min(options.dnsTimeoutMs ?? 2_000, 5_000));
      addresses = await resolveWithTimeout(options.resolveDns ?? defaultResolver, hostname, timeoutMs);
    } catch (error) {
      if (error instanceof OutboundPolicyError) throw error;
      throw new OutboundPolicyError("DNS_RESOLUTION_FAILED");
    }
  }
  if (!addresses.length) throw new OutboundPolicyError("DNS_NO_ADDRESSES");
  for (const result of addresses) {
    if (isIP(result.address) !== result.family) throw new OutboundPolicyError("DNS_INVALID_ADDRESS");
    if (
      isNonPublicAddress(result.address) &&
      !options.allowNonPublicAddress?.(result.address, hostname)
    ) {
      throw new OutboundPolicyError("NON_PUBLIC_ADDRESS");
    }
  }

  const pinnedAddress = addresses.find((entry) => entry.family === 4) ?? addresses[0]!;
  return { url, hostname, addresses, pinnedAddress };
}
