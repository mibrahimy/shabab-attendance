import { describe, it, expect } from "vitest";
import { generateTempPassword } from "./password-generate";
import { checkPassword, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("generateTempPassword", () => {
  it("always produces a policy-valid password (100 runs)", () => {
    for (let i = 0; i < 100; i++) {
      const pw = generateTempPassword();
      expect(checkPassword(pw).valid, `weak password generated: ${pw}`).toBe(true);
      expect(pw.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    }
  });

  it("respects a requested length", () => {
    const pw = generateTempPassword(20);
    expect(pw).toHaveLength(20);
    expect(checkPassword(pw).valid).toBe(true);
  });

  it("is random (no two consecutive generations equal)", () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
