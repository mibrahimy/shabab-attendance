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
  orgNode: { select: { path: true, depth: true } },
} as const;

type Raw = {
  id: string; title: string; orgNodeId: string; rosterDepth: number | null;
  segment: Segment | null; audiencePositionId: string | null; functionId: string | null;
  cityId: string | null; status: EventStatus; scheduledAt: Date;
  orgNode: { path: string; depth: number };
};

function toRow(r: Raw): EventRow {
  const { orgNode, ...rest } = r;
  return { ...rest, orgNodePath: orgNode.path, orgNodeDepth: orgNode.depth };
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

// Today's events whose anchor node is within one of `anchorPaths` (or all events,
// for a superadmin). `anchorPaths` are the caller's trailing-delimited grant paths.
export async function listToday(
  anchorPaths: string[] | "all",
  range: { start: Date; end: Date },
): Promise<EventRow[]> {
  const rows = await prisma.event.findMany({
    where: {
      scheduledAt: { gte: range.start, lt: range.end },
      ...(anchorPaths === "all"
        ? {}
        : { OR: anchorPaths.map((p) => ({ orgNode: { path: { startsWith: p } } })) }),
    },
    orderBy: { scheduledAt: "asc" },
    select: selectWithNode,
  });
  // An empty non-"all" anchor set means "no scope" → no events.
  if (anchorPaths !== "all" && anchorPaths.length === 0) return [];
  return rows.map((r) => toRow(r as Raw));
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

export type RosterPerson = {
  personId: string;
  name: string;
  segment: Segment | null;
  nodePath: string; // the assignment's node path — used for the marker-scope ∩
};

// Live roster: active assignments under the event's anchor within the depth band,
// filtered by the event's segment / audience position when set.
export async function resolveRoster(event: EventRow): Promise<RosterPerson[]> {
  const maxDepth =
    event.rosterDepth == null ? Number.MAX_SAFE_INTEGER : event.orgNodeDepth + event.rosterDepth;

  const rows = await prisma.assignment.findMany({
    where: {
      endDate: null,
      orgNode: { path: { startsWith: event.orgNodePath }, depth: { lte: maxDepth } },
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

export type MarkInput = {
  personId: string;
  status: AttendanceStatus;
  clientUpdatedAt: Date;
  overrideReason?: string | null;
};
