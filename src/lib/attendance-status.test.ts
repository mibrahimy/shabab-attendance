import { describe, it, expect } from "vitest";
import { shouldApplyMark, isAttendanceStatus } from "./attendance-status";

describe("shouldApplyMark (last-write-wins)", () => {
  const older = "2026-07-05T10:00:00Z";
  const newer = "2026-07-05T10:05:00Z";

  it("applies a strictly newer incoming mark", () => {
    expect(shouldApplyMark(older, newer)).toBe(true);
  });

  it("skips an older incoming mark", () => {
    expect(shouldApplyMark(newer, older)).toBe(false);
  });

  it("skips an equal timestamp (idempotent replay)", () => {
    expect(shouldApplyMark(newer, newer)).toBe(false);
  });

  it("applies when nothing is stored yet", () => {
    expect(shouldApplyMark(null, older)).toBe(true);
    expect(shouldApplyMark(undefined, older)).toBe(true);
  });

  it("accepts Date and string inputs equivalently", () => {
    expect(shouldApplyMark(new Date(older), new Date(newer))).toBe(true);
  });
});

describe("isAttendanceStatus", () => {
  it("accepts the four statuses, rejects others", () => {
    expect(isAttendanceStatus("present")).toBe(true);
    expect(isAttendanceStatus("excused")).toBe(true);
    expect(isAttendanceStatus("tardy")).toBe(false);
    expect(isAttendanceStatus(null)).toBe(false);
  });
});
