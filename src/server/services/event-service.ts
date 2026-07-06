// Event use-cases. Creating an event needs create_event at the anchor node; the
// "today" list is scoped to nodes the caller can view or mark attendance for.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission, isSuperadmin } from "@/server/auth/can-act-on";
import { pktDayRange } from "@/lib/pkt-day";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as eventRepo from "@/server/repositories/event-repo";
import * as attendanceRepo from "@/server/repositories/attendance-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const CREATE_EVENT = "create_event";
const VIEW_ATTENDANCE = "view_attendance";
const MARK_ATTENDANCE = "mark_attendance";

type Segment = "junior" | "senior";

export async function createEvent(
  ctx: AuthzContext,
  input: { nodeId: string; title: string; scheduledAt: Date; segment?: Segment | null },
): Promise<{ id: string }> {
  const node = await orgNodeRepo.findById(input.nodeId);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, CREATE_EVENT, { path: node.path, functionId: null });

  const title = input.title.trim();
  if (!title) throw new ValidationError("Title is required");
  if (Number.isNaN(input.scheduledAt.getTime())) throw new ValidationError("Invalid date/time");

  const event = await eventRepo.create({
    title,
    orgNodeId: node.id,
    cityId: node.cityId,
    scheduledAt: input.scheduledAt,
    rosterDepth: 1, // direct members at the node (minimal-create default)
    segment: input.segment ?? null,
    createdById: ctx.personId,
  });

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "create_event",
    targetType: "Event",
    targetId: event.id,
    cityId: node.cityId,
    metadata: { nodeId: node.id, title, scheduledAt: input.scheduledAt.toISOString() },
  });
  return event;
}

// Nodes where the caller may create an event (their create_event grant anchors) —
// for a murabbi this is their class, so the create form offers the right options.
export async function listCreatableNodes(
  ctx: AuthzContext,
): Promise<{ id: string; name: string }[]> {
  const paths = [
    ...new Set(ctx.grants.filter((g) => g.permission === CREATE_EVENT).map((g) => g.anchorPath)),
  ];
  const nodes = await orgNodeRepo.findByPaths(paths);
  return nodes.map((n) => ({ id: n.id, name: n.name }));
}

export type TodayEvent = {
  id: string;
  title: string;
  scheduledAt: Date;
  orgNodeId: string;
  markedCount: number;
  rosterCount: number;
};

// Today's events the caller may see: those anchored under a node where they hold
// view_attendance or mark_attendance (superadmin sees all).
export async function listToday(ctx: AuthzContext): Promise<TodayEvent[]> {
  const anchorPaths = isSuperadmin(ctx)
    ? ("all" as const)
    : [
        ...new Set(
          ctx.grants
            .filter((g) => g.permission === VIEW_ATTENDANCE || g.permission === MARK_ATTENDANCE)
            .map((g) => g.anchorPath),
        ),
      ];

  const events = await eventRepo.listToday(anchorPaths, pktDayRange());
  if (events.length === 0) return [];

  // Rosters per event (concurrent) + ONE grouped marked-count query for all
  // events — N+1 instead of the previous 2N.
  const [rosters, markedByEvent] = await Promise.all([
    Promise.all(events.map((e) => eventRepo.resolveRoster(e))),
    attendanceRepo.countByEvents(events.map((e) => e.id)),
  ]);

  return events.map((e, i) => ({
    id: e.id,
    title: e.title,
    scheduledAt: e.scheduledAt,
    orgNodeId: e.orgNodeId,
    rosterCount: rosters[i].length,
    markedCount: markedByEvent.get(e.id) ?? 0,
  }));
}
