// Overlay locally-queued marks onto a fetched roster, so the Mark/Report screens
// always reflect what the user actually marked — even offline or before a sync,
// when the server roster still shows the default. Pure.

import type { AttendanceStatus } from "@/lib/attendance-status";

type RosterEntry = { personId: string; status: AttendanceStatus };
type PendingLike = { personId: string; status: AttendanceStatus };

export function overlayPending<T extends RosterEntry>(roster: T[], pending: PendingLike[]): T[] {
  if (pending.length === 0) return roster;
  const queued = new Map(pending.map((p) => [p.personId, p.status]));
  return roster.map((r) => {
    const q = queued.get(r.personId);
    return q ? { ...r, status: q } : r;
  });
}

// Tally a roster by status — for the live summary and the report.
export function tally(roster: { status: AttendanceStatus }[]): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of roster) counts[r.status]++;
  return counts;
}

// Attendance rate = share present or late (i.e. showed up), rounded to a percent.
export function attendanceRate(counts: Record<AttendanceStatus, number>): {
  attended: number;
  total: number;
  percent: number;
} {
  const total = counts.present + counts.late + counts.absent + counts.excused;
  const attended = counts.present + counts.late;
  return { attended, total, percent: total === 0 ? 0 : Math.round((attended / total) * 100) };
}
