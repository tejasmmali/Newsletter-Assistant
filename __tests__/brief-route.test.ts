import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sources", () => ({
  listSources: vi.fn(),
}));

vi.mock("@/lib/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
  return {
    ...actual,
    generateJson: vi.fn(),
  };
});

import { listSources } from "@/lib/sources";
import { generateJson, LlmRateLimitError, LlmTimeoutError } from "@/lib/llm";
import { POST } from "@/app/api/brief/route";
import type { Source } from "@/lib/schemas";

const mockedList = vi.mocked(listSources);
const mockedGenerate = vi.mocked(generateJson);

function source(id: string, status: Source["status"] = "ok"): Source {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Title ${id}`,
    text: "x".repeat(250),
    note: null,
    status,
    error: null,
    created_at: new Date().toISOString(),
  };
}

const ready = [
  source("11111111-1111-4111-8111-111111111111"),
  source("22222222-2222-4222-8222-222222222222"),
  source("33333333-3333-4333-8333-333333333333"),
];

describe("POST /api/brief", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks when fewer than 3 ready sources", async () => {
    mockedList.mockResolvedValue([
      source("11111111-1111-4111-8111-111111111111"),
      source("22222222-2222-4222-8222-222222222222"),
    ]);
    const res = await POST(
      new Request("http://localhost/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("insufficient_sources");
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns a retryable JSON timeout when generation aborts", async () => {
    vi.useFakeTimers();
    mockedList.mockResolvedValue(ready);
    mockedGenerate.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new LlmTimeoutError()), 45_000);
        })
    );
    const pending = POST(
      new Request("http://localhost/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    await vi.advanceTimersByTimeAsync(45_000);
    const res = await pending;
    expect(res.status).toBe(504);
    const json = (await res.json()) as { error?: string; retryable?: boolean };
    expect(json).toEqual({ error: "timeout", retryable: true });
    vi.useRealTimers();
  });

  it("maps rate limits to 429", async () => {
    mockedList.mockResolvedValue(ready);
    mockedGenerate.mockRejectedValue(new LlmRateLimitError());
    const res = await POST(
      new Request("http://localhost/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(429);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("rate_limited");
  });
});
