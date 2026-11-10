import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { generateContent, ctorArgs } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  ctorArgs: [] as unknown[],
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(opts: unknown) {
      ctorArgs.push(opts);
    }
  },
}));

import { generateJson } from "@/lib/llm";

describe("generateJson", () => {
  beforeEach(() => {
    ctorArgs.length = 0;
    generateContent.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    delete process.env.GEMINI_FALLBACK_MODEL;
  });

  it("uses API v1beta so JSON mode is accepted", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ok: true }) });

    const result = await generateJson("prompt", z.object({ ok: z.boolean() }));

    expect(result).toEqual({ ok: true });
    expect(ctorArgs[0]).toMatchObject({ apiVersion: "v1beta" });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        config: expect.objectContaining({
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        }),
      })
    );
  });
});
