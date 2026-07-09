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

  // Roster SIZES per event (light distinct-personId counts, not full rosters) +
  // ONE grouped marked-count query for all events.
  const [rosterCounts, markedByEvent] = await Promise.all([
    Promise.all(events.map((e) => eventRepo.countRoster(e))),
    attendanceRepo.countByEvents(events.map((e) => e.id)),
  ]);

  return events.map((e, i) => ({
    id: e.id,
    title: e.title,
    scheduledAt: e.scheduledAt,
    orgNodeId: e.orgNodeId,
    rosterCount: rosterCounts[i],
    markedCount: markedByEvent.get(e.id) ?? 0,
  }));
}
