import { describe, it, expect } from "vitest";
import { summarizeLevels } from "./city-summary";

const levels = [
  { key: "city", label: "City", rank: 2 },
  { key: "zone", label: "Zone", rank: 3 },
  { key: "sector", label: "Sector", rank: 4 },
  { key: "park", label: "Park", rank: 5 },
  { key: "class", label: "Class", rank: 6 },
];

describe("summarizeLevels", () => {
  it("counts nodes per level, excludes the city level, orders by rank", () => {
    const nodes = [
      { level: { key: "city" } }, // the city node itself — excluded
      { level: { key: "zone" } },
      { level: { key: "zone" } },
      { level: { key: "park" } },
      { level: { key: "class" } },
      { level: { key: "class" } },
      { level: { key: "class" } },
    ];
    expect(summarizeLevels(nodes, levels)).toEqual([
      { key: "zone", label: "Zone", count: 2 },
      { key: "sector", label: "Sector", count: 0 },
      { key: "park", label: "Park", count: 1 },
      { key: "class", label: "Class", count: 3 },
    ]);
  });

  it("returns zero counts for an empty tree (levels still listed)", () => {
    expect(summarizeLevels([{ level: { key: "city" } }], levels).map((l) => l.count)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
