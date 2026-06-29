// Auth contracts shared by frontend and backend (ENGINEERING.md §7). Pure types —
// no React, no Prisma. The JWT carries IDENTITY ONLY; permissions/assignments are
// resolved per request into an AuthzContext (never put in the token — §12).

// JWT claims. Kept minimal and stable; `mcp`/`v` drive the forced-password-change
// gate and tokenVersion revocation respectively.
export type SessionClaims = {
  sub: string; // userId
  pid: string; // personId
  cid: string | null; // home cityId (null for global/superadmin)
  mcp: boolean; // mustChangePassword
  v: number; // tokenVersion
};

// One row of authority: a permission granted over the subtree of an anchor
// OrgNode (by materialized path), optionally narrowed to a function.
export type Grant = {
  permission: string;
  anchorPath: string; // trailing-delimited materialized path of the anchor node
  functionId: string | null; // null = cross-functional
  cityId: string | null; // anchor node's city (null above city level)
};

// Resolved once per request (memoized) and used by the pure `canActOn` check.
export type AuthzContext = {
  personId: string;
  isSuperadmin: boolean; // holds a grant anchored at the global root
  grants: Grant[];
};

// The shape `canActOn` checks a permission against.
export type PermissionTarget = {
  path: string;
  functionId: string | null;
};

// ── API request/response contracts ──────────────────────────────────────────

export type LoginRequest = {
  identifier: string; // CNIC (new accounts) or email (legacy)
  password: string;
};

export type LoginResponse = {
  mustChangePassword: boolean;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};
