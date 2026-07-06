import { describe, it, expect } from "vitest";
import { pktDayRange } from "./pkt-day";

describe("pktDayRange", () => {
  it("spans exactly 24h and starts at PKT midnight (19:00 UTC prev day)", () => {
    // 2026-07-05T08:00:00Z → PKT 13:00 on the 5th → PKT day = 2026-07-05.
    const { start, end } = pktDayRange(new Date("2026-07-05T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-04T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-05T19:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("an instant just after PKT midnight belongs to the new PKT day", () => {
    // 2026-07-04T19:30:00Z = PKT 00:30 on the 5th → day = 2026-07-05.
    const { start } = pktDayRange(new Date("2026-07-04T19:30:00Z"));
    expect(start.toISOString()).toBe("2026-07-04T19:00:00.000Z");
  });

  it("an instant just before PKT midnight still belongs to the old PKT day", () => {
    // 2026-07-04T18:30:00Z = PKT 23:30 on the 4th → day = 2026-07-04.
    const { start, end } = pktDayRange(new Date("2026-07-04T18:30:00Z"));
    expect(start.toISOString()).toBe("2026-07-03T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-04T19:00:00.000Z");
  });
});
