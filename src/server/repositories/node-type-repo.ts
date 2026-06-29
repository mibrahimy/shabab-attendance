// NodeType data access. National node types (cityId = null) are seeded; per-city
// node types arrive with the hierarchy builder (chunk 2).

import { prisma } from "@/server/db";

export async function findNationalByCanonicalKey(key: string): Promise<{ id: string } | null> {
  return prisma.nodeType.findFirst({
    where: { cityId: null, canonical: { key } },
    select: { id: true },
  });
}
