// Data-layer transaction runner. Services compose repo writes into one atomic unit
// through this — so Prisma (the interactive transaction) stays in the repository
// layer and services never touch @/server/db directly.

import { prisma } from "@/server/db";
import type { Prisma } from "../../../prisma/generated/v2-client";
import type { Db } from "./org-node-repo";

export type { Db };

type TxOptions = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };

export function withTransaction<T>(fn: (tx: Db) => Promise<T>, options?: TxOptions): Promise<T> {
  return prisma.$transaction(fn, options);
}
