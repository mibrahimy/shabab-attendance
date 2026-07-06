// Pure tree-navigation helpers for the hierarchy overview — no React.

type Node = { id: string; name: string; parentId: string | null };

// Nodes whose name contains the query (case-insensitive), for the overview search.
// Empty/blank query → no matches (the caller shows the outline instead).
export function matchNodes<T extends Node>(nodes: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return nodes.filter((n) => n.name.toLowerCase().includes(q));
}

// The ancestor-name breadcrumb for a node (root → … → node's parent), used to
// disambiguate search hits. Walks parentId via a lookup map.
export function breadcrumb<T extends Node>(byId: Map<string, T>, node: T): string[] {
  const names: string[] = [];
  let cur = node.parentId ? byId.get(node.parentId) : undefined;
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return names;
}
