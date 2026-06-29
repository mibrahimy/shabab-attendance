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
