// City structure (level/tier) management. A city's levels are per-city NodeType
// rows; admins add/rename/reorder/remove them and set each level's head role. Guards:
// manage_city on the city, a level in use (has nodes) can't be removed, and ranks are
// renumbered contiguously below the national "city" level so nextLevel stays correct.

import type { AuthzContext } from "@/types/auth";
import { prisma } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as positionRepo from "@/server/repositories/position-repo";
import * as auditRepo from "@/server/repositories/audit-repo";
import type { Db } from "@/server/repositories/org-node-repo";

const MANAGE_CITY = "manage_city";
const COLOR_OPTIONS = ["slate", "blue", "green", "amber", "pink", "purple", "indigo", "orange", "red"];

async function loadAuthorizedCity(ctx: AuthzContext, cityId: string): Promise<orgNodeRepo.OrgNodeRow> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  requirePermission(ctx, MANAGE_CITY, { path: city.path, functionId: null });
  return city;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "level";
}

export type ManagedLevel = {
  id: string; key: string; label: string; rank: number;
  color: string | null; headPositionKey: string | null;
  isCustom: boolean; nodeCount: number;
};

export type StructurePayload = {
  levels: ManagedLevel[];
  headRoleOptions: { key: string; label: string }[];
  colorOptions: string[];
};

export async function listLevels(ctx: AuthzContext, cityId: string): Promise<StructurePayload> {
  await loadAuthorizedCity(ctx, cityId);
  const [levels, counts, headRoleOptions] = await Promise.all([
    nodeTypeRepo.listEditableLevels(cityId),
    nodeTypeRepo.countNodesByType(cityId),
    positionRepo.listEditableCanonicals(),
  ]);
  return {
    levels: levels.map((l) => ({
      id: l.id, key: l.key, label: l.label, rank: l.rank,
      color: l.color, headPositionKey: l.headPositionKey,
      isCustom: l.canonicalId == null, nodeCount: counts.get(l.id) ?? 0,
    })),
    headRoleOptions,
    colorOptions: COLOR_OPTIONS,
  };
}

async function renumber(orderedIds: string[], base: number, tx: Db): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await nodeTypeRepo.updateLevel(orderedIds[i], { rank: base + i }, tx);
  }
}

// Find a level in the city or throw (prevents editing another city's level).
async function assertLevel(cityId: string, levelId: string): Promise<nodeTypeRepo.EditableLevel> {
  const levels = await nodeTypeRepo.listEditableLevels(cityId);
  const level = levels.find((l) => l.id === levelId);
  if (!level) throw new NotFoundError("Level not found");
  return level;
}

export async function addLevel(
  ctx: AuthzContext,
  cityId: string,
  input: { name: string; afterLevelId?: string | null; color?: string | null; headPositionKey?: string | null },
): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Level name is required");

  let key = slugify(name);
  for (let n = 2; await nodeTypeRepo.keyExistsInCity(cityId, key); n++) key = `${slugify(name)}-${n}`;

  const base = (await nodeTypeRepo.cityLevelRank()) + 1;
  const existing = await nodeTypeRepo.listEditableLevels(cityId);
  // No afterLevelId ⇒ insert at the top (right under the city); otherwise after it.
  let idx = 0;
  if (input.afterLevelId) {
    const ai = existing.findIndex((l) => l.id === input.afterLevelId);
    idx = ai >= 0 ? ai + 1 : existing.length;
  }

  await prisma.$transaction(async (tx) => {
    const created = await nodeTypeRepo.createLevel(
      { cityId, key, label: name, rank: base + existing.length, color: input.color ?? null, headPositionKey: input.headPositionKey ?? null },
      tx,
    );
    const order = existing.map((l) => l.id);
    order.splice(idx, 0, created.id);
    await renumber(order, base, tx);
  });
  await auditRepo.record({ actorPersonId: ctx.personId, action: "add_level", targetType: "NodeType", targetId: cityId, cityId, metadata: { name, key } });
}

export async function renameLevel(ctx: AuthzContext, cityId: string, levelId: string, name: string): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  const label = name.trim();
  if (!label) throw new ValidationError("Level name is required");
  await assertLevel(cityId, levelId);
  await nodeTypeRepo.updateLevel(levelId, { label });
  await auditRepo.record({ actorPersonId: ctx.personId, action: "rename_level", targetType: "NodeType", targetId: levelId, cityId, metadata: { label } });
}

export async function setLevelHead(ctx: AuthzContext, cityId: string, levelId: string, headPositionKey: string | null): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  await assertLevel(cityId, levelId);
  await nodeTypeRepo.updateLevel(levelId, { headPositionKey });
  await auditRepo.record({ actorPersonId: ctx.personId, action: "set_level_head", targetType: "NodeType", targetId: levelId, cityId, metadata: { headPositionKey } });
}

export async function setLevelColor(ctx: AuthzContext, cityId: string, levelId: string, color: string): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  await assertLevel(cityId, levelId);
  if (!COLOR_OPTIONS.includes(color)) throw new ValidationError("Unknown color");
  await nodeTypeRepo.updateLevel(levelId, { color });
  await auditRepo.record({ actorPersonId: ctx.personId, action: "set_level_color", targetType: "NodeType", targetId: levelId, cityId, metadata: { color } });
}

export async function moveLevel(ctx: AuthzContext, cityId: string, levelId: string, direction: "up" | "down"): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  const levels = await nodeTypeRepo.listEditableLevels(cityId);
  const i = levels.findIndex((l) => l.id === levelId);
  if (i < 0) throw new NotFoundError("Level not found");
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= levels.length) return; // at an edge — no-op

  const order = levels.map((l) => l.id);
  [order[i], order[j]] = [order[j], order[i]];
  const base = (await nodeTypeRepo.cityLevelRank()) + 1;
  await prisma.$transaction((tx) => renumber(order, base, tx));
  await auditRepo.record({ actorPersonId: ctx.personId, action: "move_level", targetType: "NodeType", targetId: levelId, cityId, metadata: { direction } });
}

export async function removeLevel(ctx: AuthzContext, cityId: string, levelId: string): Promise<void> {
  await loadAuthorizedCity(ctx, cityId);
  await assertLevel(cityId, levelId);
  const counts = await nodeTypeRepo.countNodesByType(cityId);
  if ((counts.get(levelId) ?? 0) > 0) {
    throw new ValidationError("This level still has nodes — move or delete them first");
  }
  const remaining = (await nodeTypeRepo.listEditableLevels(cityId)).filter((l) => l.id !== levelId).map((l) => l.id);
  const base = (await nodeTypeRepo.cityLevelRank()) + 1;
  await prisma.$transaction(async (tx) => {
    await nodeTypeRepo.deleteLevel(levelId, tx);
    await renumber(remaining, base, tx);
  });
  await auditRepo.record({ actorPersonId: ctx.personId, action: "remove_level", targetType: "NodeType", targetId: levelId, cityId, metadata: {} });
}
