import { describe, it, expect } from "vitest";
import { diffSets } from "./diff-sets";

describe("diffSets", () => {
  it("computes adds and removes", () => {
    expect(diffSets(["a", "b", "c"], ["b", "c", "d"])).toEqual({ add: ["d"], remove: ["a"] });
  });

  it("empty when identical (order-insensitive membership)", () => {
    expect(diffSets(["x", "y"], ["y", "x"])).toEqual({ add: [], remove: [] });
  });

  it("clearing all removes everything", () => {
    expect(diffSets(["a", "b"], [])).toEqual({ add: [], remove: ["a", "b"] });
  });

  it("from empty adds everything", () => {
    expect(diffSets([], ["a", "b"])).toEqual({ add: ["a", "b"], remove: [] });
  });
});
