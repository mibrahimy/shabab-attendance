// Pure helpers for the level template (Zone→Sector→Park→Class). A node's allowed
// child level is the template entry one rank deeper than the node's own level; a
// leaf (deepest rank, e.g. Class) has none. Kept DB-free for unit testing.

export type Level = {
  id: string; // NodeType id (per-city)
  key: string; // level key: zone | sector | park | class | city | <custom> | ...
  label: string;
  rank: number; // level rank (order in the template)
  color?: string | null; // per-level badge color (data-driven)
  headPositionKey?: string | null; // the role key that heads this level
};

// The level to use for a new child under a parent at `parentRank`, or null if the
// parent is the deepest level in the template (no children allowed).
export function nextLevel(template: Level[], parentRank: number): Level | null {
  const deeper = template
    .filter((l) => l.rank > parentRank)
    .sort((a, b) => a.rank - b.rank);
  return deeper[0] ?? null;
}

// The head role keys that define a node's derived TEAM, given the city's level
// template and the node's NodeType id: the node's own head, plus the head of its
// direct-child level. Mirrors getNodeTeam's resolution but kept pure (DB-free) so
// both the team view and the team-roster resolver share one source of truth.
// headForNode null ⇒ this level has no head role, so it has no team (and team
// attendance isn't available there).
export function teamHeadKeys(
  template: Level[],
  typeId: string,
): { headForNode: string | null; headForChild: string | null } {
  const nodeLevel = template.find((l) => l.id === typeId);
  if (!nodeLevel) return { headForNode: null, headForChild: null };
  const child = nextLevel(template, nodeLevel.rank);
  return {
    headForNode: nodeLevel.headPositionKey ?? null,
    headForChild: child?.headPositionKey ?? null,
  };
}
