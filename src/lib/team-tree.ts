import { cache } from "react";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export type UserScope = {
  memberIds: string[];
  parkIds: string[];
};

/**
 * Returns the user's sub-tree member IDs and the park IDs those members belong to.
 * Returns null if the user has no linked members.
 */
export const getUserScope = cache(async (userId: string): Promise<UserScope | null> => {
  const memberIds = await getUserSubTreeMemberIds(userId);
  if (!memberIds) return null;

  const parks = await prisma.member.findMany({
    where: { id: { in: memberIds }, parkId: { not: null } },
    select: { parkId: true },
    distinct: ["parkId"],
  });

  return {
    memberIds,
    parkIds: parks.map((p) => p.parkId!),
  };
});

/**
 * Recursive CTE down the member tree via parentId.
 * Returns all descendant member IDs including the given memberId itself.
 */
export async function getSubTreeMemberIds(memberId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Member" WHERE id = ${memberId}
        UNION ALL
        SELECT m.id FROM "Member" m JOIN subtree s ON m."parentId" = s.id
      )
      SELECT id FROM subtree
    `
  );
  return rows.map((r) => r.id);
}

/**
 * Returns park IDs where the user has a direct Member record with canManageTeam = true.
 * Used to scope add/remove member permissions for park-level managers.
 */
export async function getUserManagedParkIds(userId: string): Promise<string[]> {
  const rows = await prisma.member.findMany({
    where: { userId, canManageTeam: true, parkId: { not: null } },
    select: { parkId: true },
    distinct: ["parkId"],
  });
  return rows.map((r) => r.parkId!);
}

/**
 * Finds the user's linked Member(s) and returns the combined sub-tree IDs via a single recursive CTE.
 * Returns null if the user has no linked members.
 */
export const getUserSubTreeMemberIds = cache(async (userId: string): Promise<string[] | null> => {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Member" WHERE "userId" = ${userId}
        UNION ALL
        SELECT m.id FROM "Member" m JOIN subtree s ON m."parentId" = s.id
      )
      SELECT id FROM subtree
    `
  );
  if (rows.length === 0) return null;
  return rows.map((r) => r.id);
});
