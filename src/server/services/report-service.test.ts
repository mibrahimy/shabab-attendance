import { describe, it, expect } from "vitest";
import { buildWeekly } from "./report-service";

// PKT week of Sun 2026-07-05 = [2026-07-04T19:00Z, 2026-07-11T19:00Z);
// the following week of Sun 2026-07-12 starts at 2026-07-11T19:00Z.

describe("buildWeekly", () => {
  it("buckets events into PKT weeks and sums present/total", () => {
    const events = [
      { id: "a", scheduledAt: new Date("2026-07-06T05:00:00Z") }, // Mon, week of 07-05
      { id: "b", scheduledAt: new Date("2026-07-08T05:00:00Z") }, // Wed, week of 07-05
      { id: "c", scheduledAt: new Date("2026-07-13T05:00:00Z") }, // Mon, week of 07-12
    ];
    const rates = new Map([
      ["a", { present: 8, total: 10 }],
      ["b", { present: 5, total: 10 }],
      ["c", { present: 9, total: 10 }],
    ]);

    const weekly = buildWeekly(events, rates);
    expect(weekly).toHaveLength(2);

    // week 1: 13/20 = 65%, 2 sessions
    expect(weekly[0]).toEqual({
      weekStart: "2026-07-04T19:00:00.000Z",
      present: 13, total: 20, sessions: 2, rate: 65,
    });
    // week 2: 9/10 = 90%, 1 session
    expect(weekly[1]).toEqual({
      weekStart: "2026-07-11T19:00:00.000Z",
      present: 9, total: 10, sessions: 1, rate: 90,
    });
  });

  it("is sorted oldest→newest regardless of input order", () => {
    const events = [
      { id: "late", scheduledAt: new Date("2026-07-13T05:00:00Z") },
      { id: "early", scheduledAt: new Date("2026-07-06T05:00:00Z") },
    ];
    const rates = new Map([
      ["late", { present: 1, total: 1 }],
      ["early", { present: 1, total: 1 }],
    ]);
    const weekly = buildWeekly(events, rates);
    expect(weekly.map((w) => w.weekStart)).toEqual([
      "2026-07-04T19:00:00.000Z",
      "2026-07-11T19:00:00.000Z",
    ]);
  });

  it("treats a missing rate entry as 0/0", () => {
    const events = [{ id: "x", scheduledAt: new Date("2026-07-06T05:00:00Z") }];
    const weekly = buildWeekly(events, new Map());
    expect(weekly[0]).toMatchObject({ present: 0, total: 0, sessions: 1, rate: 0 });
  });

  it("returns [] for no events", () => {
    expect(buildWeekly([], new Map())).toEqual([]);
  });
});
