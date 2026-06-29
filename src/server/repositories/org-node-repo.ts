// OrgNode data access. Paths/depths are computed from the parent so callers never
// hand-build them. Only Prisma layer.

import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { Prisma } from "../../../prisma/generated/v2-client";
import { buildChildPath, childDepth } from "@/lib/org-path";

// A repo write can run on the base client or inside an interactive transaction
// (PrismaClient is assignable to TransactionClient), so cross-aggregate use-cases
// stay atomic while Prisma stays in the repo layer.
export type Db = Prisma.TransactionClient;

export type OrgNodeRow = {
  id: string;
  name: string;
  path: string;
  depth: number;
  parentId: string | null;
  typeId: string;
  countryId: string | null;
  cityId: string | null;
};

const baseSelect = {
  id: true,
  name: true,
  path: true,
  depth: true,
  parentId: true,
  typeId: true,
  countryId: true,
  cityId: true,
} as const;

export async function findById(id: string): Promise<OrgNodeRow | null> {
  return prisma.orgNode.findUnique({ where: { id }, select: baseSelect });
}

// Create a child node, computing path/depth and denormalized ancestor keys from
// the parent. `isCity`/`isCountry` set the denorm keys to this node's own id at
// the city/country level (since the keys point at the ancestor of that type).
export async function createChild(
  input: {
    parent: OrgNodeRow;
    typeId: string;
    name: string;
    asCountry?: boolean;
    asCity?: boolean;
  },
  db: Db = prisma,
): Promise<OrgNodeRow> {
  const { parent, typeId, name, asCountry, asCity } = input;
  // Generate the id up-front so the trailing-delimited path is known in a single
  // insert (no create-then-update round trip).
  const id = randomUUID();
  return db.orgNode.create({
    data: {
      id,
      name,
      typeId,
      parentId: parent.id,
      depth: childDepth(parent.depth),
      path: buildChildPath(parent.path, id),
      countryId: asCountry ? id : parent.countryId,
      cityId: asCity ? id : parent.cityId,
    },
    select: baseSelect,
  });
}

export async function listRoots(): Promise<OrgNodeRow[]> {
  // The single global root (seeded). Countries hang under it.
  return prisma.orgNode.findMany({ where: { parentId: null }, select: baseSelect });
}

export async function listChildren(parentId: string): Promise<OrgNodeRow[]> {
  return prisma.orgNode.findMany({
    where: { parentId },
    orderBy: { name: "asc" },
    select: baseSelect,
  });
}

// Countries (children of the global root) with their cities — for the Cities page.
export type CountryWithCities = OrgNodeRow & { cities: OrgNodeRow[] };

export async function listCountriesWithCities(): Promise<CountryWithCities[]> {
  const root = await prisma.orgNode.findFirst({ where: { parentId: null }, select: { id: true } });
  if (!root) return [];
  const countries = await prisma.orgNode.findMany({
    where: { parentId: root.id },
    orderBy: { name: "asc" },
    select: { ...baseSelect, children: { orderBy: { name: "asc" }, select: baseSelect } },
  });
  return countries.map(({ children, ...c }) => ({ ...c, cities: children }));
}

// A node enriched with its level (for the hierarchy builder's chips + child-type
// resolution).
export type SubtreeNode = OrgNodeRow & {
  level: { key: string; label: string; rank: number };
};

// Every node at or below `path` (one indexed prefix scan). Bounded per city.
export async function listSubtree(path: string): Promise<SubtreeNode[]> {
  const rows = await prisma.orgNode.findMany({
    where: { path: { startsWith: path } },
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    select: {
      ...baseSelect,
      type: { select: { label: true, rank: true, canonical: { select: { key: true } } } },
    },
  });
  return rows.map(({ type, ...n }) => ({
    ...n,
    level: { key: type.canonical.key, label: type.label, rank: type.rank },
  }));
}

export async function hasChildren(nodeId: string): Promise<boolean> {
  const count = await prisma.orgNode.count({ where: { parentId: nodeId } });
  return count > 0;
}

export async function countAssignments(nodeId: string): Promise<number> {
  return prisma.assignment.count({ where: { orgNodeId: nodeId } });
}

export async function rename(nodeId: string, name: string): Promise<OrgNodeRow> {
  return prisma.orgNode.update({ where: { id: nodeId }, data: { name }, select: baseSelect });
}

export async function remove(nodeId: string): Promise<void> {
  await prisma.orgNode.delete({ where: { id: nodeId } });
}
