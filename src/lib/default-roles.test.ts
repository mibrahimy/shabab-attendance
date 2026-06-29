import { describe, it, expect } from "vitest";
import { rolesForLevel, findRole, nodesForRole } from "./default-roles";

describe("rolesForLevel", () => {
  it("a Class offers Student + Murabbi", () => {
    const keys = rolesForLevel("class").map((r) => r.canonicalKey).sort();
    expect(keys).toEqual(["murabbi", "student"]);
  });

  it("a Park offers Park Admin", () => {
    expect(rolesForLevel("park").map((r) => r.canonicalKey)).toEqual(["park_admin"]);
  });

  it("higher levels offer no direct-add roles yet", () => {
    expect(rolesForLevel("city")).toEqual([]);
    expect(rolesForLevel("zone")).toEqual([]);
    expect(rolesForLevel("sector")).toEqual([]);
  });

  it("only the student role is profile-only (no login)", () => {
    expect(findRole("student")?.isStudent).toBe(true);
    expect(findRole("murabbi")?.isStudent).toBe(false);
    expect(findRole("park_admin")?.isStudent).toBe(false);
  });
});

describe("nodesForRole", () => {
  const nodes = [
    { id: "p1", level: { key: "park" } },
    { id: "c1", level: { key: "class" } },
    { id: "c2", level: { key: "class" } },
    { id: "z1", level: { key: "zone" } },
  ];

  it("offers only Class nodes for a Murabbi", () => {
    expect(nodesForRole(nodes, { attachLevelKey: "class" }).map((n) => n.id)).toEqual(["c1", "c2"]);
  });

  it("offers only Park nodes for a Park Admin", () => {
    expect(nodesForRole(nodes, { attachLevelKey: "park" }).map((n) => n.id)).toEqual(["p1"]);
  });
});
