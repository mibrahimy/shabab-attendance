// Event use-cases. Creating an event needs create_event at the anchor node; the
// "today" list is scoped to nodes the caller can view or mark attendance for.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission, isSuperadmin } from "@/server/auth/can-act-on";
import { pktDayRange } from "@/lib/pkt-day";
import { PATH_DELIMITER } from "@/lib/org-path";
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
  input: {
    nodeId: string;
    title: string;
    scheduledAt: Date;
    segment?: Segment | null;
    // Audience: how deep the roster reaches under the anchor. 1 = direct members
    // (a class's students / a park's own staff); null = the whole subtree (a park-
    // wide or zone-wide session). Defaults to direct members.
    rosterDepth?: number | null;
    audiencePositionId?: string | null;
  },
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
    rosterDepth: input.rosterDepth === undefined ? 1 : input.rosterDepth,
    segment: input.segment ?? null,
    audiencePositionId: input.audiencePositionId ?? null,
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

// How many people a not-yet-created event would put on its roster, given the same
// Where / reach / segment inputs createEvent takes. Reuses the EXACT roster
// resolution (countRoster) so the preview can't disagree with the real creation.
export async function previewRosterSize(
  ctx: AuthzContext,
  input: { nodeId: string; rosterDepth?: number | null; segment?: Segment | null },
): Promise<number> {
  const node = await orgNodeRepo.findById(input.nodeId);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, CREATE_EVENT, { path: node.path, functionId: null });

  const draft: eventRepo.EventRow = {
    id: "",
    title: "",
    orgNodeId: node.id,
    orgNodePath: node.path,
    orgNodeDepth: node.depth,
    orgNodeName: node.name,
    rosterDepth: input.rosterDepth === undefined ? 1 : input.rosterDepth,
    segment: input.segment ?? null,
    audiencePositionId: null,
    functionId: null,
    cityId: node.cityId,
    status: "scheduled",
    scheduledAt: new Date(0), // irrelevant to roster resolution
  };
  return eventRepo.countRoster(draft);
}

// Edit an event's title and/or time. Requires create_event on the event's node
// (the same authority that created it). Node/audience aren't editable (would orphan
// existing marks). At least one field must be present.
export async function updateEvent(
  ctx: AuthzContext,
  id: string,
  patch: { title?: string; scheduledAt?: Date },
): Promise<void> {
  const event = await eventRepo.findById(id);
  if (!event) throw new NotFoundError("Event not found");
  requirePermission(ctx, CREATE_EVENT, { path: event.orgNodePath, functionId: null });

  const data: { title?: string; scheduledAt?: Date } = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new ValidationError("Title is required");
    data.title = title;
  }
  if (patch.scheduledAt !== undefined) {
    if (Number.isNaN(patch.scheduledAt.getTime())) throw new ValidationError("Invalid date/time");
    data.scheduledAt = patch.scheduledAt;
  }
  if (data.title === undefined && data.scheduledAt === undefined) {
    throw new ValidationError("Nothing to update");
  }

  await eventRepo.update(id, data);
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "update_event",
    targetType: "Event",
    targetId: id,
    cityId: event.cityId,
    metadata: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt.toISOString() } : {}),
    },
  });
}

// Soft-cancel an event: flips status to cancelled (marks kept; the mark screen
// renders a cancelled event read-only). Requires create_event on its node.
export async function cancelEvent(ctx: AuthzContext, id: string): Promise<void> {
  const event = await eventRepo.findById(id);
  if (!event) throw new NotFoundError("Event not found");
  requirePermission(ctx, CREATE_EVENT, { path: event.orgNodePath, functionId: null });
  if (event.status === "cancelled") return;

  await eventRepo.setStatus(id, "cancelled");
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "cancel_event",
    targetType: "Event",
    targetId: id,
    cityId: event.cityId,
    metadata: { title: event.title },
  });
}

export type CreatableNode = {
  id: string;
  name: string;
  path: string;
  label: string; // readable ancestor chain, e.g. "Islamabad / Zone 1 / Class A"
  levelKey: string;
  levelLabel: string;
  depth: number;
};

