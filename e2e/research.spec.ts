import { expect, test } from "@playwright/test";

const mockSources = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    url: "https://example.com/a",
    title: "Source A",
    text: "A".repeat(250),
    note: null,
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    url: "https://example.com/b",
    title: "Source B",
    text: "B".repeat(250),
    note: null,
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    url: "https://example.com/c",
    title: "Source C",
    text: "C".repeat(250),
    note: null,
    status: "ok",
    error: null,
    created_at: new Date().toISOString(),
  },
];

const mockBrief = {
  brief: {
    what_happened: "Three labs shipped quieter reliability updates.",
    per_source: mockSources.map((source) => ({
      source_id: source.id,
      summary: `Summary for ${source.title}`,
      why_it_matters: "Operators care about cost and reliability.",
      who_should_care: ["founders", "operators"],
    })),
    claims: [
      {
        text: "Verified claim about reliability.",
        type: "fact",
        source_id: mockSources[0]!.id,
        supporting_quote: "A".repeat(40),
        verified: true,
      },
      {
        text: "Unverified claim invented by the model.",
        type: "fact",
        source_id: mockSources[1]!.id,
        supporting_quote: "this quote is not in the source",
        verified: false,
      },
    ],
    story_angles: [
      { headline: "Reliability over leaderboard spikes", rationale: "Operators pay for uptime." },
      { headline: "Cost per successful task", rationale: "Founders need a unit of value." },
    ],
    recommended_angle: "Reliability over leaderboard spikes",
    reasoning: "The sources agree on reliability more than on valuation.",
    cross_source: {
      agreements: ["Reliability matters."],
      contradictions: ["Loss figures differ."],
      gaps: ["No primary filing quote."],
    },
  },
  meta: { source_count: 3, verified_claims: 1, unverified_claims: 1, latency_ms: 1200 },
};

test("research brief renders claims and angles", async ({ page }) => {
  await page.route("**/api/sources", async (route) => {
    await route.fulfill({ json: { sources: mockSources } });
  });
  await page.route("**/api/brief", async (route) => {
    await route.fulfill({ json: mockBrief });
  });

  await page.goto("/research");
  await expect(page.getByRole("heading", { name: "Research Assistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate brief" })).toBeEnabled();
  await page.getByRole("button", { name: "Generate brief" }).click();
  await expect(page.getByText("Verified claim about reliability.")).toBeVisible();
  await expect(page.getByText("unverified").first()).toBeVisible();
  await expect(page.getByText("Reliability over leaderboard spikes").first()).toBeVisible();
  await expect(page.getByText("Cost per successful task")).toBeVisible();
});

test("blocked URL shows the server message", async ({ page }) => {
  await page.route("**/api/sources", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { sources: [] } });
      return;
    }
    await route.fulfill({
      status: 400,
      json: { error: "invalid_url", message: "Blocked private or local URL (SSRF)." },
    });
  });
  await page.goto("/research");
  await page.getByLabel("Paste URLs (one per line)").fill("http://127.0.0.1/secret");
  await page.getByRole("button", { name: "Add sources" }).click();
  await expect(page.getByText("Blocked private or local URL (SSRF).")).toBeVisible();
});
