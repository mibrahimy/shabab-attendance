// Audit log writes (append-only). Never store secrets in metadata.

import { prisma } from "@/server/db";
import type { Prisma } from "../../../prisma/generated/v2-client";
import type { Db } from "./org-node-repo";

export async function record(
  input: {
    actorPersonId: string;
    action: string;
    targetType: string;
    targetId: string;
    cityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
  db: Db = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorPersonId: input.actorPersonId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      cityId: input.cityId ?? null,
      metadata: input.metadata,
    },
  });
}
