import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ingest", () => ({
  ingestSource: vi.fn(),
}));

import { POST } from "@/app/api/sources/route";
import { ingestSource } from "@/lib/ingest";

const mockedIngest = vi.mocked(ingestSource);

function req(body: unknown) {
  return new Request("http://localhost/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sources URL safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    "file:///etc/passwd",
    "http://localhost/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://10.1.2.3/secret",
    "http://192.168.0.8/",
  ])("returns 400 invalid_url for %s", async (url) => {
    const res = await POST(req({ urls: [url] }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; message: string };
    expect(json.error).toBe("invalid_url");
    expect(json.message.length).toBeGreaterThan(0);
    expect(mockedIngest).not.toHaveBeenCalled();
  });
});
