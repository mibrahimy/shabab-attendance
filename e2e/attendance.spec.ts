import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Visual + behavioral verification of the attendance UI on a mobile viewport.
// Data is seeded out-of-band (e2e/seed via curl); fixtures carry the login + event.
const fx = JSON.parse(readFileSync(join(__dirname, ".fixtures.json"), "utf8")) as {
  cnic: string;
  password: string;
  eventId: string;
};

const SHOTS = join(__dirname, "screens");

test("attendance flow — Today → Mark → Report (mobile)", async ({ page }) => {
  // Log in through the UI.
  await page.goto("/login");
  await page.getByLabel(/CNIC/i).fill(fx.cnic);
  await page.getByLabel(/Password/i).fill(fx.password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/");

  // Home dashboard.
  await expect(page.getByText(/City/)).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "1-home.png"), fullPage: true });

  // Today list.
  await page.goto("/mark");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("Class A")).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "2-today.png"), fullPage: true });

  // Mark screen — default should be NEUTRAL (no wall of red). Verify no button is
  // in the "absent selected" (red solid) state before the marker touches a row.
  await page.goto(`/mark/${fx.eventId}`);
  await expect(page.getByText("Mark all present")).toBeVisible();
  await expect(page.getByText("0 of 2 marked")).toBeVisible();
  const absentSolid = page.locator('button[aria-label="Absent"].bg-\\[\\#dc2626\\]');
  expect(await absentSolid.count()).toBe(0); // nothing pre-selected red
  await page.screenshot({ path: join(SHOTS, "3-mark-neutral.png"), fullPage: true });

  // Mark the two students (P then L) — buttons should color, progress advances.
  const rows = page.locator("ul > li");
  await rows.nth(0).getByRole("button", { name: "Present" }).click();
  await rows.nth(1).getByRole("button", { name: "Late" }).click();
  await expect(page.getByText("2 of 2 marked")).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "4-mark-marked.png"), fullPage: true });

  // Save → Report.
  await page.getByRole("button", { name: /Save/i }).click();
  await page.waitForURL(`**/mark/${fx.eventId}/report`);
  await expect(page.getByText("2 of 2 · 100%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "5-report.png"), fullPage: true });

  // Back on Today, the bottom tab bar is visible with the Attendance + Profile tabs.
  await page.goto("/mark");
  await expect(page.getByRole("link", { name: "Attendance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "6-tabbar.png"), fullPage: true });
});
