import { describe, it, expect } from "vitest";
import type { AuthzContext, Grant } from "@/types/auth";
import { canActOn, isSuperadmin, requirePermission } from "./can-act-on";
import { ForbiddenError } from "@/server/errors";

const ROOT = "/root/";
const ISB = "/root/isb/";
const PARK_X = "/root/isb/parkX/";
const PARK_X2 = "/root/isb/parkX2/";
const CLASS_IN_X = "/root/isb/parkX/classA/";

function ctx(grants: Grant[], isSuper = false): AuthzContext {
  return { personId: "p1", isSuperadmin: isSuper, grants };
}

function grant(over: Partial<Grant>): Grant {
  return {
    permission: "mark_attendance",
    anchorPath: PARK_X,
    functionId: null,
    cityId: null,
    ...over,
  };
}

describe("canActOn — subtree scoping", () => {
  it("allows a target inside the anchor subtree", () => {
    const c = ctx([grant({ anchorPath: PARK_X })]);
    expect(canActOn(c, "mark_attendance", { path: CLASS_IN_X, functionId: null })).toBe(true);
  });

  it("denies a target outside the anchor subtree", () => {
    const c = ctx([grant({ anchorPath: PARK_X })]);
    expect(canActOn(c, "mark_attendance", { path: ISB, functionId: null })).toBe(false);
  });

  it("denies the wrong permission even inside the subtree", () => {
    const c = ctx([grant({ anchorPath: PARK_X, permission: "mark_attendance" })]);
    expect(canActOn(c, "create_event", { path: CLASS_IN_X, functionId: null })).toBe(false);
  });

  it("trailing delimiter prevents parkX matching parkX2", () => {
    const c = ctx([grant({ anchorPath: PARK_X })]);
    expect(canActOn(c, "mark_attendance", { path: PARK_X2, functionId: null })).toBe(false);
  });
});

describe("canActOn — function filter", () => {
  it("cross-functional grant (null) matches any function", () => {
    const c = ctx([grant({ functionId: null })]);
    expect(canActOn(c, "mark_attendance", { path: CLASS_IN_X, functionId: "fn-sports" })).toBe(true);
  });

  it("function-scoped grant matches only its function", () => {
    const c = ctx([grant({ functionId: "fn-sports" })]);
    expect(canActOn(c, "mark_attendance", { path: CLASS_IN_X, functionId: "fn-sports" })).toBe(true);
    expect(canActOn(c, "mark_attendance", { path: CLASS_IN_X, functionId: "fn-tarbiya" })).toBe(false);
  });
});

describe("canActOn — superadmin & multi-position", () => {
  it("a grant anchored at the global root reaches everything", () => {
    const c = ctx([grant({ anchorPath: ROOT, permission: "manage_city" })], true);
    expect(canActOn(c, "manage_city", { path: PARK_X2, functionId: "fn-skills" })).toBe(true);
    expect(isSuperadmin(c)).toBe(true);
  });

  it("multi-position authority is the union of grants", () => {
    const c = ctx([
      grant({ anchorPath: PARK_X, permission: "mark_attendance" }),
      grant({ anchorPath: "/root/isb/parkY/", permission: "create_event" }),
    ]);
    expect(canActOn(c, "mark_attendance", { path: CLASS_IN_X, functionId: null })).toBe(true);
    expect(canActOn(c, "create_event", { path: "/root/isb/parkY/classB/", functionId: null })).toBe(true);
    // but not crossed over
    expect(canActOn(c, "create_event", { path: CLASS_IN_X, functionId: null })).toBe(false);
  });
});

describe("requirePermission", () => {
  it("throws ForbiddenError when denied", () => {
    const c = ctx([grant({ anchorPath: PARK_X })]);
    expect(() => requirePermission(c, "mark_attendance", { path: ISB, functionId: null })).toThrow(
      ForbiddenError,
    );
  });

  it("does not throw when allowed", () => {
    const c = ctx([grant({ anchorPath: PARK_X })]);
    expect(() =>
      requirePermission(c, "mark_attendance", { path: CLASS_IN_X, functionId: null }),
    ).not.toThrow();
  });
});
