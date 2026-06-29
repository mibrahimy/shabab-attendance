// The ONE permission rule (ENGINEERING.md §12). Pure, in-memory, zero-DB: given a
// resolved AuthzContext, a permission, and a target node, decide allow/deny.
//
// A person may do X on target T iff they hold a grant for X whose anchor subtree
// contains T (materialized-path prefix) AND whose function matches (or is
// cross-functional). Multi-position falls out for free as the union of grants;
// superadmin is just a grant anchored at the global root.

import type { AuthzContext, PermissionTarget } from "@/types/auth";
import { ForbiddenError } from "@/server/errors";

export function canActOn(
  ctx: AuthzContext,
  permission: string,
  target: PermissionTarget,
): boolean {
  return ctx.grants.some(
    (g) =>
      g.permission === permission &&
      // Subtree = path prefix. Both paths are trailing-delimited (".../parkX/"),
      // so "/a/parkX/" can never prefix-match "/a/parkX2/".
      target.path.startsWith(g.anchorPath) &&
      (g.functionId === null || g.functionId === target.functionId),
  );
}

export function isSuperadmin(ctx: AuthzContext): boolean {
  return ctx.isSuperadmin;
}

// Service-side guard for single-target mutations: throw 403 when not permitted.
export function requirePermission(
  ctx: AuthzContext,
  permission: string,
  target: PermissionTarget,
): void {
  if (!canActOn(ctx, permission, target)) {
    throw new ForbiddenError();
  }
}
