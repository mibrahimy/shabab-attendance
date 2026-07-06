import { test, expect } from "@playwright/test";
import { fixtures, login } from "./helpers";

// A cancelled (non-scheduled) event is read-only: the closed banner shows and the
// marking controls are gone.
const fx = fixtures();

test("a cancelled event renders read-only", async ({ page }) => {
  await login(page, fx.admin.cnic, fx.admin.password);
  await page.goto(`/mark/${fx.cancelledEventId}`);

  await expect(page.getByText(/closed/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Mark all present/i })).toHaveCount(0);
  // No save bar on a read-only event.
  await expect(page.getByRole("button", { name: /^Save/i })).toHaveCount(0);
});
