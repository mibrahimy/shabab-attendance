import { test, expect } from "@playwright/test";
import { fixtures, login } from "./helpers";

// The Phase-3 exit criterion: a murabbi marks ~20 students OFFLINE and it syncs
// cleanly. Mark offline → reconnect → the server reflects every mark, no loss.
const fx = fixtures();

test("mark ~20 offline → reconnect → syncs cleanly", async ({ page, context }) => {
  await login(page, fx.admin.cnic, fx.admin.password);

  // Open the event online (roster loads; SW caches it).
  await page.goto(`/mark/${fx.eventId}`);
  await expect(page.getByText(`0 of ${fx.studentCount} marked`)).toBeVisible();

  // Go offline — the offline band appears and the roster stays usable.
  await context.setOffline(true);
  await expect(page.getByText(/No signal/)).toBeVisible();

  // Mark everyone present offline; progress reaches 100%.
  await page.getByRole("button", { name: /Mark all present/i }).click();
  await expect(page.getByText(`${fx.studentCount} of ${fx.studentCount} marked`)).toBeVisible();

  // Save offline → queued locally, stays on the Mark screen (the report route
  // can't be fetched offline). Assert the stable outcome: URL unchanged (not
  // /report) and the offline band still shown. (The confirmation toast is
  // ephemeral, so it's not the assertion target.)
  await page.screenshot({ path: "e2e/screens/offline-saved.png", fullPage: true });
  await page.getByRole("button", { name: /Save/i }).click();
  await expect(page).toHaveURL(new RegExp(`/mark/${fx.eventId}$`));
  await expect(page.getByText(/No signal/)).toBeVisible();

  // Reconnect → the sync engine flushes the outbox on the `online` event.
  await context.setOffline(false);

  // The server should now reflect all ~20 marks as present (idempotent sync).
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/events/${fx.eventId}/roster`);
        if (!res.ok()) return -1;
        const body = await res.json();
        return body.data.roster.filter((r: { status: string }) => r.status === "present").length;
      },
      { timeout: 20_000, message: "all offline marks should sync to the server" },
    )
    .toBe(fx.studentCount);
});
