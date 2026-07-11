// Position data access. A per-city Position points at a global canonical position
// and carries a permission grant set; the position's SCOPE (the subtree, via the
// assignment's anchor) is what bounds the authority (§12) — the grant set itself
// is the same wherever the role is used.

import { prisma } from "@/server/db";
import { diffSets } from "@/lib/diff-sets";
import { PROTECTED_CANONICAL_KEYS } from "@/lib/default-roles";
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

  try {
    return await db.position.create({
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
  } catch (err) {
    // Lost the create race against a concurrent caller — the @@unique([cityId,
    // canonicalId]) rejects the duplicate; the row the winner made is what we want.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      const winner = await db.position.findFirst({
        where: { cityId, canonicalId: canonical.id },
        select: { id: true },
      });
      if (winner) return winner;
    }
    throw err;
  }
}

export function findOrCreateCityAdminPosition(
  cityId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  return findOrCreateRolePosition(cityId, CITY_ADMIN_CANONICAL_KEY, CITY_ADMIN_PERMISSION_KEYS, db);
}

// City-level canonical roles a city admin may edit (everything except the
// national superadmin and the admin's own city_admin role).
export async function listEditableCanonicals(): Promise<{ key: string; label: string }[]> {
  return prisma.canonicalPosition.findMany({
    where: { key: { notIn: [...PROTECTED_CANONICAL_KEYS] } },
    orderBy: { rank: "asc" },
    select: { key: true, label: true },
  });
}

export type CityPosition = {
  id: string;
  canonicalKey: string;
  label: string;
  permissionKeys: string[];
};

// All instantiated positions for a city, with their current permission grants.
export async function listCityPositions(cityId: string): Promise<CityPosition[]> {
  const rows = await prisma.position.findMany({
    where: { cityId },
    select: {
      id: true,
      label: true,
      key: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    canonicalKey: r.key ?? "",
    label: r.label,
    permissionKeys: r.permissions.map((p) => p.permission.key),
  }));
}

// Replace a position's permission grants with exactly `permissionKeys` (add the
// missing, remove the extras).
export async function setPermissions(
  positionId: string,
  permissionKeys: string[],
  db: Db = prisma,
): Promise<void> {
  const [current, target] = await Promise.all([
    db.positionPermission.findMany({
      where: { positionId },
      select: { permissionId: true },
    }),
    db.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    }),
  ]);
  const { add: toAdd, remove: toRemove } = diffSets(
    current.map((c) => c.permissionId),
    target.map((p) => p.id),
  );

  if (toRemove.length) {
    await db.positionPermission.deleteMany({
      where: { positionId, permissionId: { in: toRemove } },
    });
  }
  if (toAdd.length) {
    await db.positionPermission.createMany({
      data: toAdd.map((permissionId) => ({ positionId, permissionId })),
    });
  }
}
