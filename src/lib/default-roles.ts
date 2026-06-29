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
];

export function rolesForLevel(levelKey: string): RoleDef[] {
  return DEFAULT_ROLES.filter((r) => r.attachLevelKey === levelKey);
}

export function findRole(roleKey: string): RoleDef | undefined {
  return DEFAULT_ROLES.find((r) => r.canonicalKey === roleKey);
}

// Nodes a given role can attach to (those at the role's level). Used by the Move
// modal to offer valid target nodes.
export function nodesForRole<T extends { level: { key: string } }>(
  nodes: T[],
  role: Pick<RoleDef, "attachLevelKey">,
): T[] {
  return nodes.filter((n) => n.level.key === role.attachLevelKey);
}
