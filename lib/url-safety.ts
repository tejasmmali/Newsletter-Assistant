import { isIP } from "node:net";

const MAX_INGEST_TEXT_CHARS = 200_000;

export { MAX_INGEST_TEXT_CHARS };

export class UrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlSafetyError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return isPrivateIpv6(host);
  return false;
}

/** Reject non-http(s) and private/loopback/link-local targets before any fetch. */
export function assertSafePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlSafetyError("Invalid URL. Only public http(s) URLs are allowed.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlSafetyError("Only http(s) URLs are allowed.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new UrlSafetyError("Blocked private or local URL (SSRF).");
  }
  return url;
}

export function assertIngestTextSize(text: string | undefined): void {
  if (text && text.length > MAX_INGEST_TEXT_CHARS) {
    throw new UrlSafetyError(
      `Text exceeds the maximum length of ${MAX_INGEST_TEXT_CHARS} characters.`
    );
  }
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const rateHits = new Map<string, number[]>();

export function checkIngestRateLimit(
  token: string,
  now = Date.now()
): { ok: true } | { ok: false; retryAfterSec: number } {
  const prev = (rateHits.get(token) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_LIMIT) {
    const oldest = prev[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000)),
    };
  }
  prev.push(now);
  rateHits.set(token, prev);
  return { ok: true };
}
