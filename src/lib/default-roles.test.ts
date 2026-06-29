import { describe, it, expect } from "vitest";
import { rolesForLevel, findRole } from "./default-roles";

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
