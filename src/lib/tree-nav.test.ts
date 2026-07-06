import { describe, it, expect } from "vitest";
import { matchNodes, breadcrumb } from "./tree-nav";

const nodes = [
  { id: "city", name: "Islamabad", parentId: null },
  { id: "z1", name: "Zone 1", parentId: "city" },
  { id: "p1", name: "Park 3", parentId: "z1" },
  { id: "c1", name: "Class A", parentId: "p1" },
  { id: "c2", name: "Class B", parentId: "p1" },
];
const byId = new Map(nodes.map((n) => [n.id, n]));

describe("matchNodes", () => {
  it("case-insensitive name contains", () => {
    expect(matchNodes(nodes, "class").map((n) => n.id)).toEqual(["c1", "c2"]);
    expect(matchNodes(nodes, "PARK").map((n) => n.id)).toEqual(["p1"]);
  });
  it("blank query → no matches (outline shown instead)", () => {
    expect(matchNodes(nodes, "")).toEqual([]);
    expect(matchNodes(nodes, "   ")).toEqual([]);
  });
});

describe("breadcrumb", () => {
  it("lists ancestor names root→parent (excludes the node itself)", () => {
    expect(breadcrumb(byId, byId.get("c1")!)).toEqual(["Islamabad", "Zone 1", "Park 3"]);
  });
  it("empty for a root node", () => {
    expect(breadcrumb(byId, byId.get("city")!)).toEqual([]);
  });
});
