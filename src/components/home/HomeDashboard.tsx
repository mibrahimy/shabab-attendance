"use client";

// Command-center dashboard — the authed landing. For a city admin (or a superadmin
// defaulting to the first city) it's a real overview: attendance headline, org
// KPIs, recent sessions, city shape, and quick actions. Users with neither a city
// nor grants get a clean quick-links state.

import Link from "next/link";
import { Trail } from "./Trail";
import type { LevelCount } from "@/lib/city-summary";

type Dashboard = {
  city: { id: string; name: string };
  levels: LevelCount[];
  peopleCount: number;
  sessions: { total: number; today: number; markedToday: number };
  rate: { present: number; total: number };
  recent: {
    id: string; title: string; when: string; nodeName: string;
    status: "scheduled" | "completed" | "cancelled"; present: number; total: number;
  }[];
};

const STATUS_PILL: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  scheduled: "bg-[#2f55ea]/[0.07] text-[#2f55ea] ring-[#2f55ea]/20",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

function pct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</div>
      <div className={`mt-2 font-num text-2xl font-semibold tracking-tight ${accent ? "text-[#2f55ea]" : "text-slate-900"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/30 hover:shadow-[0_2px_10px_rgba(47,85,234,0.08)]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block truncate text-xs text-slate-400">{desc}</span>
      </span>
      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2f55ea]" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function HomeDashboard({
  dashboard,
  cityId,
  isSuperadmin,
  canMarkAttendance,
}: {
  dashboard: Dashboard | null;
  cityId: string | null;
  isSuperadmin: boolean;
  canMarkAttendance: boolean;
}) {
  if (!dashboard || !cityId) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Welcome</h1>
        <p className="mt-1 text-sm text-slate-500">Here’s what you can do.</p>
        <div className="mt-6 space-y-3 text-start">
          {isSuperadmin && (
            <QuickCard href="/cities" title="Countries & cities" desc="Create the org tree and onboard cities" />
          )}
          {canMarkAttendance && (
            <QuickCard href="/mark" title="Attendance" desc="Mark today’s sessions" />
          )}
        </div>
        {!isSuperadmin && !canMarkAttendance && (
          <p className="mt-6 text-sm text-slate-400">
            Nothing’s assigned to you yet — your city admin can add you to a class or team.
          </p>
        )}
      </div>
    );
  }

  const rate = pct(dashboard.rate.present, dashboard.rate.total);
  const parks = dashboard.levels.find((l) => l.key === "park")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">Dashboard</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{dashboard.city.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">Attendance & organization overview</p>
        </div>
        <Link
          href="/mark"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2f55ea] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.1),0_4px_12px_rgba(47,85,234,0.25)] transition hover:bg-[#2848c8]"
        >
          Take attendance
        </Link>
      </div>

      {/* Cold start: a fresh city with no people yet → point at the hierarchy builder. */}
      {dashboard.peopleCount === 0 && (
        <Link
          href={`/hierarchy/${cityId}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#2f55ea]/20 bg-[#eef1fe] px-5 py-4 transition hover:bg-[#e4eafe]"
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">Set up your city structure</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Add zones, parks and classes, then place your people to get started.
            </span>
          </span>
          <span className="text-[#2f55ea]" aria-hidden>→</span>
        </Link>
      )}

      {/* Attendance headline — the Trail: rate at the head of a comet path of
          recent sessions (brighter = higher attendance). */}
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-[#f6f5ff] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">Attendance</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="bg-[linear-gradient(90deg,#2b27c2,#6f1f9e,#c41f6a)] bg-clip-text font-num text-5xl font-semibold tracking-tight text-transparent">
                {rate}
              </span>
              <span className="text-lg font-semibold text-slate-300">%</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              <span className="font-num text-slate-600">{dashboard.rate.present.toLocaleString()}</span> present of{" "}
              <span className="font-num">{dashboard.rate.total.toLocaleString()}</span> · recent sessions
            </div>
          </div>
          <div className="min-w-[220px] flex-1 sm:max-w-[380px]">
            <Trail points={[...dashboard.recent].reverse().map((s) => pct(s.present, s.total))} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="People" value={dashboard.peopleCount.toLocaleString()} sub="active members" />
        <Stat label="Sessions" value={dashboard.sessions.total.toLocaleString()} sub="recorded" />
        <Stat label="Parks" value={String(parks)} sub={`${dashboard.levels.find((l) => l.key === "class")?.count ?? 0} classes`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent sessions */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Recent sessions</h2>
              <Link href="/mark" className="text-xs font-medium text-[#2f55ea] hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {dashboard.recent.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No sessions yet.</p>
              ) : (
                dashboard.recent.map((s) => {
                  const r = pct(s.present, s.total);
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">{s.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_PILL[s.status]}`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {s.nodeName} · {fmtDate(s.when)}
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-num font-medium text-slate-600">{r}%</span>
                          <span className="font-num">{s.present}/{s.total}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#2f55ea]" style={{ inlineSize: `${r}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right rail: city shape + quick actions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-sm font-semibold text-slate-900">City structure</h2>
            <div className="mt-3 space-y-2">
              {dashboard.levels.map((l) => (
                <Link
                  key={l.key}
                  href={`/hierarchy/${cityId}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50"
                >
                  <span className="text-slate-500">{l.label}</span>
                  <span className="font-num font-semibold text-slate-900">{l.count}</span>
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <span className="text-slate-500">People</span>
                <span className="font-num font-semibold text-slate-900">{dashboard.peopleCount}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <QuickCard href={`/hierarchy/${cityId}`} title="Build hierarchy" desc="View & edit your city’s structure" />
            <QuickCard href={`/roles/${cityId}`} title="Manage roles" desc="Choose what each role can do" />
            {isSuperadmin && (
              <QuickCard href="/cities" title="Countries & cities" desc="Onboard cities" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
