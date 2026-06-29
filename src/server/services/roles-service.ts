// City roles catalog editor. A city admin (manage_city, scoped to the city) edits
// which permissions each city role carries. Editing the city_admin role itself is
// blocked to prevent self-lockout; the national superadmin is never city-editable.
//
// default-roles.ts stays the STRUCTURAL catalog (attach level, isStudent, initial
// perms on first creation); this service manages the live PositionPermission rows.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { findRole } from "@/lib/default-roles";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as positionRepo from "@/server/repositories/position-repo";
import * as permissionRepo from "@/server/repositories/permission-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const MANAGE_CITY = "manage_city";
const PROTECTED = new Set(["superadmin", "city_admin"]);

export type RoleView = {
  canonicalKey: string;
  label: string;
  permissionKeys: string[];
  instantiated: boolean; // false = no Position yet (showing default perms)
};

export type RolesPayload = {
  permissions: permissionRepo.PermissionRow[];
  roles: RoleView[];
};

export async function listRoles(ctx: AuthzContext, cityId: string): Promise<RolesPayload> {
  const city = await loadAuthorizedCity(ctx, cityId);
  const [permissions, canonicals, positions] = await Promise.all([
    permissionRepo.listAll(),
    positionRepo.listEditableCanonicals(),
    positionRepo.listCityPositions(city.id),
  ]);
  const live = new Map(positions.map((p) => [p.canonicalKey, p]));
  const roles = canonicals.map((c) => {
    const existing = live.get(c.key);
    return {
      canonicalKey: c.key,
      label: c.label,
      // Live grants if instantiated, else the seeded defaults (city_poc has none).
      permissionKeys: existing ? existing.permissionKeys : (findRole(c.key)?.permissionKeys ?? []),
      instantiated: !!existing,
    };
  });
  return { permissions, roles };
}

export async function setRolePermissions(
  ctx: AuthzContext,
  cityId: string,
  canonicalKey: string,
  permissionKeys: string[],
): Promise<void> {
  const city = await loadAuthorizedCity(ctx, cityId);
  if (PROTECTED.has(canonicalKey)) {
    throw new ValidationError("This role can't be edited here");
  }

  const valid = new Set((await permissionRepo.listAll()).map((p) => p.key));
  const unknown = permissionKeys.find((k) => !valid.has(k));
  if (unknown) throw new ValidationError(`Unknown permission: ${unknown}`);

  const position = await positionRepo.findOrCreateRolePosition(city.id, canonicalKey, []);
  await positionRepo.setPermissions(position.id, permissionKeys);

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "edit_role",
    targetType: "Position",
    targetId: position.id,
    cityId: city.id,
    metadata: { canonicalKey, permissionKeys },
  });
}

async function loadAuthorizedCity(
  ctx: AuthzContext,
  cityId: string,
): Promise<orgNodeRepo.OrgNodeRow> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  requirePermission(ctx, MANAGE_CITY, { path: city.path, functionId: null });
  return city;
}
