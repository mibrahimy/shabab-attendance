import { describe, it, expect } from "vitest";
import { nextLevel, teamHeadKeys, type Level } from "./org-levels";

const template: Level[] = [
  { id: "z", key: "zone", label: "Zone", rank: 3 },
  { id: "s", key: "sector", label: "Sector", rank: 4 },
  { id: "p", key: "park", label: "Park", rank: 5 },
  { id: "c", key: "class", label: "Class", rank: 6 },
];

// A city template with the head roles that define each level's team.
const headed: Level[] = [
  { id: "city", key: "city", label: "City", rank: 2, headPositionKey: "city_poc" },
  { id: "zone", key: "zone", label: "Zone", rank: 3, headPositionKey: "zone_lead" },
  { id: "park", key: "park", label: "Park", rank: 4, headPositionKey: "park_admin" },
  { id: "class", key: "class", label: "Class", rank: 5, headPositionKey: "murabbi" },
];

describe("nextLevel", () => {
  it("returns the next-deeper level by rank", () => {
    // City rank is 2 (above the template) → first child is Zone.
    expect(nextLevel(template, 2)?.key).toBe("zone");
    expect(nextLevel(template, 3)?.key).toBe("sector");
    expect(nextLevel(template, 5)?.key).toBe("class");
  });

  it("returns null at the deepest level (leaf)", () => {
    expect(nextLevel(template, 6)).toBeNull();
  });

  it("is robust to unsorted templates", () => {
    const shuffled = [...template].reverse();
    expect(nextLevel(shuffled, 3)?.key).toBe("sector");
  });
});

describe("teamHeadKeys", () => {
  it("gives a park its own head + the child (class) head — the murabbi roster", () => {
    expect(teamHeadKeys(headed, "park")).toEqual({ headForNode: "park_admin", headForChild: "murabbi" });
  });

  it("gives a zone its own head + the park head", () => {
    expect(teamHeadKeys(headed, "zone")).toEqual({ headForNode: "zone_lead", headForChild: "park_admin" });
  });

  it("gives the deepest level (class) a head but no child head", () => {
    expect(teamHeadKeys(headed, "class")).toEqual({ headForNode: "murabbi", headForChild: null });
  });

  it("returns null heads for a level with no head role (team attendance unavailable)", () => {
    const noHead: Level[] = [{ id: "x", key: "x", label: "X", rank: 3 }];
    expect(teamHeadKeys(noHead, "x")).toEqual({ headForNode: null, headForChild: null });
  });

  it("returns null heads for an unknown typeId", () => {
    expect(teamHeadKeys(headed, "nope")).toEqual({ headForNode: null, headForChild: null });
  });
});
