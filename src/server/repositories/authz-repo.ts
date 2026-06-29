// Authorization data access: load a person's effective grants in ONE query
// (active Assignments ⋈ Position ⋈ PositionPermission ⋈ Permission ⋈ anchor
// OrgNode), then flatten to the in-memory Grant list canActOn consumes.

import { prisma } from "@/server/db";
import type { Grant } from "@/types/auth";

export type LoadedAuthz = {
  grants: Grant[];
  isSuperadmin: boolean; // holds a grant anchored at the global root (depth 0)
};

export async function loadAuthz(personId: string): Promise<LoadedAuthz> {
  const assignments = await prisma.assignment.findMany({
    where: { personId, endDate: null },
    select: {
      cityId: true,
      orgNode: { select: { path: true, depth: true } },
      position: {
        select: {
          functionId: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  const grants: Grant[] = [];
  let isSuperadmin = false;

  for (const a of assignments) {
    if (a.orgNode.depth === 0) isSuperadmin = true;
    for (const pp of a.position.permissions) {
      grants.push({
        permission: pp.permission.key,
        anchorPath: a.orgNode.path,
        functionId: a.position.functionId,
        cityId: a.cityId,
      });
    }
  }

  return { grants, isSuperadmin };
}
