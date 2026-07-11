// NodeType data access. National node types (cityId = null) are seeded; per-city
// node types are created from the default template when a city is built.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

export async function findNationalByCanonicalKey(key: string): Promise<{ id: string } | null> {
  return prisma.nodeType.findFirst({
    where: { cityId: null, canonical: { key } },
    select: { id: true },
  });
}

export type CityLevel = {
  id: string; key: string; label: string; rank: number;
  color: string | null; headPositionKey: string | null;
};

// The default per-city level template, in order. Admins reshape it per city via the
// level editor (structure-service); this is only the starting point for a new city.
const TEMPLATE_CANONICAL_KEYS = ["zone", "park", "class"];

// Idempotently create the per-city NodeType rows for the default template.
// Fast path: one query confirms the template is already present (the common case
// on every hierarchy load) and returns. Only when levels are missing do we fetch
// the canonicals and batch-insert them.
export async function ensureCityTemplate(cityId: string, db: Db = prisma): Promise<void> {
  const existing = await db.nodeType.findMany({
    where: { cityId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key).filter((k): k is string => k != null));
  const missing = TEMPLATE_CANONICAL_KEYS.filter((k) => !have.has(k));
  if (missing.length === 0) return;

  const canonicals = await db.canonicalNodeType.findMany({
    where: { key: { in: missing } },
    select: { id: true, label: true, rank: true },
  });
  await db.nodeType.createMany({
    // skipDuplicates: idempotent under a concurrent first load (two requests can
    // both compute the same `missing` set; the unique [cityId, canonicalId] would
    // otherwise make the second insert throw).
    data: canonicals.map((c) => ({ cityId, canonicalId: c.id, label: c.label, rank: c.rank })),
    skipDuplicates: true,
  });
}

// The levels available in a city: that city's template NodeTypes (plus the
// national "city" type so the city node's own level is known), with canonical key/rank.
export async function listCityLevels(cityId: string): Promise<CityLevel[]> {
  const rows = await prisma.nodeType.findMany({
    where: { OR: [{ cityId }, { cityId: null, key: "city" }] },
    select: { id: true, label: true, rank: true, key: true, color: true, headPositionKey: true },
    orderBy: { rank: "asc" },
  });
  return rows.map((r) => ({
    id: r.id, key: r.key ?? "", label: r.label, rank: r.rank,
    color: r.color, headPositionKey: r.headPositionKey,
  }));
}

// ── Level editor data access (per-city NodeTypes; the national city/country/root
// types are not editable) ──────────────────────────────────────────────────────

export type EditableLevel = CityLevel & { canonicalId: string | null };

export async function listEditableLevels(cityId: string): Promise<EditableLevel[]> {
  const rows = await prisma.nodeType.findMany({
    where: { cityId },
    select: { id: true, label: true, rank: true, key: true, color: true, headPositionKey: true, canonicalId: true },
    orderBy: { rank: "asc" },
  });
  return rows.map((r) => ({
    id: r.id, key: r.key ?? "", label: r.label, rank: r.rank,
    color: r.color, headPositionKey: r.headPositionKey, canonicalId: r.canonicalId,
  }));
}

// The national "city" level rank — per-city levels sit below it.
export async function cityLevelRank(): Promise<number> {
  const row = await prisma.nodeType.findFirst({ where: { cityId: null, key: "city" }, select: { rank: true } });
  return row?.rank ?? 2;
}

// OrgNode count per NodeType in a city (delete guard: a level in use can't be removed).
export async function countNodesByType(cityId: string): Promise<Map<string, number>> {
  const rows = await prisma.orgNode.groupBy({ by: ["typeId"], where: { cityId }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.typeId, r._count._all]));
}

export async function keyExistsInCity(cityId: string, key: string, db: Db = prisma): Promise<boolean> {
  return (await db.nodeType.count({ where: { cityId, key } })) > 0;
}

export async function createLevel(
  input: { cityId: string; key: string; label: string; rank: number; color: string | null; headPositionKey: string | null },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.nodeType.create({
    data: { cityId: input.cityId, canonicalId: null, key: input.key, label: input.label, rank: input.rank, color: input.color, headPositionKey: input.headPositionKey },
    select: { id: true },
  });
}

export async function updateLevel(
  id: string,
  data: { label?: string; color?: string | null; headPositionKey?: string | null; rank?: number },
  db: Db = prisma,
): Promise<void> {
  await db.nodeType.update({ where: { id }, data });
}

export async function deleteLevel(id: string, db: Db = prisma): Promise<void> {
  await db.nodeType.delete({ where: { id } });
}
