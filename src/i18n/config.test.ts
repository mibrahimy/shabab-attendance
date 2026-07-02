import { describe, it, expect } from "vitest";
import { dir, isLocale, DEFAULT_LOCALE } from "./config";

describe("i18n config", () => {
  it("Urdu is right-to-left, English left-to-right", () => {
    expect(dir("ur")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });

  it("isLocale validates supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
