import { describe, it, expect } from "vitest";
import { checkPassword, isPasswordValid, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("checkPassword", () => {
  it("an empty password fails every criterion", () => {
    const { checks, valid } = checkPassword("");
    expect(valid).toBe(false);
    expect(Object.values(checks).every((c) => c === false)).toBe(true);
  });

  it("fails on length just under the minimum", () => {
    // 11 chars but otherwise fully compliant.
    const pw = "Aa1!aaaaaaa".slice(0, PASSWORD_MIN_LENGTH - 1);
    const { checks } = checkPassword(pw);
    expect(checks.minLength).toBe(false);
    expect(isPasswordValid(pw)).toBe(false);
  });

  it("flags each missing character class", () => {
    expect(checkPassword("abcdefghijk1!").checks.upper).toBe(false); // no uppercase
    expect(checkPassword("ABCDEFGHIJK1!").checks.lower).toBe(false); // no lowercase
    expect(checkPassword("Abcdefghijkl!").checks.digit).toBe(false); // no digit
    expect(checkPassword("Abcdefghijk12").checks.symbol).toBe(false); // no symbol
  });

  it("accepts a password meeting all criteria", () => {
    const pw = "Str0ng!Passw0rd";
    const { checks, valid } = checkPassword(pw);
    expect(valid).toBe(true);
    expect(Object.values(checks).every(Boolean)).toBe(true);
  });

  it("the seeded temp password meets the policy", () => {
    expect(isPasswordValid("ChangeMe!Aa1@2026")).toBe(true);
  });
});
