// v2 Prisma client singleton (separate DB + generated client from the live v1 app).
//
// This is the ONLY place outside `repositories/` that touches the Prisma client.
// Bound to DATABASE_URL_V2; cached on globalThis in dev to avoid connection leaks
// across hot reloads (mirrors src/lib/db.ts for v1).

import { PrismaClient } from "../../prisma/generated/v2-client";

const globalForPrismaV2 = globalThis as unknown as {
  prismaV2: PrismaClient | undefined;
};

export const prisma = globalForPrismaV2.prismaV2 ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrismaV2.prismaV2 = prisma;
