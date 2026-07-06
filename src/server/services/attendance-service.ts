// Attendance marking. The marker sees the event roster INTERSECTED with their own
// mark_attendance scope (their "slice"), defaulting everyone to absent, and can
// only submit marks for people inside that slice.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ForbiddenError, ValidationError } from "@/server/errors";
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
};

export type MarkerRoster = {
  event: { id: string; title: string; scheduledAt: Date; status: string };
  roster: RosterEntry[];
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
    }));

  return {
    event: { id: event.id, title: event.title, scheduledAt: event.scheduledAt, status: event.status },
    roster: slice,
  };
}

export type SubmitMark = {
  personId: string;
  status: AttendanceStatus;
  clientUpdatedAt: Date;
  overrideReason?: string | null;
};

export async function submitMarks(
  ctx: AuthzContext,
  eventId: string,
  marks: SubmitMark[],
): Promise<{ syncedPersonIds: string[]; skippedPersonIds: string[] }> {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");
  requirePermission(ctx, MARK_ATTENDANCE, { path: event.orgNodePath, functionId: event.functionId });

  if (marks.length === 0) return { syncedPersonIds: [], skippedPersonIds: [] };
  for (const m of marks) {
    if (!isAttendanceStatus(m.status)) throw new ValidationError(`Invalid status: ${m.status}`);
  }

  // Every submitted person must be inside the marker's slice — no marking outside scope.
  const roster = await eventRepo.resolveRoster(event);
  const sliceIds = new Set(
    roster.filter((p) => inMarkerSlice(ctx, p, event.functionId)).map((p) => p.personId),
  );
  const outside = marks.find((m) => !sliceIds.has(m.personId));
  if (outside) throw new ForbiddenError();

  const result = await attendanceRepo.upsertMany(eventId, marks, ctx.personId);

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "mark_attendance",
    targetType: "Event",
    targetId: eventId,
    cityId: event.cityId,
    metadata: { marked: result.syncedPersonIds.length, skipped: result.skippedPersonIds.length },
  });
  return result;
}
