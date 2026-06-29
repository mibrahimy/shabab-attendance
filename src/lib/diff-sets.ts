// Pure set diff: what to add and remove to turn `current` into `next`.
export function diffSets<T>(current: T[], next: T[]): { add: T[]; remove: T[] } {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    add: next.filter((x) => !cur.has(x)),
    remove: current.filter((x) => !nxt.has(x)),
  };
}
