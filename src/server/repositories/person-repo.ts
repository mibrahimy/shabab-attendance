// Person data access.

import { prisma } from "@/server/db";
import { formatCnic } from "@/lib/cnic";
import type { Db } from "./org-node-repo";

type PersonStatus = "pending" | "active" | "rejected";
type Segment = "junior" | "senior";

// CNICs are stored and queried in one canonical (dashed 5-7-1) form so a lookup
// can't miss a row over dash/no-dash differences.
export async function findByCnic(cnic: string, db: Db = prisma): Promise<{ id: string } | null> {
  return db.person.findUnique({ where: { cnic: formatCnic(cnic) }, select: { id: true } });
}

export async function findById(id: string): Promise<{ id: string; name: string; cityId: string | null } | null> {
  return prisma.person.findUnique({ where: { id }, select: { id: true, name: true, cityId: true } });
}

export type PersonSearchResult = { id: string; name: string; nodeName: string | null };

// People in a city whose name matches `query` (case-insensitive), with a current
// assignment node's name for context — the reports people-search.
export async function searchInCity(
  cityId: string,
  query: string,
  limit: number,
): Promise<PersonSearchResult[]> {
  const rows = await prisma.person.findMany({
    where: { cityId, name: { contains: query, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      assignments: { where: { endDate: null }, take: 1, select: { orgNode: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, nodeName: r.assignments[0]?.orgNode.name ?? null }));
}

export async function create(
  input: {
    name: string;
    cnic?: string | null;
    phone?: string | null;
    segment?: Segment | null;
    status: PersonStatus;
    cityId?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.person.create({
    data: {
      name: input.name,
      cnic: input.cnic ? formatCnic(input.cnic) : null,
      phone: input.phone ?? null,
      segment: input.segment ?? null,
      status: input.status,
      cityId: input.cityId ?? null,
    },
    select: { id: true },
  });
}
