import { describe, it, expect } from "vitest";
import { formatCnic } from "./cnic";

describe("formatCnic", () => {
  it("groups digits as 5-7-1 as they arrive", () => {
    expect(formatCnic("3")).toBe("3");
    expect(formatCnic("37405")).toBe("37405");
    expect(formatCnic("374050")).toBe("37405-0");
    expect(formatCnic("374050608754")).toBe("37405-0608754");
    expect(formatCnic("3740506087549")).toBe("37405-0608754-9");
  });

  it("re-formats a raw paste and ignores extra digits", () => {
    expect(formatCnic("3740506087549999")).toBe("37405-0608754-9");
    expect(formatCnic("37405-0608754-9")).toBe("37405-0608754-9");
  });

  it("leaves a legacy email identifier untouched", () => {
    expect(formatCnic("user@example.com")).toBe("user@example.com");
  });
});
