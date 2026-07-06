// Pure helpers for the city dashboard summary — no React, no Prisma.

export type LevelCount = { key: string; label: string; count: number };

type LevelLike = { key: string; label: string; rank: number };
type NodeLike = { level: { key: string } };

// Count nodes per level (excluding the city level itself), ordered by level rank.
// Levels with zero nodes are still returned — informative while a tree is being
// built (e.g. "0 classes").
export function summarizeLevels(nodes: NodeLike[], levels: LevelLike[]): LevelCount[] {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.level.key, (counts.get(n.level.key) ?? 0) + 1);
  return levels
    .filter((l) => l.key !== "city")
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((l) => ({ key: l.key, label: l.label, count: counts.get(l.key) ?? 0 }));
}
