// Attendance data access. Marks are upserted by the (eventId, personId) unique key
// with last-write-wins by clientUpdatedAt, so an offline replay or an out-of-order
// sync can't clobber a newer mark. Idempotent.

import { prisma } from "@/server/db";
import { shouldApplyMark, type AttendanceStatus } from "@/lib/attendance-status";
import type { MarkInput } from "./event-repo";

export type MarkRow = {
  personId: string;
  status: AttendanceStatus;
  markedById: string | null;
  clientUpdatedAt: Date | null;
};

export async function listByEvent(eventId: string): Promise<MarkRow[]> {
  const rows = await prisma.attendance.findMany({
    where: { eventId },
    select: { personId: true, status: true, markedById: true, clientUpdatedAt: true },
  });
  return rows.map((r) => ({
    personId: r.personId,
    status: r.status as AttendanceStatus,
    markedById: r.markedById,
    clientUpdatedAt: r.clientUpdatedAt,
  }));
}

// Apply a batch of marks atomically. Each is upserted by (eventId, personId); an
// incoming mark whose clientUpdatedAt is not newer than the stored one is skipped
// (last-write-wins). Returns which persons were written vs. skipped.
export async function upsertMany(
  eventId: string,
  marks: MarkInput[],
  markedById: string,
): Promise<{ syncedPersonIds: string[]; skippedPersonIds: string[] }> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.attendance.findMany({
        where: { eventId, personId: { in: marks.map((m) => m.personId) } },
        select: { personId: true, clientUpdatedAt: true },
      });
      const stored = new Map(existing.map((e) => [e.personId, e.clientUpdatedAt]));

      const syncedPersonIds: string[] = [];
      const skippedPersonIds: string[] = [];

      for (const m of marks) {
        if (!shouldApplyMark(stored.get(m.personId), m.clientUpdatedAt)) {
          skippedPersonIds.push(m.personId);
          continue;
        }
        await tx.attendance.upsert({
          where: { eventId_personId: { eventId, personId: m.personId } },
          create: {
            eventId,
            personId: m.personId,
            status: m.status,
            markedById,
            clientUpdatedAt: m.clientUpdatedAt,
            overrideReason: m.overrideReason ?? null,
          },
          update: {
            status: m.status,
            markedById,
            clientUpdatedAt: m.clientUpdatedAt,
            overrideReason: m.overrideReason ?? null,
          },
          select: { personId: true },
        });
        syncedPersonIds.push(m.personId);
      }
      return { syncedPersonIds, skippedPersonIds };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
