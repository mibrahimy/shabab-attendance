// Assignment data access — attaches a Person to a Position at an OrgNode anchor.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

export async function create(
  input: {
    personId: string;
    positionId: string;
    orgNodeId: string;
    cityId?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.assignment.create({
    data: {
      personId: input.personId,
      positionId: input.positionId,
      orgNodeId: input.orgNodeId,
      cityId: input.cityId ?? null,
    },
    select: { id: true },
  });
}

export async function findActiveById(id: string): Promise<{
  id: string;
  personId: string;
  orgNodeId: string;
  cityId: string | null;
  roleKey: string;
} | null> {
  const row = await prisma.assignment.findFirst({
    where: { id, endDate: null },
    select: {
      id: true,
      personId: true,
      orgNodeId: true,
      cityId: true,
      position: { select: { canonical: { select: { key: true } } } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    personId: row.personId,
    orgNodeId: row.orgNodeId,
    cityId: row.cityId,
    roleKey: row.position.canonical.key,
  };
}

export async function endAssignment(id: string, db: Db = prisma): Promise<void> {
  await db.assignment.update({ where: { id }, data: { endDate: new Date() } });
}

export type NodeMember = {
  assignmentId: string;
  personId: string;
  name: string;
  segment: "junior" | "senior" | null;
  roleKey: string;
  roleLabel: string;
  hasLogin: boolean;
};

// Active assignments at a node, with the person + role + whether they have a login.
export async function listActiveByNode(orgNodeId: string): Promise<NodeMember[]> {
  const rows = await prisma.assignment.findMany({
    where: { orgNodeId, endDate: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      person: {
        select: { id: true, name: true, segment: true, user: { select: { id: true } } },
      },
      position: { select: { label: true, canonical: { select: { key: true } } } },
    },
  });
  return rows.map((r) => ({
    assignmentId: r.id,
    personId: r.person.id,
    name: r.person.name,
    segment: r.person.segment,
    roleKey: r.position.canonical.key,
    roleLabel: r.position.label,
    hasLogin: r.person.user !== null,
  }));
}
