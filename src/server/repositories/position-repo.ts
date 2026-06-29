// Position data access. A per-city Position points at a global canonical position
// and carries a permission grant set; the position's SCOPE (the subtree, via the
// assignment's anchor) is what bounds the authority (§12) — the grant set itself
// is the same wherever the role is used.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

const CITY_ADMIN_CANONICAL_KEY = "city_admin";

const CITY_ADMIN_PERMISSION_KEYS = [
  "manage_hierarchy",
  "add_member",
  "approve_member",
  "create_event",
  "mark_attendance",
  "view_attendance",
  "manage_city",
];

// Find (or create) the per-city Position for a canonical role, granting the given
// permissions on first creation. Idempotent per (cityId, canonical).
export async function findOrCreateRolePosition(
  cityId: string,
  canonicalKey: string,
  permissionKeys: string[],
  db: Db = prisma,
): Promise<{ id: string }> {
  const canonical = await db.canonicalPosition.findUnique({
    where: { key: canonicalKey },
    select: { id: true, label: true, rank: true },
  });
  if (!canonical) {
    throw new Error(`Canonical position "${canonicalKey}" is missing — run the seed.`);
  }

  const existing = await db.position.findFirst({
    where: { cityId, canonicalId: canonical.id },
    select: { id: true },
  });
  if (existing) return existing;

  const permissions = permissionKeys.length
    ? await db.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true } })
    : [];

  return db.position.create({
    data: {
      cityId,
      canonicalId: canonical.id,
      label: canonical.label,
      rank: canonical.rank,
      functionId: null,
      permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
    },
    select: { id: true },
  });
}

export function findOrCreateCityAdminPosition(
  cityId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  return findOrCreateRolePosition(cityId, CITY_ADMIN_CANONICAL_KEY, CITY_ADMIN_PERMISSION_KEYS, db);
}
