// Event data access, incl. LIVE roster resolution (there is no enrolled-roster
// table — the roster is computed from the org tree at query time).

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";
import type { AttendanceStatus } from "@/lib/attendance-status";

type Segment = "junior" | "senior";
type EventStatus = "scheduled" | "completed" | "cancelled";

export type EventRow = {
  id: string;
  title: string;
  orgNodeId: string;
  orgNodePath: string;
  orgNodeDepth: number;
  orgNodeName: string;
  rosterDepth: number | null;
  segment: Segment | null;
  audiencePositionId: string | null;
  functionId: string | null;
  cityId: string | null;
  status: EventStatus;
  scheduledAt: Date;
};

const selectWithNode = {
  id: true,
  title: true,
  orgNodeId: true,
  rosterDepth: true,
  segment: true,
  audiencePositionId: true,
  functionId: true,
  cityId: true,
  status: true,
  scheduledAt: true,
  orgNode: { select: { path: true, depth: true, name: true } },
} as const;

type Raw = {
  id: string; title: string; orgNodeId: string; rosterDepth: number | null;
  segment: Segment | null; audiencePositionId: string | null; functionId: string | null;
  cityId: string | null; status: EventStatus; scheduledAt: Date;
  orgNode: { path: string; depth: number; name: string };
};

function toRow(r: Raw): EventRow {
  const { orgNode, ...rest } = r;
  return { ...rest, orgNodePath: orgNode.path, orgNodeDepth: orgNode.depth, orgNodeName: orgNode.name };
}

export async function create(
  input: {
    title: string;
    orgNodeId: string;
    cityId: string | null;
    scheduledAt: Date;
    rosterDepth?: number | null;
    segment?: Segment | null;
    audiencePositionId?: string | null;
    functionId?: string | null;
    createdById?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.event.create({
    data: {
      title: input.title,
      orgNodeId: input.orgNodeId,
      cityId: input.cityId,
      scheduledAt: input.scheduledAt,
      rosterDepth: input.rosterDepth ?? 1,
      segment: input.segment ?? null,
      audiencePositionId: input.audiencePositionId ?? null,
      functionId: input.functionId ?? null,
      createdById: input.createdById ?? null,
    },
    select: { id: true },
  });
}

export async function findById(id: string): Promise<EventRow | null> {
  const r = await prisma.event.findUnique({ where: { id }, select: selectWithNode });
  return r ? toRow(r as Raw) : null;
}

// Edit an event's title and/or time. Node / audience are intentionally not editable
// here (changing them after marks exist would orphan attendance).
export async function update(
  id: string,
  patch: { title?: string; scheduledAt?: Date },
  db: Db = prisma,
): Promise<void> {
  await db.event.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
    },
  });
}

// Soft state change (e.g. cancel) — attendance rows are kept.
export async function setStatus(id: string, status: EventStatus, db: Db = prisma): Promise<void> {
  await db.event.update({ where: { id }, data: { status } });
}

// Events whose anchor node is within one of `anchorPaths` (or all events, for a
// superadmin), filtered by an optional scheduledAt window + status set. This is the
// one scoped list query; Today/Upcoming/Past are just different windows over it.
// `anchorPaths` are the caller's trailing-delimited grant paths.
export async function listInScope(
  anchorPaths: string[] | "all",
  opts: {
    range?: { start?: Date; end?: Date };
    statuses?: EventStatus[];
    order?: "asc" | "desc";
    take?: number;
  } = {},
): Promise<EventRow[]> {
  // An empty non-"all" anchor set means "no scope" → no events.
  if (anchorPaths !== "all" && anchorPaths.length === 0) return [];
  const { range, statuses, order = "asc", take } = opts;
  const scheduledAt =
    range && (range.start || range.end)
      ? { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lt: range.end } : {}) }
      : undefined;
  const rows = await prisma.event.findMany({
    where: {
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(anchorPaths === "all"
        ? {}
        : { OR: anchorPaths.map((p) => ({ orgNode: { path: { startsWith: p } } })) }),
    },
    orderBy: { scheduledAt: order },
    ...(take ? { take } : {}),
    select: selectWithNode,
  });
  return rows.map((r) => toRow(r as Raw));
}

// Today's events, all statuses (a thin caller over listInScope).
export async function listToday(
  anchorPaths: string[] | "all",
  range: { start: Date; end: Date },
): Promise<EventRow[]> {
  return listInScope(anchorPaths, { range });
}

// Dashboard signal: how many events are scheduled in a city today, and how many
// have any attendance recorded ("started"). Two cheap counts.
export async function todayStatsInCity(
  cityId: string,
  range: { start: Date; end: Date },
): Promise<{ events: number; started: number }> {
  const where = { cityId, scheduledAt: { gte: range.start, lt: range.end } };
  const [events, started] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.count({ where: { ...where, attendances: { some: {} } } }),
  ]);
  return { events, started };
}

export async function countInCity(cityId: string): Promise<number> {
  return prisma.event.count({ where: { cityId } });
}