// Nodes where the caller may create an event. A create_event grant covers the
// whole subtree under its anchor, so we EXPAND each anchor into every real org
// node beneath it — not just the anchor. Otherwise an admin whose grant sits at a
// high node (e.g. the superadmin at the global root) would only ever be offered
// that one node and could never target an actual class. The synthetic global root
// (depth 0) is excluded — it hosts no audience. Each node carries a readable path
// label so same-named classes stay distinguishable.
export async function listCreatableNodes(ctx: AuthzContext): Promise<CreatableNode[]> {
  const anchorPaths = [
    ...new Set(ctx.grants.filter((g) => g.permission === CREATE_EVENT).map((g) => g.anchorPath)),
  ];
  if (anchorPaths.length === 0) return [];

  // Expand each anchor into its subtree (nested anchors overlap → dedupe by id).
  const subtrees = await Promise.all(anchorPaths.map((p) => orgNodeRepo.listSubtree(p)));
  const byId = new Map<string, orgNodeRepo.SubtreeNode>();
  for (const nodes of subtrees) for (const n of nodes) byId.set(n.id, n);

  const realNodes = [...byId.values()].filter((n) => n.depth > 0); // drop synthetic root
  const nameById = new Map(realNodes.map((n) => [n.id, n.name] as const));
  const labelFor = (n: orgNodeRepo.SubtreeNode): string =>
    n.path
      .split(PATH_DELIMITER)
      .filter(Boolean)
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name))
      .join(" / ");

  return realNodes
    .sort((a, b) => a.path.localeCompare(b.path)) // tree order
    .map((n) => ({
      id: n.id,
      name: n.name,
      path: n.path,
      label: labelFor(n),
      levelKey: n.level.key,
      levelLabel: n.level.label,
      depth: n.depth,
    }));
}

export type EventScope = "today" | "upcoming" | "past";

export type ListedEvent = {
  id: string;
  title: string;
  scheduledAt: Date;
  orgNodeId: string;
  nodeName: string;
  status: "scheduled" | "completed" | "cancelled";
  markedCount: number;
  rosterCount: number;
};

// Nodes the caller may see attendance for: those where they hold view_attendance
// or mark_attendance (superadmin sees all). Shared by every scoped event list.
function viewAnchorPaths(ctx: AuthzContext): string[] | "all" {
  return isSuperadmin(ctx)
    ? "all"
    : [
        ...new Set(
          ctx.grants
            .filter((g) => g.permission === VIEW_ATTENDANCE || g.permission === MARK_ATTENDANCE)
            .map((g) => g.anchorPath),
        ),
      ];
}

// Attach per-event roster size + marked count. Roster SIZES are light distinct-
// personId counts (not full rosters); marked counts are one grouped query.
async function withCounts(events: eventRepo.EventRow[]): Promise<ListedEvent[]> {
  if (events.length === 0) return [];
  const [rosterCounts, markedByEvent] = await Promise.all([
    Promise.all(events.map((e) => eventRepo.countRoster(e))),
    attendanceRepo.countByEvents(events.map((e) => e.id)),
  ]);
  return events.map((e, i) => ({
    id: e.id,
    title: e.title,
    scheduledAt: e.scheduledAt,
    orgNodeId: e.orgNodeId,
    nodeName: e.orgNodeName,
    status: e.status,
    rosterCount: rosterCounts[i],
    markedCount: markedByEvent.get(e.id) ?? 0,
  }));
}

const PAST_LIMIT = 30;

// Scoped event list for the attendance hub. Today = the PKT day (any status);
// Upcoming = still-scheduled sessions after today (soonest first); Past = anything
// before today (most recent first, capped at PAST_LIMIT so late marking stays
// reachable). All three are scoped to the caller's view/mark anchors.
export async function listEvents(ctx: AuthzContext, scope: EventScope): Promise<ListedEvent[]> {
  const anchorPaths = viewAnchorPaths(ctx);
  const today = pktDayRange();
  let events: eventRepo.EventRow[];
  if (scope === "upcoming") {
    events = await eventRepo.listInScope(anchorPaths, {
      range: { start: today.end },
      statuses: ["scheduled"],
      order: "asc",
    });
  } else if (scope === "past") {
    events = await eventRepo.listInScope(anchorPaths, {
      range: { end: today.start },
      order: "desc",
      take: PAST_LIMIT,
    });
  } else {
    events = await eventRepo.listInScope(anchorPaths, { range: today, order: "asc" });
  }
  return withCounts(events);
}
