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
// assignment node's name for context — the reports people-search. When `nodePath`
// is given, the result is scoped to people with an active assignment anywhere under
// that node's subtree (the node-report's people-search can't leak past the node).
export async function searchInCity(
  cityId: string,
  query: string,
  limit: number,
  nodePath?: string,
): Promise<PersonSearchResult[]> {
  const rows = await prisma.person.findMany({
    where: {
      cityId,
      name: { contains: query, mode: "insensitive" },
      ...(nodePath
        ? { assignments: { some: { endDate: null, orgNode: { path: { startsWith: nodePath } } } } }
        : {}),
    },
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

export type NodePersonInfo = { id: string; name: string; role: string | null };

// Names + a role label (from an active assignment under `nodePath`) for a set of
// person ids — the node-report's people list, resolved after the ids are already
// narrowed to the bounded triage slice.
export async function listByIdsWithNodeRole(
  ids: string[],
  nodePath: string,
): Promise<NodePersonInfo[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.person.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      assignments: {
        where: { endDate: null, orgNode: { path: { startsWith: nodePath } } },
        take: 1,
        select: { position: { select: { label: true } } },
      },
    },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.assignments[0]?.position.label ?? null }));
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
