// Hierarchy-builder use-cases. Every operation is scoped by canActOn against the
// target node's path: a city admin's manage_hierarchy grant is anchored at their
// city node, so it covers exactly their subtree; superadmin's global-root grant
// covers all. No special-case role checks.

import type { AuthzContext } from "@/types/auth";
import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { nextLevel, type Level } from "@/lib/org-levels";
import { DEFAULT_ROLES, type RoleDef } from "@/lib/default-roles";
import { summarizeLevels, type LevelCount } from "@/lib/city-summary";
import { pktDayRange } from "@/lib/pkt-day";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";
import * as eventRepo from "@/server/repositories/event-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const MANAGE = "manage_hierarchy";

// Prisma foreign-key constraint violation (e.g. a RESTRICT FK rejecting a delete).
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2003";
}

function canManage(ctx: AuthzContext, node: { path: string }): void {
  requirePermission(ctx, MANAGE, { path: node.path, functionId: null });
}

export type CityTree = {
  city: orgNodeRepo.OrgNodeRow;
  levels: Level[];
  nodes: orgNodeRepo.SubtreeNode[];
  roles: RoleDef[]; // static catalog so the client knows what's addable per level
};

export async function getCityTree(ctx: AuthzContext, cityId: string): Promise<CityTree> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  canManage(ctx, city);

  // The level template is seeded at city creation (createCity), so we don't
  // re-ensure it on every read — that was a wasted round trip on a hot path.
  const [levels, nodes] = await Promise.all([
    nodeTypeRepo.listCityLevels(cityId),
    orgNodeRepo.listSubtree(city.path),
  ]);
  return { city, levels, nodes, roles: DEFAULT_ROLES };
}

export type CitySummary = {
  city: { id: string; name: string };
  levels: LevelCount[];
  peopleCount: number;
  today: { events: number; started: number };
};

// Lightweight overview for the city admin's home: node counts per level, total
// active people, and today's attendance signal. Same scope guard as the tree.
export async function getCitySummary(ctx: AuthzContext, cityId: string): Promise<CitySummary> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  canManage(ctx, city);

  // Template is seeded at creation — no re-ensure on this read path.
  const [levels, nodes, peopleCount, today] = await Promise.all([
    nodeTypeRepo.listCityLevels(cityId),
    orgNodeRepo.listSubtree(city.path),
    assignmentRepo.countActiveInSubtree(city.path),
    eventRepo.todayStatsInCity(cityId, pktDayRange()),
  ]);
  return {
    city: { id: city.id, name: city.name },
    levels: summarizeLevels(nodes, levels),
    peopleCount,
    today,
  };
}

export async function addNode(
  ctx: AuthzContext,
  input: { parentId: string; name: string },
): Promise<orgNodeRepo.OrgNodeRow> {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name is required");

  const parent = await orgNodeRepo.findById(input.parentId);
  if (!parent) throw new NotFoundError("Parent node not found");
  canManage(ctx, parent);
  if (!parent.cityId) throw new ValidationError("Cannot add nodes above the city level");

  const levels = await nodeTypeRepo.listCityLevels(parent.cityId);
  const parentLevel = levels.find((l) => l.id === parent.typeId);
  if (!parentLevel) throw new ValidationError("Unknown parent level");

  const childLevel = nextLevel(levels, parentLevel.rank);
  if (!childLevel) throw new ValidationError("This level cannot contain children");

  const node = await orgNodeRepo.createChild({ parent, typeId: childLevel.id, name });
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "add_node",
    targetType: "OrgNode",
    targetId: node.id,
    cityId: node.cityId,
    metadata: { name, level: childLevel.key, parentId: parent.id },
  });
  return node;
}

export async function renameNode(
  ctx: AuthzContext,
  input: { nodeId: string; name: string },
): Promise<orgNodeRepo.OrgNodeRow> {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name is required");

  const node = await orgNodeRepo.findById(input.nodeId);
  if (!node) throw new NotFoundError("Node not found");
  canManage(ctx, node);

  const updated = await orgNodeRepo.rename(node.id, name);
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "rename_node",
    targetType: "OrgNode",
    targetId: node.id,
    cityId: node.cityId,
    metadata: { name },
  });
  return updated;
}

export async function deleteNode(ctx: AuthzContext, nodeId: string): Promise<void> {
  const node = await orgNodeRepo.findById(nodeId);
  if (!node) throw new NotFoundError("Node not found");
  canManage(ctx, node);

  // Guard + delete atomically. The checks and the delete run in one transaction so
  // a concurrent addNode/addMember can't slip between them; and the parentId FK is
  // ON DELETE RESTRICT, so even if one does, the delete FAILS at the DB (P2003)
  // rather than orphaning children — caught below and surfaced as the friendly error.
  try {
    await prisma.$transaction(async (tx) => {
      if (await orgNodeRepo.hasChildren(node.id, tx)) {
        throw new ValidationError("Remove or move its child nodes first", "NODE_NOT_EMPTY");
      }
      if ((await orgNodeRepo.countAssignments(node.id, tx)) > 0) {
        throw new ValidationError("Reassign the people here first", "NODE_HAS_PEOPLE");
      }
      await orgNodeRepo.remove(node.id, tx);
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError("Remove or move its child nodes or people first", "NODE_NOT_EMPTY");
    }
    throw err;
  }

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "delete_node",
    targetType: "OrgNode",
    targetId: node.id,
    cityId: node.cityId,
    metadata: { name: node.name },
  });
}
