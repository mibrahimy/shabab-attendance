import { type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Fixtures = {
  admin: { cnic: string; password: string };
  murabbi2: { cnic: string; password: string };
  eventId: string;
  cancelledEventId: string;
  studentCount: number;
};

export function fixtures(): Fixtures {
  return JSON.parse(readFileSync(join(__dirname, ".fixtures.json"), "utf8"));
}

export async function login(page: Page, cnic: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/CNIC/i).fill(cnic);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/");
}
