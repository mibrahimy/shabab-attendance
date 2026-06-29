// Position data access. A per-city "City Admin" position points at the global
// canonical position and is granted the full city-management permission set; the
// position's scope (the city subtree, via the assignment's anchor) is what bounds
// it (§12) — the grant set itself is the same everywhere.

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

export async function findOrCreateCityAdminPosition(
  cityId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  const canonical = await db.canonicalPosition.findUnique({
    where: { key: CITY_ADMIN_CANONICAL_KEY },
    select: { id: true, label: true, rank: true },
  });
  if (!canonical) {
    throw new Error(`Canonical position "${CITY_ADMIN_CANONICAL_KEY}" is missing — run the seed.`);
  }

  const existing = await db.position.findFirst({
    where: { cityId, canonicalId: canonical.id },
    select: { id: true },
  });
  if (existing) return existing;

  const permissions = await db.permission.findMany({
    where: { key: { in: CITY_ADMIN_PERMISSION_KEYS } },
    select: { id: true },
  });

  return db.position.create({
    data: {
      cityId,
      canonicalId: canonical.id,
      label: canonical.label,
      rank: canonical.rank,
      functionId: null,
      permissions: {
        create: permissions.map((p) => ({ permissionId: p.id })),
      },
    },
    select: { id: true },
  });
}
