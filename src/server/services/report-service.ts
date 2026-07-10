// City attendance reporting. Read-only aggregates over completed sessions, scoped
// by view_attendance on the city (superadmin + city admin hold it). Computed from
// a few grouped queries — no per-event fan-out.

import type { AuthzContext } from "@/types/auth";
import { NotFoundError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import type { AttendanceStatus } from "@/lib/attendance-status";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as eventRepo from "@/server/repositories/event-repo";
import * as attendanceRepo from "@/server/repositories/attendance-repo";

export type CityReport = {
  city: { id: string; name: string };
  overall: { present: number; total: number; rate: number; sessions: number };
  byStatus: Record<AttendanceStatus, number>;
  byNode: {
    nodeId: string; nodeName: string; level: string;
    sessions: number; present: number; total: number; rate: number;
  }[];
  trend: { when: string; rate: number }[];
};

function pct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

export async function getCityReport(ctx: AuthzContext, cityId: string): Promise<CityReport> {
  const city = await orgNodeRepo.findById(cityId);
  if (!city) throw new NotFoundError("City not found");
  requirePermission(ctx, "view_attendance", { path: city.path, functionId: null });

  const [overall, byStatus, events] = await Promise.all([
    attendanceRepo.rateInCity(cityId),
    attendanceRepo.statusBreakdownInCity(cityId),
    eventRepo.listCompletedInCity(cityId),
  ]);
  const ratesByEvent = await attendanceRepo.statusByEvents(events.map((e) => e.id));

  // Aggregate per anchor node (park/class/…).
  const agg = new Map<string, { nodeName: string; level: string; sessions: number; present: number; total: number }>();
  for (const e of events) {
    const s = ratesByEvent.get(e.id) ?? { present: 0, total: 0 };
    const cur = agg.get(e.orgNodeId) ?? { nodeName: e.nodeName, level: e.nodeLevel, sessions: 0, present: 0, total: 0 };
    cur.sessions += 1;
    cur.present += s.present;
    cur.total += s.total;
    agg.set(e.orgNodeId, cur);
  }
  const byNode = [...agg.entries()]
    .map(([nodeId, v]) => ({ nodeId, ...v, rate: pct(v.present, v.total) }))
    .sort((a, b) => a.rate - b.rate); // lowest first — triage

  // Trend: last ~14 completed sessions, oldest→newest (feeds the Trail at scale).
  const trend = events.slice(-14).map((e) => {
    const s = ratesByEvent.get(e.id) ?? { present: 0, total: 0 };
    return { when: e.scheduledAt.toISOString(), rate: pct(s.present, s.total) };
  });

  return {
    city: { id: city.id, name: city.name },
    overall: { present: overall.present, total: overall.total, rate: pct(overall.present, overall.total), sessions: events.length },
    byStatus,
    byNode,
    trend,
  };
}
