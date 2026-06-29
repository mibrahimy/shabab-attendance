// Authorization data access: load a user's liveness + effective grants in ONE
// query (User → Person → active Assignments → Position → PositionPermission →
// Permission → anchor OrgNode), then flatten to the in-memory Grant list canActOn
// consumes. One round trip per request — this runs on every authenticated request.

import { prisma } from "@/server/db";
import type { Grant } from "@/types/auth";

export type LoadedAuthz = {
  personId: string;
  status: "pending" | "active" | "rejected";
  isActive: boolean;
  tokenVersion: number;
  grants: Grant[];
  isSuperadmin: boolean; // holds a grant anchored at the global root (depth 0)
};

export async function loadForUser(userId: string): Promise<LoadedAuthz | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      tokenVersion: true,
      person: {
        select: {
          id: true,
          status: true,
          assignments: {
            where: { endDate: null },
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
          },
        },
      },
    },
  });
  if (!user) return null;

  const grants: Grant[] = [];
  let isSuperadmin = false;
  for (const a of user.person.assignments) {
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

  return {
    personId: user.person.id,
    status: user.person.status,
    isActive: user.isActive,
    tokenVersion: user.tokenVersion,
    grants,
    isSuperadmin,
  };
}
