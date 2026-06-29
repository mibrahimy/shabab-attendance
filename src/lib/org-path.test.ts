import { describe, it, expect } from "vitest";
import { rootPath, buildChildPath, childDepth } from "./org-path";

describe("org-path", () => {
  it("root path is trailing-delimited", () => {
    expect(rootPath("root")).toBe("/root/");
  });

  it("builds nested child paths with trailing delimiter", () => {
    const root = rootPath("root");
    const pk = buildChildPath(root, "pk");
    const cls = buildChildPath(pk, "cls");
    expect(pk).toBe("/root/pk/");
    expect(cls).toBe("/root/pk/cls/");
  });

  it("a path never prefix-matches a sibling whose id shares a prefix", () => {
    const root = rootPath("root");
    const parkX = buildChildPath(root, "parkX");
    const parkX2 = buildChildPath(root, "parkX2");
    expect(parkX2.startsWith(parkX)).toBe(false);
  });

  it("depth increments by one", () => {
    expect(childDepth(0)).toBe(1);
    expect(childDepth(2)).toBe(3);
  });
});
