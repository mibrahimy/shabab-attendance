// Person data access.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

type PersonStatus = "pending" | "active" | "rejected";
type Segment = "junior" | "senior";

export async function findByCnic(cnic: string, db: Db = prisma): Promise<{ id: string } | null> {
  return db.person.findUnique({ where: { cnic }, select: { id: true } });
}

export async function create(
  input: {
    name: string;
    cnic?: string | null;
    phone?: string | null;
    segment?: Segment | null;
    status: PersonStatus;
    cityId?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.person.create({
    data: {
      name: input.name,
      cnic: input.cnic ?? null,
      phone: input.phone ?? null,
      segment: input.segment ?? null,
      status: input.status,
      cityId: input.cityId ?? null,
    },
    select: { id: true },
  });
}
