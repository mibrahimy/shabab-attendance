import { describe, it, expect } from "vitest";
import { rootPath, buildChildPath, childDepth, rewriteSubtreePath } from "./org-path";

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

  describe("rewriteSubtreePath (moving a subtree)", () => {
    // Move node N from under A to under B: oldPrefix "/root/A/N/" → newNodePath "/root/B/N/".
    const oldPrefix = "/root/A/N/";
    const newNodePath = "/root/B/N/";

    it("rewrites the moved node's own path", () => {
      expect(rewriteSubtreePath("/root/A/N/", oldPrefix, newNodePath)).toBe("/root/B/N/");
    });

    it("rewrites descendants, preserving the tail below the moved node", () => {
      expect(rewriteSubtreePath("/root/A/N/x/", oldPrefix, newNodePath)).toBe("/root/B/N/x/");
      expect(rewriteSubtreePath("/root/A/N/x/y/", oldPrefix, newNodePath)).toBe("/root/B/N/x/y/");
    });

    it("keeps every rewritten path trailing-delimited and prefixed by the new node path", () => {
      const out = rewriteSubtreePath("/root/A/N/x/y/", oldPrefix, newNodePath);
      expect(out.startsWith(newNodePath)).toBe(true);
      expect(out.endsWith("/")).toBe(true);
    });
  });
});
