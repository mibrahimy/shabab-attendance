// City attendance reporting. Read-only aggregates over completed sessions, scoped
// by view_attendance on the city (superadmin + city admin hold it). Computed from
// a few grouped queries — no per-event fan-out.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import type { AttendanceStatus } from "@/lib/attendance-status";
import { pktWeekStart, pktWeekRange, pktPrevWeekRange } from "@/lib/pkt-week";
import { PATH_DELIMITER } from "@/lib/org-path";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as eventRepo from "@/server/repositories/event-repo";
import * as attendanceRepo from "@/server/repositories/attendance-repo";
import * as personRepo from "@/server/repositories/person-repo";

// Client-facing report response contracts live in types/ (a pure leaf) so the report
// components can consume them without importing from @/server. Re-exported here for
// server callers that reach them through this service.
import type {
  WeekBucket, ReportBody, CityReport, NodePerson, Crumb, NodeReport, PersonReport,
} from "@/types/reports";
export type {
  WeekBucket, ReportBody, CityReport, NodePerson, Crumb, NodeReport, PersonReport,
} from "@/types/reports";

// Cap on the node report's people list — bounded triage (lowest-rate-first); the
// node-scoped people-search covers finding anyone past the cap.
const NODE_PEOPLE_CAP = 50;

function pct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

// Bucket completed events into PKT calendar weeks (Sun–Sat), summing present/total
// over each week's sessions. Pure — reused by getCityReport and unit-tested. Weeks
// with no sessions are absent (not zero-filled), so a trend line reflects only
// weeks the org actually met.
export function buildWeekly(
  events: { id: string; scheduledAt: Date }[],
  ratesByEvent: Map<string, { present: number; total: number }>,
): WeekBucket[] {
  const m = new Map<number, { present: number; total: number; sessions: number }>();
  for (const e of events) {
    const key = pktWeekStart(e.scheduledAt).getTime();
    const s = ratesByEvent.get(e.id) ?? { present: 0, total: 0 };
    const cur = m.get(key) ?? { present: 0, total: 0, sessions: 0 };
    cur.present += s.present;
    cur.total += s.total;
    cur.sessions += 1;
    m.set(key, cur);
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, v]) => ({ weekStart: new Date(ms).toISOString(), present: v.present, total: v.total, sessions: v.sessions, rate: pct(v.present, v.total) }));
}

async function requireCityView(ctx: AuthzContext, cityId: string): Promise<orgNodeRepo.OrgNodeRow> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  requirePermission(ctx, "view_attendance", { path: city.path, functionId: null });
  return city;
}

// People-search for the reports drill-down. City-wide by default (scoped by
// view_attendance on the city). When `nodeId` is given the search is scoped to that
// node's subtree and guarded by view_attendance on the node's path, so it can never
// surface people outside the caller's view scope for that node.
export async function searchPeople(
  ctx: AuthzContext,
  cityId: string,
  query: string,
  nodeId?: string,
): Promise<personRepo.PersonSearchResult[]> {
  const q = query.trim();
  if (nodeId) {
    const node = await orgNodeRepo.findById(nodeId);
    if (!node) throw new NotFoundError("Node not found");
    requirePermission(ctx, "view_attendance", { path: node.path, functionId: null });
    if (q.length < 2) return [];
    return personRepo.searchInCity(cityId, q, 20, node.path);
  }
  await requireCityView(ctx, cityId);
  if (q.length < 2) return [];
  return personRepo.searchInCity(cityId, q, 20);
}

// Node-search for the reports "jump to a location" picker. City-wide by default
// (view_attendance on the city). On a node report `nodeId` scopes the search to
// that node's subtree and guards on the node's path — so a lead who can only view
// a sub-node still gets a working, correctly-scoped location search.
export async function searchNodes(
  ctx: AuthzContext,
  cityId: string,
  query: string,
  nodeId?: string,
): Promise<orgNodeRepo.NodeSearchResult[]> {
  const q = query.trim();
  if (nodeId) {
    const node = await orgNodeRepo.findById(nodeId);
    if (!node) throw new NotFoundError("Node not found");
    requirePermission(ctx, "view_attendance", { path: node.path, functionId: null });
    if (q.length < 2) return [];
    return orgNodeRepo.searchInCity(cityId, q, 20, node.path);
  }
  await requireCityView(ctx, cityId);
  if (q.length < 2) return [];
  return orgNodeRepo.searchInCity(cityId, q, 20);
}

