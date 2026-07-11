// Default role catalog for direct-add (Phase 2 chunk 3). These are SEEDED DEFAULTS
// the city admin can refine later — the full position/permission catalog is still
// an open product decision. Each role is created as a per-city Position (pointing
// at its canonical) with the listed permission grants when first used; scoping
// (the assignment's anchor subtree) is what bounds the authority, per §12.
//
// A role attaches at the org level matching `attachLevelKey` (the node's canonical
// level key), so a node offers exactly the roles valid for its level.

export type RoleDef = {
  canonicalKey: string; // CanonicalPosition.key
  label: string;
  attachLevelKey: string; // CanonicalNodeType.key the role attaches at
  permissionKeys: string[]; // Permission.keys granted to the position
  isStudent: boolean; // profile-only (no User/login, CNIC optional)
};

export const DEFAULT_ROLES: RoleDef[] = [
  {
    canonicalKey: "student",
    label: "Student",
    attachLevelKey: "class",
    permissionKeys: [],
    isStudent: true,
  },
  {
    canonicalKey: "murabbi",
    label: "Murabbi",
    attachLevelKey: "class",
    permissionKeys: ["create_event", "mark_attendance", "view_attendance"],
    isStudent: false,
  },
  {
    canonicalKey: "park_admin",
    label: "Park Admin",
    attachLevelKey: "park",
    permissionKeys: [
      "manage_hierarchy",
      "add_member",
      "create_event",
      "mark_attendance",
      "view_attendance",
    ],
    isStudent: false,
  },
  // Level leads — the head of each level (see HEAD_CANONICAL_BY_LEVEL). Adding these
  // also lets Zones/Sectors/Countries be staffed at all (they had no attachable role).
  {
    canonicalKey: "sector_lead",
    label: "Sector Lead",
    attachLevelKey: "sector",
    permissionKeys: ["manage_hierarchy", "add_member", "create_event", "mark_attendance", "view_attendance"],
    isStudent: false,
  },
  {
    canonicalKey: "zone_lead",
    label: "Zone Lead",
    attachLevelKey: "zone",
    permissionKeys: ["manage_hierarchy", "add_member", "create_event", "mark_attendance", "view_attendance"],
    isStudent: false,
  },
  {
    canonicalKey: "country_lead",
    label: "Country Lead",
    attachLevelKey: "country",
    permissionKeys: ["manage_hierarchy", "add_member", "create_event", "mark_attendance", "view_attendance"],
    isStudent: false,
  },
  // City-level staff (a point of contact / coordinator) — lets the city node itself
  // be staffed. The city HEAD is still city_admin (onboarding-only, protected).
  {
    canonicalKey: "city_poc",
    label: "City POC",
    attachLevelKey: "city",
    permissionKeys: ["create_event", "mark_attendance", "view_attendance"],
    isStudent: false,
  },
];

// The single "head" position at each level. A node's TEAM = its own head + the
// heads of its direct children (derived from live Assignments — see the hierarchy
// service). Ops Lead is the superadmin; City Lead is the city_admin.
export const HEAD_CANONICAL_BY_LEVEL: Record<string, string> = {
  "global-root": "superadmin",
  country: "country_lead",
  city: "city_admin",
  zone: "zone_lead",
  sector: "sector_lead",
  park: "park_admin",
  class: "murabbi",
};

export function rolesForLevel(levelKey: string): RoleDef[] {
  return DEFAULT_ROLES.filter((r) => r.attachLevelKey === levelKey);
}

// The level a canonical role attaches at: a member role's own attachLevelKey, or —
// for head roles not in DEFAULT_ROLES (city_admin, superadmin) — the level it heads.
// Used to stamp Position.attachLevelKey when a role is first instantiated.
export function attachLevelForRole(canonicalKey: string): string | null {
  const role = DEFAULT_ROLES.find((r) => r.canonicalKey === canonicalKey);
  if (role) return role.attachLevelKey;
  const headed = Object.entries(HEAD_CANONICAL_BY_LEVEL).find(([, head]) => head === canonicalKey);
  return headed ? headed[0] : null;
}

export function findRole(roleKey: string): RoleDef | undefined {
  return DEFAULT_ROLES.find((r) => r.canonicalKey === roleKey);
}

// System-managed roles: never editable in the city roles catalog and never
// removable/movable via the member endpoints (the national superadmin, and the
// city_admin which is provisioned by the onboarding cascade). Single source of
// truth for both the editor's filter and the member-endpoint guard.
export const PROTECTED_CANONICAL_KEYS = ["superadmin", "city_admin"] as const;

export function isProtectedRole(canonicalKey: string): boolean {
  return (PROTECTED_CANONICAL_KEYS as readonly string[]).includes(canonicalKey);
}

// Nodes a given role can attach to (those at the role's level). Used by the Move
// modal to offer valid target nodes.
export function nodesForRole<T extends { level: { key: string } }>(
  nodes: T[],
  role: Pick<RoleDef, "attachLevelKey">,
): T[] {
  return nodes.filter((n) => n.level.key === role.attachLevelKey);
}
