import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export class LlmRateLimitError extends Error {
  readonly retryable = true;

  constructor(message = "Rate limited, try again in a minute") {
    super(message);
    this.name = "LlmRateLimitError";
  }
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export class LlmTimeoutError extends Error {
  readonly retryable = true;

  constructor(message = "timeout") {
    super(message);
    this.name = "LlmTimeoutError";
  }
}

type GenerateJsonOptions = {
  /** Optional system-style preamble prepended to the user prompt. */
  system?: string;
  signal?: AbortSignal;
};

function requireGeminiConfig(): {
  apiKey: string;
  model: string;
  fallbackModel?: string;
} {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || undefined;
  if (!apiKey) {
    throw new LlmConfigError("GEMINI_API_KEY is not configured.");
  }
  if (!model) {
    throw new LlmConfigError("GEMINI_MODEL is not configured.");
  }
  return { apiKey, model, fallbackModel };
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status =
    "status" in err && typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : "code" in err && typeof (err as { code: unknown }).code === "number"
        ? (err as { code: number }).code
        : null;
  if (status === 429 || status === 503) return true;
  const message =
    err instanceof Error
      ? err.message
      : "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : "";
  return /429|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|503/i.test(message);
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err && typeof (err as { name: unknown }).name === "string"
    ? (err as { name: string }).name
    : "";
  if (name === "AbortError" || name === "TimeoutError" || name === "LlmTimeoutError") {
    return true;
  }
  const message = err instanceof Error ? err.message : "";
  return /timeout|aborted|deadline/i.test(message);
}

async function callModel(
  apiKey: string,
  model: string,
  prompt: string,
  options: GenerateJsonOptions
): Promise<string> {
  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: options.system ? `${options.system}\n\n${prompt}` : prompt,
      config: {
        responseMimeType: "application/json",
        abortSignal: options.signal,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = response.text ?? "";
    console.info(`[llm] model=${model} latency_ms=${Date.now() - started} outcome=ok`);
    if (!text.trim()) throw new Error("Gemini returned an empty response.");
    return text;
  } catch (err) {
    console.info(
      `[llm] model=${model} latency_ms=${Date.now() - started} outcome=error`
    );
    throw err;
  }
}

export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: GenerateJsonOptions = {}
): Promise<T> {
  if (options.signal?.aborted) throw new LlmTimeoutError();
  const { apiKey, model, fallbackModel } = requireGeminiConfig();

  const run = async (chosen: string) => {
    const raw = await callModel(apiKey, chosen, prompt, options);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }
    return schema.parse(parsed);
  };

  try {
    return await run(model);
  } catch (err) {
    if (options.signal?.aborted || isTimeoutError(err)) {
      if (fallbackModel && fallbackModel !== model && !options.signal?.aborted) {
        try {
          return await run(fallbackModel);
        } catch (fallbackErr) {
          if (isTimeoutError(fallbackErr)) throw new LlmTimeoutError();
          if (isRateLimitError(fallbackErr)) throw new LlmRateLimitError();
          throw fallbackErr;
        }
      }
      throw new LlmTimeoutError();
    }
    if (isRateLimitError(err)) {
      if (fallbackModel && fallbackModel !== model) {
        try {
          return await run(fallbackModel);
        } catch (fallbackErr) {
          if (isRateLimitError(fallbackErr)) throw new LlmRateLimitError();
          if (isTimeoutError(fallbackErr)) throw new LlmTimeoutError();
          throw fallbackErr;
        }
      }
      throw new LlmRateLimitError();
    }
    throw err;
  }
}
