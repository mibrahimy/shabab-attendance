// Hierarchy-builder use-cases. Every operation is scoped by canActOn against the
// target node's path: a city admin's manage_hierarchy grant is anchored at their
// city node, so it covers exactly their subtree; superadmin's global-root grant
// covers all. No special-case role checks.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { nextLevel, type Level } from "@/lib/org-levels";
import { DEFAULT_ROLES, type RoleDef } from "@/lib/default-roles";
import { summarizeLevels, type LevelCount } from "@/lib/city-summary";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const MANAGE = "manage_hierarchy";

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

  await nodeTypeRepo.ensureCityTemplate(cityId);
  // Independent reads — run them together to save a round trip.
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
};

// Lightweight overview for the city admin's home: node counts per level + total
// active people (assignments) in the city. Same scope guard as the tree.
export async function getCitySummary(ctx: AuthzContext, cityId: string): Promise<CitySummary> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  canManage(ctx, city);

  await nodeTypeRepo.ensureCityTemplate(cityId);
  const [levels, nodes, peopleCount] = await Promise.all([
    nodeTypeRepo.listCityLevels(cityId),
    orgNodeRepo.listSubtree(city.path),
    assignmentRepo.countActiveInSubtree(city.path),
  ]);
  return {
    city: { id: city.id, name: city.name },
    levels: summarizeLevels(nodes, levels),
    peopleCount,
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

  // Guard: refuse to delete a node that still has structure or people under it.
  if (await orgNodeRepo.hasChildren(node.id)) {
    throw new ValidationError("Remove or move its child nodes first", "NODE_NOT_EMPTY");
  }
  if ((await orgNodeRepo.countAssignments(node.id)) > 0) {
    throw new ValidationError("Reassign the people here first", "NODE_HAS_PEOPLE");
  }

  await orgNodeRepo.remove(node.id);
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "delete_node",
    targetType: "OrgNode",
    targetId: node.id,
    cityId: node.cityId,
    metadata: { name: node.name },
  });
}
