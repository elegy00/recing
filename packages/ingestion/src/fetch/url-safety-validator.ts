/**
 * SSRF protection for URL fetching.
 * Validates URLs for syntax, scheme, and DNS resolution safety.
 */

import { FetchErrorCode } from "@recing/schema";
import { RecipeFetchException } from "./recipe-fetch-exception.js";

/** Resolves a hostname to IP addresses — injectable for testing. */
export type DnsResolver = (host: string) => Promise<string[]>;

const realDnsResolver: DnsResolver = async (host: string): Promise<string[]> => {
  const dns = await import("node:dns/promises");
  let v4: string[] = [];
  let v6: string[] = [];

  try {
    v4 = await dns.resolve4(host);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOTFOUND" &&
        (err as NodeJS.ErrnoException).code !== "ENODATA") {
      throw err;
    }
  }

  try {
    v6 = await dns.resolve6(host);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOTFOUND" &&
        (err as NodeJS.ErrnoException).code !== "ENODATA") {
      throw err;
    }
  }

  const all = [...v4, ...v6];
  if (all.length === 0) {
    throw new Error("DNS resolution failed");
  }
  return all;
};

/** Default DNS resolver — use in production. */
let _dnsResolver: DnsResolver = realDnsResolver;

/** Override the DNS resolver (mainly for testing). */
export function setDnsResolver(resolver: DnsResolver): void {
  _dnsResolver = resolver;
}

/** Reset to the real DNS resolver. */
export function resetDnsResolver(): void {
  _dnsResolver = realDnsResolver;
}

/**
 * Validates a submitted URL string for safety.
 * Rejects non-http(s) schemes, private IPs, localhost, and malformed URLs.
 */
export async function validateUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
  }

  // Only allow http and https schemes
  const scheme = url.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
  }

  // Reject userinfo credentials (user:pass@host)
  if (url.username.length > 0 || url.password.length > 0) {
    throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
  }

  const host = url.hostname;
  if (!host) {
    throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
  }

  // Validate explicit port is in valid range
  const rawPort = url.port;
  if (rawPort !== "") {
    const port = parseInt(rawPort, 10);
    if (isNaN(port) || port < -1 || port > 65535) {
      throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
    }
  }

  return resolveAndValidateHost(host, trimmed);
}

/**
 * Resolves the host via DNS and validates that no resolved address is unsafe.
 */
async function resolveAndValidateHost(host: string, originalUrl: string): Promise<URL> {
  try {
    const addresses = await _dnsResolver(host);
    for (const addr of addresses) {
      if (!isPublicAddress(addr)) {
        throw new RecipeFetchException(FetchErrorCode.UNSAFE_TARGET);
      }
    }
  } catch (err) {
    // DNS resolution failure — treat as invalid URL
    if (err instanceof RecipeFetchException) throw err;
    throw new RecipeFetchException(FetchErrorCode.INVALID_URL);
  }

  return new URL(originalUrl.trim());
}

/**
 * Checks whether an IP address string is a public (externally reachable) address.
 */
export function isPublicAddress(ip: string): boolean {
  if (ip.toLowerCase() === "localhost") return false;
  if (/^127\./.test(ip)) return false;
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return false;
  if (ip === "0.0.0.0") return false;

  // Link-local IPv4 (169.254.x.x) or link-local IPv6 (fe80::/10)
  if (/^169\.254\./.test(ip)) return false;
  const ipv6Parts = ip.split(":");
  if (ipv6Parts.length >= 1 && /^[0-9a-fA-F]{1,4}$/.test(ipv6Parts[0])) {
    const firstByte = parseInt(ipv6Parts[0], 16);
    // fe80::/10 check — top nibble of second hex digit is 8, 9, a, or b
    if ((firstByte & 0xff00) === 0xfe00 && ((firstByte >> 4) & 0x0f) <= 0x0b) return false;
  }

  // Multicast IPv4 (224-239.x) or IPv6 multicast (ff00::/8)
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const b1 = parseInt(ipv4Match[1], 10);
    if (b1 >= 224 && b1 <= 239) return false;
    // Private IPv4 ranges
    const b2 = parseInt(ipv4Match[2], 10);
    if (b1 === 10) return false;
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return false;
    if (b1 === 192 && b2 === 168) return false;
    // 127.x.x.x loopback (already checked, but explicit for clarity)
    if (b1 === 127) return false;
    // 169.254.x.x link-local (already checked above)
    if (b1 === 169 && b2 === 254) return false;
  }

  // IPv6 unique local addresses ::fc00::/7
  // Top hex digit is 'f' and second hex digit starts with 'c' through 'f'
  if (ipv6Parts.length >= 1 && /^[0-9a-fA-F]{1,4}$/.test(ipv6Parts[0])) {
    const firstNibble = parseInt(ipv6Parts[0][0], 16);
    const secondNibble = ipv6Parts[0].length > 1 ? parseInt(ipv6Parts[0][1], 16) : 0;
    if (firstNibble === 0xf && secondNibble >= 0xc) return false;
  }

  // IPv4-mapped IPv6 ::ffff:private-ipv4 check
  if (ipv6Parts.length >= 3 && ipv6Parts[0] === "0" && ipv6Parts[1] === "0") {
    const b2 = parseInt(ipv6Parts[2], 16);
    const b3 = parseInt(ipv6Parts[3], 16);
    if (b2 === 0 && b3 === 0) return false; // :: — unspecified
  }

  return true;
}
