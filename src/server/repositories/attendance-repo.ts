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

export type DateRange = { start: Date; end: Date };

function eventWhere(cityId: string, range?: DateRange) {
  return range ? { cityId, scheduledAt: { gte: range.start, lt: range.end } } : { cityId };
}

// City-wide attendance rate: present marks over total marks across a city's events
// (optionally within a date range). Two cheap counts for the dashboard/report.
export async function rateInCity(cityId: string, range?: DateRange): Promise<{ present: number; total: number }> {
  const ev = eventWhere(cityId, range);
  const [present, total] = await Promise.all([
    prisma.attendance.count({ where: { event: ev, status: "present" } }),
    prisma.attendance.count({ where: { event: ev } }),
  ]);
  return { present, total };
}

// present/total per event for a set of events — one grouped query (dashboard's
// recent-sessions list).
export async function statusByEvents(
  eventIds: string[],
): Promise<Map<string, { present: number; total: number }>> {
  if (eventIds.length === 0) return new Map();
  const rows = await prisma.attendance.groupBy({
    by: ["eventId", "status"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
  });
  const m = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    const cur = m.get(r.eventId) ?? { present: 0, total: 0 };
    cur.total += r._count._all;
    if (r.status === "present") cur.present += r._count._all;
    m.set(r.eventId, cur);
  }
  return m;
}

export type PersonAttendanceRow = {
  eventId: string; title: string; when: Date; nodeName: string; status: AttendanceStatus;
};

// A person's attendance history (newest-first) with each session's title/date/node
// — for the per-person report.
export async function listByPerson(personId: string): Promise<PersonAttendanceRow[]> {
  const rows = await prisma.attendance.findMany({
    where: { personId },
    orderBy: { event: { scheduledAt: "desc" } },
    select: {
      status: true,
      event: { select: { id: true, title: true, scheduledAt: true, orgNode: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    eventId: r.event.id, title: r.event.title, when: r.event.scheduledAt,
    nodeName: r.event.orgNode.name, status: r.status,
  }));
}

// City-wide attendance counts per status — the report's status breakdown.
export async function statusBreakdownInCity(
  cityId: string,
  range?: DateRange,
): Promise<Record<AttendanceStatus, number>> {
  const rows = await prisma.attendance.groupBy({
    by: ["status"],
    where: { event: eventWhere(cityId, range) },
    _count: { _all: true },
  });
  const out: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

// Number of attendance rows per event, for a set of events — one grouped query
// instead of one listByEvent per event (avoids the N+1 in the "today" list).
export async function countByEvents(eventIds: string[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const rows = await prisma.attendance.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.eventId, r._count._all]));
}

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
            // Only touch the reason when the caller supplied one (undefined = leave
            // the stored reason intact; null = explicitly clear it).
            ...(m.overrideReason !== undefined ? { overrideReason: m.overrideReason } : {}),
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
