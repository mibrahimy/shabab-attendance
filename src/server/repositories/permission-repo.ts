// Permission catalog data access (the global, seeded set of permission keys).

import { prisma } from "@/server/db";

export type PermissionRow = { key: string; label: string; description: string | null };

export async function listAll(): Promise<PermissionRow[]> {
  return prisma.permission.findMany({
    orderBy: { key: "asc" },
    select: { key: true, label: true, description: true },
  });
}
