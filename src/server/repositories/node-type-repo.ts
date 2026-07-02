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

export type CityLevel = { id: string; key: string; label: string; rank: number };

// The default per-city level template, in order.
const TEMPLATE_CANONICAL_KEYS = ["zone", "sector", "park", "class"];

// Idempotently create the per-city NodeType rows for the default template.
// Fast path: one query confirms the template is already present (the common case
// on every hierarchy load) and returns. Only when levels are missing do we fetch
// the canonicals and batch-insert them.
export async function ensureCityTemplate(cityId: string, db: Db = prisma): Promise<void> {
  const existing = await db.nodeType.findMany({
    where: { cityId },
    select: { canonical: { select: { key: true } } },
  });
  const have = new Set(existing.map((e) => e.canonical.key));
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
    where: { OR: [{ cityId }, { cityId: null, canonical: { key: "city" } }] },
    select: { id: true, label: true, rank: true, canonical: { select: { key: true } } },
    orderBy: { rank: "asc" },
  });
  return rows.map((r) => ({ id: r.id, key: r.canonical.key, label: r.label, rank: r.rank }));
}
