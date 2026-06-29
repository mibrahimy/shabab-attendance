# `auth/` — session + permission resolution

Session handling and the per-request authorization context.

What lands here (Phase 1, per ENGINEERING.md §12):

- **Authentication**: `jose` JWT verify, `requireSession`, the ~8h sliding session.
- **Authorization**: resolve the `AuthzContext` **once per request** (memoized via React
  `cache()`) from one query (active Assignments ⋈ PositionPermissions ⋈ anchor OrgNode),
  then the pure in-memory `canActOn(ctx, permission, target)` prefix-check.

Middleware stays **authn-only** (signature/expiry on the edge, no DB, no authz).

This file holds the folder open.
