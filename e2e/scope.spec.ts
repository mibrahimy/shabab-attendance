import { test, expect } from "@playwright/test";
import { fixtures, login } from "./helpers";

// A marker only sees/marks their own slice. A murabbi in another class must not be
// able to read or mark this event's roster.
const fx = fixtures();

test("a murabbi from another class can't access the event", async ({ page }) => {
  await login(page, fx.murabbi2.cnic, fx.murabbi2.password);

  // Roster for an event outside their scope → 403.
  const roster = await page.request.get(`/api/events/${fx.eventId}/roster`);
  expect(roster.status()).toBe(403);

  // And the event isn't in their Today list.
  const list = await page.request.get(`/api/events`);
  const body = await list.json();
  expect(body.data.events.find((e: { id: string }) => e.id === fx.eventId)).toBeUndefined();
});
