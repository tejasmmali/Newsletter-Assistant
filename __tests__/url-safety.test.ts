import { describe, expect, it } from "vitest";
import {
  assertIngestTextSize,
  assertSafePublicUrl,
  MAX_INGEST_TEXT_CHARS,
} from "@/lib/url-safety";

describe("assertSafePublicUrl", () => {
  it("allows public https URLs", () => {
    expect(assertSafePublicUrl("https://example.com/a").hostname).toBe(
      "example.com"
    );
  });

  it("blocks localhost and private IPs", () => {
    expect(() => assertSafePublicUrl("http://localhost/x")).toThrow(/SSRF|blocked/i);
    expect(() => assertSafePublicUrl("http://127.0.0.1/x")).toThrow(/SSRF|blocked/i);
    expect(() => assertSafePublicUrl("http://192.168.1.10/x")).toThrow(/SSRF|blocked/i);
    expect(() => assertSafePublicUrl("http://10.0.0.5/x")).toThrow(/SSRF|blocked/i);
  });

  it("blocks non-http schemes", () => {
    expect(() => assertSafePublicUrl("file:///etc/passwd")).toThrow(/http/i);
    expect(() => assertSafePublicUrl("ftp://example.com/a")).toThrow(/http/i);
  });
});

describe("assertIngestTextSize", () => {
  it("rejects oversized text", () => {
    expect(() =>
      assertIngestTextSize("x".repeat(MAX_INGEST_TEXT_CHARS + 1))
    ).toThrow(/maximum length/i);
  });
});
