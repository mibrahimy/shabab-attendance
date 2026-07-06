import { describe, it, expect } from "vitest";
import { overlayPending, tally, attendanceRate } from "./overlay";

describe("overlayPending", () => {
  const roster = [
    { personId: "a", name: "A", status: "absent" as const },
    { personId: "b", name: "B", status: "absent" as const },
    { personId: "c", name: "C", status: "present" as const },
  ];

  it("queued marks win; untouched entries keep server status", () => {
    const out = overlayPending(roster, [
      { personId: "a", status: "present" },
      { personId: "b", status: "late" },
    ]);
    expect(out.map((r) => `${r.personId}:${r.status}`)).toEqual(["a:present", "b:late", "c:present"]);
  });

  it("preserves extra fields and returns the same array when nothing pending", () => {
    expect(overlayPending(roster, [])).toBe(roster);
    expect(overlayPending(roster, [{ personId: "a", status: "excused" }])[0].name).toBe("A");
  });
});

describe("tally + attendanceRate", () => {
  it("counts per status and computes the attended rate (present+late)", () => {
    const counts = tally([
      { status: "present" },
      { status: "present" },
      { status: "late" },
      { status: "absent" },
      { status: "excused" },
    ]);
    expect(counts).toEqual({ present: 2, late: 1, absent: 1, excused: 1 });
    expect(attendanceRate(counts)).toEqual({ attended: 3, total: 5, percent: 60 });
  });

  it("zero total → 0%", () => {
    expect(attendanceRate({ present: 0, late: 0, absent: 0, excused: 0 }).percent).toBe(0);
  });
});
