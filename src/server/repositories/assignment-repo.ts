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

export async function existsActive(
  personId: string,
  positionId: string,
  orgNodeId: string,
): Promise<boolean> {
  const count = await prisma.assignment.count({
    where: { personId, positionId, orgNodeId, endDate: null },
  });
  return count > 0;
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
