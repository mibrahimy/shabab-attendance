import { defineConfig, devices } from "@playwright/test";

// v2 e2e: mobile-first (the attendance UI is designed for a phone). Assumes the
// dev server is already running on :3000 and the v2 DB is seeded (see e2e/seed).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"], // ~412×915 mobile viewport
    screenshot: "only-on-failure",
    trace: "off",
  },
});
