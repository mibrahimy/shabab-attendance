// Assignment data access — attaches a Person to a Position at an OrgNode anchor.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

export type TeamMember = {
  personId: string; name: string; roleLabel: string; nodeId: string; nodeName: string; own: boolean;
};

// A node's TEAM: the head(s) anchored at the node itself (headForNode canonical)
// plus the heads of its DIRECT children (headForChild canonical). Derived live
// from active assignments — no Team table. `own` distinguishes the node's own head
// from the rolled-up child heads.
export async function listTeam(
  nodeId: string,
  headForNode: string,
  headForChild: string | null,
): Promise<TeamMember[]> {
  const rows = await prisma.assignment.findMany({
    where: {
      endDate: null,
      OR: [
        { orgNodeId: nodeId, position: { canonical: { key: headForNode } } },
        ...(headForChild
          ? [{ orgNode: { parentId: nodeId }, position: { canonical: { key: headForChild } } }]
          : []),
      ],
    },
    select: {
      orgNodeId: true,
      person: { select: { id: true, name: true } },
      position: { select: { label: true } },
      orgNode: { select: { name: true } },
    },
    orderBy: [{ orgNode: { name: "asc" } }, { person: { name: "asc" } }],
  });
  return rows.map((r) => ({
    personId: r.person.id, name: r.person.name, roleLabel: r.position.label,
    nodeId: r.orgNodeId, nodeName: r.orgNode.name, own: r.orgNodeId === nodeId,
  }));
}

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

// Count active assignments anywhere in a subtree (by the anchor's materialized
// path) — the "people in this city" number for the dashboard. One indexed scan.
export async function countActiveInSubtree(path: string): Promise<number> {
  return prisma.assignment.count({
    where: { endDate: null, orgNode: { path: { startsWith: path } } },
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
      position: { select: { key: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    personId: row.personId,
    orgNodeId: row.orgNodeId,
    cityId: row.cityId,
    roleKey: row.position.key ?? "",
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
      position: { select: { label: true, key: true } },
    },
  });
  return rows.map((r) => ({
    assignmentId: r.id,
    personId: r.person.id,
    name: r.person.name,
    segment: r.person.segment,
    roleKey: r.position.key ?? "",
    roleLabel: r.position.label,
    hasLogin: r.person.user !== null,
  }));
}
