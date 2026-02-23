import { prisma } from "./db";

/**
 * BFS down the member tree via parentId.
 * Returns all descendant member IDs including the given memberId itself.
 */
export async function getSubTreeMemberIds(memberId: string): Promise<string[]> {
  const result: string[] = [memberId];
  let currentLevel = [memberId];

  while (currentLevel.length > 0) {
    const children = await prisma.member.findMany({
      where: { parentId: { in: currentLevel } },
      select: { id: true },
    });

    const childIds = children.map((c) => c.id);
    result.push(...childIds);
    currentLevel = childIds;
  }

  return result;
}

/**
 * Finds the user's linked Member(s) and returns the combined sub-tree IDs.
 * Returns null if the user has no linked members.
 */
export async function getUserSubTreeMemberIds(userId: string): Promise<string[] | null> {
  const linkedMembers = await prisma.member.findMany({
    where: { userId },
    select: { id: true },
  });

  if (linkedMembers.length === 0) return null;

  const allIds = new Set<string>();

  for (const member of linkedMembers) {
    const subtree = await getSubTreeMemberIds(member.id);
    for (const id of subtree) {
      allIds.add(id);
    }
  }

  return Array.from(allIds);
}
