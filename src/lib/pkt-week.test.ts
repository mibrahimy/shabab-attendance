import { describe, it, expect } from "vitest";
import { pktWeekStart, pktWeekRange, pktPrevWeekRange } from "./pkt-week";

// PKT midnight = 19:00 UTC the previous day. 2026-07-05 is a Sunday, so the PKT
// week starting Sun 2026-07-05 00:00 begins at 2026-07-04T19:00:00Z.

describe("pktWeekStart", () => {
  it("floors a mid-week instant to the week's Sunday 00:00 PKT", () => {
    // 2026-07-08T08:00:00Z = PKT 13:00 Wed 2026-07-08 → week of Sun 2026-07-05.
    expect(pktWeekStart(new Date("2026-07-08T08:00:00Z")).toISOString()).toBe(
      "2026-07-04T19:00:00.000Z",
    );
  });

  it("puts Saturday-23:59-PKT and the next Sunday-00:00-PKT in different weeks", () => {
    // Sat 2026-07-11 23:59 PKT = 2026-07-11T18:59:00Z → week of Sun 07-05.
    expect(pktWeekStart(new Date("2026-07-11T18:59:00Z")).toISOString()).toBe(
      "2026-07-04T19:00:00.000Z",
    );
    // Sun 2026-07-12 00:00 PKT = 2026-07-11T19:00:00Z → week of Sun 07-12.
    expect(pktWeekStart(new Date("2026-07-11T19:00:00Z")).toISOString()).toBe(
      "2026-07-11T19:00:00.000Z",
    );
  });

  it("buckets by PKT week, not UTC week", () => {
    // 2026-07-11T20:00:00Z is still Saturday in UTC (UTC week Sun 07-05..Sat 07-11)
    // but PKT 01:00 Sun 07-12 → belongs to the PKT week of Sun 07-12.
    expect(pktWeekStart(new Date("2026-07-11T20:00:00Z")).toISOString()).toBe(
      "2026-07-11T19:00:00.000Z",
    );
  });
});

describe("pktWeekRange", () => {
  it("spans exactly 7 days from the week's PKT Sunday", () => {
    const { start, end } = pktWeekRange(new Date("2026-07-08T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-04T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-11T19:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("pktPrevWeekRange", () => {
  it("is the 7 days immediately before the current PKT week", () => {
    const { start, end } = pktPrevWeekRange(new Date("2026-07-08T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-27T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-04T19:00:00.000Z");
    // abuts the current week with no gap or overlap
    expect(end.toISOString()).toBe(pktWeekRange(new Date("2026-07-08T08:00:00Z")).start.toISOString());
  });
});
