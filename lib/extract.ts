import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { MIN_SOURCE_TEXT_CHARS } from "@/lib/schemas";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; NewsletterAssistant/1.0; +https://github.com/newsletter-assistant)";

/** Long live blogs (Yahoo's filing thread is ~15k chars) are not paywalls. */
const LONG_ARTICLE_CHARS = 8_000;

const PAYWALL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /subscribe(?: for free)? to continue(?: reading)?/i, label: "subscribe to continue" },
  { re: /sign in to (?:read|continue)/i, label: "sign in to read" },
  { re: /\bpaywall\b/i, label: "paywall" },
  { re: /paid subscribers/i, label: "paid subscribers" },
  { re: /continue reading/i, label: "continue reading" },
];

export type ExtractResult =
  | {
      status: "ok";
      title: string | null;
      text: string;
    }
  | {
      status: "needs_manual_text";
      title: string | null;
      text: string | null;
      error: string;
    }
  | {
      status: "error";
      title: string | null;
      text: string | null;
      error: string;
    };

export function isXUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "x.com" ||
      host === "www.x.com" ||
      host === "twitter.com" ||
      host === "www.twitter.com" ||
      host === "mobile.twitter.com"
    );
  } catch {
    return false;
  }
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function isTextLongEnough(text: string): boolean {
  return normalizeWhitespace(text).length >= MIN_SOURCE_TEXT_CHARS;
}

/**
 * Trailing or embedded paywall phrases on short or cut-off extracts.
 * Returns a reader-facing reason, or null when the text looks complete.
 */
export function paywallReason(text: string): string | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;
  if (normalized.length >= LONG_ARTICLE_CHARS) return null;
  const hit = PAYWALL_PATTERNS.find((pattern) => pattern.re.test(normalized));
  if (!hit) return null;
  const tail = normalized.slice(-500);
  const inTail = PAYWALL_PATTERNS.some((pattern) => pattern.re.test(tail));
  const short = normalized.length < 4_000;
  if (!inTail && !short) return null;
  return `This looks truncated (${hit.label}). Paste the full article text.`;
}

export function applyManualText(text: string, title: string | null): ExtractResult {
  const normalized = normalizeWhitespace(text);
  const paywall = paywallReason(normalized);
  if (paywall) {
    return { status: "needs_manual_text", title, text: normalized, error: paywall };
  }
  if (!isTextLongEnough(normalized)) {
    return {
      status: "needs_manual_text",
      title,
      text: normalized,
      error: `Paste at least ${MIN_SOURCE_TEXT_CHARS} characters of article text.`,
    };
  }
  return { status: "ok", title, text: normalized };
}

/**
 * Fetch a URL and extract main article text with Readability.
 * Never throws for expected failure modes — returns a typed status.
 */
export async function extractFromUrl(url: string): Promise<ExtractResult> {
  if (isXUrl(url)) {
    return {
      status: "needs_manual_text",
      title: null,
      text: null,
      error: "X/Twitter URLs cannot be scraped reliably. Paste the tweet text manually.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        status: "error",
        title: null,
        text: null,
        error: `Fetch failed (${response.status}).`,
      };
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const title = article?.title?.trim() || null;
    const text = normalizeWhitespace(article?.textContent ?? "");
    const paywall = paywallReason(text);
    if (paywall) {
      return { status: "needs_manual_text", title, text: text || null, error: paywall };
    }
    if (!isTextLongEnough(text)) {
      return {
        status: "needs_manual_text",
        title,
        text: text || null,
        error: "Could not extract enough article text. Paste it manually.",
      };
    }
    return { status: "ok", title, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extract failed";
    const timedOut = /abort|timeout/i.test(message);
    return {
      status: timedOut ? "needs_manual_text" : "error",
      title: null,
      text: null,
      error: timedOut ? "The page timed out. Paste the article text manually." : message,
    };
  } finally {
    clearTimeout(timer);
  }
}
