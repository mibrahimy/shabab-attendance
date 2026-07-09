// Materialized-path helpers for the OrgNode tree. Pure (no DB) so they can be unit
// tested. Paths are TRAILING-DELIMITED ("/{root}/{child}/") so a prefix can never
// partially match a sibling (e.g. "/a/parkX/" vs "/a/parkX2/") — see §12.

export const PATH_DELIMITER = "/";

export function rootPath(id: string): string {
  return `${PATH_DELIMITER}${id}${PATH_DELIMITER}`;
}

export function buildChildPath(parentPath: string, childId: string): string {
  // parentPath already ends with the delimiter; just append "{id}/".
  return `${parentPath}${childId}${PATH_DELIMITER}`;
}

export function childDepth(parentDepth: number): number {
  return parentDepth + 1;
}

// Rewrite a descendant's path when its subtree root moves. Every path in the moving
// subtree starts with `oldPrefix` (the moved node's old path); replace that prefix
// with the node's new path. Pure so the move can be unit-tested; the DB does the
// same rewrite in one UPDATE. (The moved node itself has path === oldPrefix → newNodePath.)
export function rewriteSubtreePath(path: string, oldPrefix: string, newNodePath: string): string {
  return newNodePath + path.slice(oldPrefix.length);
}