// Ids of the most-recent COMPLETED events anchored at a node (newest-first) — for
// the report's trend trail. Rates are computed in the service via statusByEvents.
export async function recentCompletedAtNode(orgNodeId: string, limit: number): Promise<string[]> {
  const rows = await prisma.event.findMany({
    where: { orgNodeId, status: "completed" },
    orderBy: { scheduledAt: "desc" },
    take: limit,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type ReportEvent = {
  id: string; orgNodeId: string; nodeName: string; nodeLevel: string; nodePath: string; scheduledAt: Date;
};

// All completed sessions in a city (oldest→newest, optionally within a date range)
// with their anchor node's name + level — raw material for the reporting aggregates.
export async function listCompletedInCity(
  cityId: string,
  range?: { start: Date; end: Date },
): Promise<ReportEvent[]> {
  const rows = await prisma.event.findMany({
    where: {
      cityId,
      status: "completed",
      ...(range ? { scheduledAt: { gte: range.start, lt: range.end } } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true, orgNodeId: true, scheduledAt: true,
      orgNode: { select: { name: true, path: true, type: { select: { key: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id, orgNodeId: r.orgNodeId, nodeName: r.orgNode.name, nodePath: r.orgNode.path,
    nodeLevel: r.orgNode.type.key ?? "", scheduledAt: r.scheduledAt,
  }));
}

// All completed sessions anywhere within a node's subtree (path prefix), oldest→
// newest — the node report's raw material. Same shape as listCompletedInCity.
export async function listCompletedUnderNode(
  path: string,
  range?: { start: Date; end: Date },
): Promise<ReportEvent[]> {
  const rows = await prisma.event.findMany({
    where: {
      status: "completed",
      orgNode: { path: { startsWith: path } },
      ...(range ? { scheduledAt: { gte: range.start, lt: range.end } } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true, orgNodeId: true, scheduledAt: true,
      orgNode: { select: { name: true, path: true, type: { select: { key: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id, orgNodeId: r.orgNodeId, nodeName: r.orgNode.name, nodePath: r.orgNode.path,
    nodeLevel: r.orgNode.type.key ?? "", scheduledAt: r.scheduledAt,
  }));
}

export type RecentEvent = {
  id: string; title: string; scheduledAt: Date; status: EventStatus; nodeName: string;
};

// Most-recent HELD (completed) sessions in a city — the dashboard's recent list,
// which is about sessions that actually happened and were marked (scheduled ones
// are upcoming, not "recent"). Lightweight — no live roster resolution.
export async function recentInCity(cityId: string, limit: number): Promise<RecentEvent[]> {
  const rows = await prisma.event.findMany({
    where: { cityId, status: "completed" },
    orderBy: { scheduledAt: "desc" },
    take: limit,
    select: { id: true, title: true, scheduledAt: true, status: true, orgNode: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, scheduledAt: r.scheduledAt, status: r.status, nodeName: r.orgNode.name }));
}

export type RosterPerson = {
  personId: string;
  name: string;
  segment: Segment | null;
  nodePath: string; // the assignment's node path — used for the marker-scope ∩
};

// The org-node predicate for an event's roster: the anchor subtree (path prefix),
// bounded by rosterDepth. rosterDepth null = whole subtree → NO depth bound (a
// large sentinel would overflow Postgres INT4). A number bounds it.
function rosterNodeWhere(event: EventRow) {
  return event.rosterDepth == null
    ? { path: { startsWith: event.orgNodePath } }
    : { path: { startsWith: event.orgNodePath }, depth: { lte: event.orgNodeDepth + event.rosterDepth } };
}

// Live roster: active assignments under the event's anchor within the depth band,
// filtered by the event's segment / audience position when set.
export async function resolveRoster(event: EventRow): Promise<RosterPerson[]> {
  const rows = await prisma.assignment.findMany({
    where: {
      endDate: null,
      orgNode: rosterNodeWhere(event),
      ...(event.audiencePositionId ? { positionId: event.audiencePositionId } : {}),
      ...(event.segment ? { person: { segment: event.segment } } : {}),
    },
    select: {
      person: { select: { id: true, name: true, segment: true } },
      orgNode: { select: { path: true } },
    },
    orderBy: { person: { name: "asc" } },
  });

  // One person can hold >1 assignment in the band; dedupe by personId (keep first).
  const seen = new Set<string>();
  const out: RosterPerson[] = [];
  for (const r of rows) {
    if (seen.has(r.person.id)) continue;
    seen.add(r.person.id);
    out.push({
      personId: r.person.id,
      name: r.person.name,
      segment: r.person.segment,
      nodePath: r.orgNode.path,
    });
  }
  return out;
}

// Roster SIZE only — for the "today" list's per-event count. Fetches just distinct
// personIds (not names/paths), so it's far lighter than resolveRoster when all we
// need is a number.
export async function countRoster(event: EventRow): Promise<number> {
  const rows = await prisma.assignment.findMany({
    where: {
      endDate: null,
      orgNode: rosterNodeWhere(event),
      ...(event.audiencePositionId ? { positionId: event.audiencePositionId } : {}),
      ...(event.segment ? { person: { segment: event.segment } } : {}),
    },
    select: { personId: true },
    distinct: ["personId"],
  });
  return rows.length;
}

export type MarkInput = {
  personId: string;
  status: AttendanceStatus;
  clientUpdatedAt: Date;
  overrideReason?: string | null;
};
