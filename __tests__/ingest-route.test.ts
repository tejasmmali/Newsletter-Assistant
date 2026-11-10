import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ingest", () => ({
  ingestSource: vi.fn(),
}));

import { ingestSource } from "@/lib/ingest";
import { POST } from "@/app/api/ingest/route";

const mockedIngest = vi.mocked(ingestSource);

function req(body: unknown, token?: string) {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ingest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.INGEST_TOKEN = "test-ingest-token";
  });

  it("rejects missing bearer token", async () => {
    const res = await POST(req({ url: "https://example.com/a" }));
    expect(res.status).toBe(401);
  });

  it("rejects bad URL / SSRF targets", async () => {
    const res = await POST(
      req({ url: "http://127.0.0.1/secret" }, "test-ingest-token")
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/SSRF|blocked|private/i);
    expect(mockedIngest).not.toHaveBeenCalled();
  });

  it("rejects invalid public URL scheme", async () => {
    const res = await POST(
      req({ url: "ftp://example.com/a" }, "test-ingest-token")
    );
    expect([400, 500]).toContain(res.status);
  });

  it("maps too-short manual text via ingestSource status", async () => {
    mockedIngest.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      url: "https://example.com/a",
      title: null,
      text: "short",
      note: null,
      status: "needs_manual_text",
      error: "Paste at least 200 characters of article text.",
      created_at: new Date().toISOString(),
    });
    const res = await POST(
      req({ url: "https://example.com/a", text: "short but present text" }, "test-ingest-token")
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { source: { status: string } };
    expect(json.source.status).toBe("needs_manual_text");
  });
});
