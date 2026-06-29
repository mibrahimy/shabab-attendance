// Pure helpers for the level template (Zone→Sector→Park→Class). A node's allowed
// child level is the template entry one rank deeper than the node's own level; a
// leaf (deepest rank, e.g. Class) has none. Kept DB-free for unit testing.

export type Level = {
  id: string; // NodeType id (per-city)
  key: string; // canonical key: zone | sector | park | class | city | ...
  label: string;
  rank: number; // canonical rank
};

// The level to use for a new child under a parent at `parentRank`, or null if the
// parent is the deepest level in the template (no children allowed).
export function nextLevel(template: Level[], parentRank: number): Level | null {
  const deeper = template
    .filter((l) => l.rank > parentRank)
    .sort((a, b) => a.rank - b.rank);
  return deeper[0] ?? null;
}
