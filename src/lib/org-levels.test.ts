import { describe, it, expect } from "vitest";
import { nextLevel, type Level } from "./org-levels";

const template: Level[] = [
  { id: "z", key: "zone", label: "Zone", rank: 3 },
  { id: "s", key: "sector", label: "Sector", rank: 4 },
  { id: "p", key: "park", label: "Park", rank: 5 },
  { id: "c", key: "class", label: "Class", rank: 6 },
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
