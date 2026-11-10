import { expect, test } from "@playwright/test";

test("write assistant accept/reject/compare flow", async ({ page }) => {
  await page.goto("/write");
  await expect(page.getByRole("heading", { name: "Writing Assistant" })).toBeVisible();

  await page.getByRole("button", { name: "Load example draft" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByText("Issues", { exact: true })).toBeVisible();
  await expect(page.getByText(/Status|Found|issue/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Accept" }).first()).toBeVisible({
    timeout: 15_000,
  });

  const acceptButtons = page.getByRole("button", { name: "Accept" });
  const rejectButtons = page.getByRole("button", { name: "Reject" });
  const undoButtons = page.getByRole("button", { name: "Undo" });

  const acceptCount = await acceptButtons.count();
  for (let i = 0; i < acceptCount; i += 1) {
    const btn = acceptButtons.nth(i);
    if (await btn.isEnabled()) {
      await btn.click();
      break;
    }
  }

  const rejectCount = await rejectButtons.count();
  if (rejectCount > 0) {
    await rejectButtons.first().click();
  }

  const undoCount = await undoButtons.count();
  for (let i = 0; i < undoCount; i += 1) {
    const btn = undoButtons.nth(i);
    if (await btn.isEnabled()) {
      await btn.click();
      break;
    }
  }

  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText(/Original vs working draft/i)).toBeVisible();
  await page.getByRole("button", { name: "Metrics", exact: true }).click();
  await expect(page.getByText(/Rough signal only/i)).toBeVisible();
});
