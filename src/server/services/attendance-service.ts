// Attendance marking. The marker sees the event roster INTERSECTED with their own
// mark_attendance scope (their "slice"), defaulting everyone to absent, and can
// only submit marks for people inside that slice.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { canActOn, requirePermission } from "@/server/auth/can-act-on";
import { DEFAULT_STATUS, isAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status";
import * as eventRepo from "@/server/repositories/event-repo";
import * as attendanceRepo from "@/server/repositories/attendance-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const MARK_ATTENDANCE = "mark_attendance";

export type RosterEntry = {
  personId: string;
  name: string;
  segment: "junior" | "senior" | null;
  status: AttendanceStatus;
  marked: boolean; // whether an explicit attendance record already exists
};

export type MarkerRoster = {
  event: { id: string; title: string; scheduledAt: Date; status: string };
  roster: RosterEntry[];
  recentRates: number[]; // rate % of recent completed sessions at this node (oldest→newest)
};

// A roster person is in the marker's slice iff the marker holds mark_attendance
// over the node the person is assigned at (∩ the event's function).
function inMarkerSlice(ctx: AuthzContext, person: eventRepo.RosterPerson, functionId: string | null) {
  return canActOn(ctx, MARK_ATTENDANCE, { path: person.nodePath, functionId });
}

export async function getMarkerRoster(ctx: AuthzContext, eventId: string): Promise<MarkerRoster> {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");
  requirePermission(ctx, MARK_ATTENDANCE, { path: event.orgNodePath, functionId: event.functionId });

  const [roster, marks] = await Promise.all([
    eventRepo.resolveRoster(event),
    attendanceRepo.listByEvent(eventId),
  ]);
  const byPerson = new Map(marks.map((m) => [m.personId, m.status]));

  const slice = roster
    .filter((p) => inMarkerSlice(ctx, p, event.functionId))
    .map((p) => ({
      personId: p.personId,
      name: p.name,
      segment: p.segment,
      status: byPerson.get(p.personId) ?? DEFAULT_STATUS,
      marked: byPerson.has(p.personId),
    }));

  // Trend trail: rate of recent completed sessions at this node (oldest→newest).
  const recentIds = await eventRepo.recentCompletedAtNode(event.orgNodeId, 8);
  const ratesByEvent = await attendanceRepo.statusByEvents(recentIds);
  const recentRates = recentIds
    .slice()
    .reverse()
    .map((id) => {
      const s = ratesByEvent.get(id) ?? { present: 0, total: 0 };
      return s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
    });

  return {
    event: { id: event.id, title: event.title, scheduledAt: event.scheduledAt, status: event.status },
    roster: slice,
    recentRates,
  };
}

export type SubmitMark = {
  personId: string;
  status: AttendanceStatus;
  clientUpdatedAt: Date;
  overrideReason?: string | null;
};

export type SubmitResult = {
  syncedPersonIds: string[];
  skippedPersonIds: string[];
  rejectedPersonIds: string[]; // outside the marker's slice — not written, told to the client
};

export async function submitMarks(
  ctx: AuthzContext,
  eventId: string,
  marks: SubmitMark[],
): Promise<SubmitResult> {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");
  requirePermission(ctx, MARK_ATTENDANCE, { path: event.orgNodePath, functionId: event.functionId });
  // Only an open event may be marked — covers the offline outbox replaying after a
  // cancel/close. Terminal for the batch (the client drops it), unlike a transient error.
  if (event.status !== "scheduled") {
    throw new ValidationError("This event is closed for attendance", "EVENT_NOT_OPEN");
  }

  if (marks.length === 0) {
    return { syncedPersonIds: [], skippedPersonIds: [], rejectedPersonIds: [] };
  }
  for (const m of marks) {
    if (!isAttendanceStatus(m.status)) throw new ValidationError(`Invalid status: ${m.status}`);
  }

  // Partition against the marker's live slice rather than 403-ing the whole batch:
  // a person who left the slice (e.g. reassigned since the offline mark) is rejected
  // individually so the rest still save and the client can drop just that key.
  const roster = await eventRepo.resolveRoster(event);
  const sliceIds = new Set(
    roster.filter((p) => inMarkerSlice(ctx, p, event.functionId)).map((p) => p.personId),
  );
  const accepted = marks.filter((m) => sliceIds.has(m.personId));
  const rejectedPersonIds = marks.filter((m) => !sliceIds.has(m.personId)).map((m) => m.personId);

  const written = await attendanceRepo.upsertMany(eventId, accepted, ctx.personId);

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "mark_attendance",
    targetType: "Event",
    targetId: eventId,
    cityId: event.cityId,
    metadata: {
      marked: written.syncedPersonIds.length,
      skipped: written.skippedPersonIds.length,
      rejected: rejectedPersonIds.length,
    },
  });
  return { ...written, rejectedPersonIds };
}