// Ancestor ids of a node's report breadcrumb, ordered city → … → node's parent
// (the node itself and the root/country above the city are excluded). Pure — the
// path is trailing-delimited "/root/country/city/…/node/", so splitting on the
// delimiter yields the id chain. Unit-tested.
export function ancestorIdsForTrail(path: string, cityId: string): string[] {
  const ids = path.split(PATH_DELIMITER).filter((s) => s.length > 0);
  const cityIdx = ids.indexOf(cityId);
  if (cityIdx < 0) return [];
  return ids.slice(cityIdx, ids.length - 1);
}

const LIT: Record<AttendanceStatus, number> = { present: 100, late: 100, excused: 40, absent: 0 };

// One person's attendance history + rollups. Scoped by view_attendance on the
// person's city.
export async function getPersonReport(ctx: AuthzContext, personId: string): Promise<PersonReport> {
  const person = await personRepo.findById(personId);
  if (!person) throw new NotFoundError("Person not found");
  if (!person.cityId) throw new NotFoundError("Person has no city");
  await requireCityView(ctx, person.cityId);

  const rows = await attendanceRepo.listByPerson(personId);
  const byStatus: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of rows) byStatus[r.status] += 1;
  const present = byStatus.present;
  const total = rows.length;

  const trend = rows
    .slice(0, 14)
    .reverse()
    .map((r) => LIT[r.status]);

  return {
    person: { id: person.id, name: person.name },
    overall: { present, total, rate: pct(present, total) },
    byStatus,
    trend,
    sessions: rows.map((r) => ({
      eventId: r.eventId, title: r.title, when: r.when.toISOString(), nodeId: r.nodeId, nodeName: r.nodeName, status: r.status,
    })),
  };
}

export type DateRange = { start: Date; end: Date };

// Assemble the shared report body from a completed-event set + its rates. Reused by
// the city report and any node-scoped report.
type RollupChild = { id: string; name: string; path: string; levelLabel: string };

function assembleBody(
  overall: { present: number; total: number },
  byStatus: Record<AttendanceStatus, number>,
  events: eventRepo.ReportEvent[],
  ratesByEvent: Map<string, { present: number; total: number }>,
  rollup: { children: RollupChild[]; self: { id: string; name: string; levelLabel: string } },
): ReportBody {
  // Roll each event up to the report node's DIRECT CHILD whose subtree contains it
  // (city → zones → parks → classes), so the table is one navigable tier per row.
  // Events anchored at the report node itself bucket under "self".
  const bucketFor = (e: eventRepo.ReportEvent) => {
    const c = rollup.children.find((c) => e.nodePath.startsWith(c.path));
    return c
      ? { id: c.id, name: c.name, level: c.levelLabel }
      : { id: rollup.self.id, name: rollup.self.name, level: rollup.self.levelLabel };
  };
  const agg = new Map<string, { nodeName: string; level: string; sessions: number; present: number; total: number }>();
  for (const e of events) {
    const b = bucketFor(e);
    const s = ratesByEvent.get(e.id) ?? { present: 0, total: 0 };
    const cur = agg.get(b.id) ?? { nodeName: b.name, level: b.level, sessions: 0, present: 0, total: 0 };
    cur.sessions += 1;
    cur.present += s.present;
    cur.total += s.total;
    agg.set(b.id, cur);
  }
  const byNode = [...agg.entries()]
    .map(([nodeId, v]) => ({ nodeId, ...v, rate: pct(v.present, v.total) }))
    .sort((a, b) => a.rate - b.rate);

  const trend = events.slice(-14).map((e) => {
    const s = ratesByEvent.get(e.id) ?? { present: 0, total: 0 };
    return { when: e.scheduledAt.toISOString(), rate: pct(s.present, s.total) };
  });

  const weekly = buildWeekly(events, ratesByEvent);
  const byWeekStart = new Map(weekly.map((w) => [w.weekStart, w]));
  const emptyWeek = (weekStart: string): WeekBucket => ({ weekStart, present: 0, total: 0, rate: 0, sessions: 0 });
  const thisWeek = byWeekStart.get(pktWeekRange().start.toISOString()) ?? emptyWeek(pktWeekRange().start.toISOString());
  const lastWeek = byWeekStart.get(pktPrevWeekRange().start.toISOString()) ?? emptyWeek(pktPrevWeekRange().start.toISOString());

  return {
    overall: { present: overall.present, total: overall.total, rate: pct(overall.present, overall.total), sessions: events.length },
    byStatus,
    byNode,
    trend,
    weekly,
    weekSummary: { thisWeek, lastWeek, deltaPts: thisWeek.rate - lastWeek.rate },
  };
}

export async function getCityReport(ctx: AuthzContext, cityId: string, range?: DateRange): Promise<CityReport> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  requirePermission(ctx, "view_attendance", { path: city.path, functionId: null });

  const [overall, byStatus, events, children] = await Promise.all([
    attendanceRepo.rateInCity(cityId, range),
    attendanceRepo.statusBreakdownInCity(cityId, range),
    eventRepo.listCompletedInCity(cityId, range),
    orgNodeRepo.listChildrenLeveled(city.id),
  ]);
  const ratesByEvent = await attendanceRepo.statusByEvents(events.map((e) => e.id));
  const rollup = {
    children: children.map((c) => ({ id: c.id, name: c.name, path: c.path, levelLabel: c.level.label })),
    self: { id: city.id, name: city.name, levelLabel: "City" },
  };
  return { city: { id: city.id, name: city.name }, ...assembleBody(overall, byStatus, events, ratesByEvent, rollup) };
}

// The same report scoped to any node's subtree (drill-down from the by-location
// table). Guarded by view_attendance on the node's path.
export async function getNodeReport(ctx: AuthzContext, nodeId: string, range?: DateRange): Promise<NodeReport> {
  const node = await orgNodeRepo.findById(nodeId);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, "view_attendance", { path: node.path, functionId: null });

  const [overall, byStatus, events, children, levels] = await Promise.all([
    attendanceRepo.rateUnderNode(node.path, range),
    attendanceRepo.statusBreakdownUnderNode(node.path, range),
    eventRepo.listCompletedUnderNode(node.path, range),
    orgNodeRepo.listChildrenLeveled(node.id),
    node.cityId ? nodeTypeRepo.listCityLevels(node.cityId) : Promise.resolve([]),
  ]);
  const ratesByEvent = await attendanceRepo.statusByEvents(events.map((e) => e.id));
  const level = levels.find((l) => l.id === node.typeId)?.label ?? "";
  const rollup = {
    children: children.map((c) => ({ id: c.id, name: c.name, path: c.path, levelLabel: c.level.label })),
    self: { id: node.id, name: node.name, levelLabel: level },
  };

  // People here — rank everyone tracked under the node lowest-rate-first (triage),
  // cap the list, then resolve names/roles for just the capped slice.
  const perPerson = await attendanceRepo.ratesByPersonUnderNode(node.path, range);
  const ranked = [...perPerson.entries()]
    .map(([id, v]) => ({ id, present: v.present, total: v.total, rate: pct(v.present, v.total) }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total)
    .slice(0, NODE_PEOPLE_CAP);
  const peopleTruncated = perPerson.size > ranked.length;
  const info = await personRepo.listByIdsWithNodeRole(ranked.map((r) => r.id), node.path);
  const infoById = new Map(info.map((i) => [i.id, i]));
  const people: NodePerson[] = ranked.map((r) => ({
    id: r.id,
    name: infoById.get(r.id)?.name ?? "—",
    role: infoById.get(r.id)?.role ?? null,
    present: r.present, total: r.total, rate: r.rate,
  }));

  // Breadcrumb trail — the node's ancestors from the city down to its parent.
  const ancestorIds = ancestorIdsForTrail(node.path, node.cityId ?? "");
  const ancestors = await orgNodeRepo.findByIds(ancestorIds);
  const nameById = new Map(ancestors.map((a) => [a.id, a.name]));
  const trail: Crumb[] = ancestorIds
    .filter((id) => nameById.has(id))
    .map((id) => ({ id, name: nameById.get(id)!, isCity: id === node.cityId }));

  return {
    node: { id: node.id, name: node.name, level },
    people,
    peopleTruncated,
    trail,
    ...assembleBody(overall, byStatus, events, ratesByEvent, rollup),
  };
}
