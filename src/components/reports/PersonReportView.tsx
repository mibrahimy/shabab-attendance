"use client";

// One person's attendance: their rate at the head of a personal Trail ("showing up
// is the mark"), a status breakdown, and a session-by-session timeline.

import Link from "next/link";
import { Trail } from "@/components/home/Trail";
import type { PersonReport } from "@/types/reports";

const STATUS_PILL: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  late: "bg-amber-50 text-amber-700 ring-amber-600/20",
  absent: "bg-rose-50 text-rose-700 ring-rose-600/20",
  excused: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PersonReportView({ report, cityId }: { report: PersonReport; cityId: string }) {
  const { person, overall, byStatus, trend, sessions } = report;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/reports/${cityId}`} className="text-sm text-slate-400 transition hover:text-slate-600">
          ‹ Reports
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{person.name}</h1>
        <p className="mt-0.5 text-sm text-slate-500">Attendance history</p>
      </div>

      {/* Headline: personal Trail */}
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-[#f6f5ff] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">Attendance</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="bg-[linear-gradient(90deg,#2b27c2,#6f1f9e,#c41f6a)] bg-clip-text font-num text-5xl font-semibold tracking-tight text-transparent">
                {overall.rate}
              </span>
              <span className="text-lg font-semibold text-slate-300">%</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              present <span className="font-num text-slate-600">{overall.present}</span> of{" "}
              <span className="font-num">{overall.total}</span> sessions
            </div>
          </div>
          <div className="min-w-[220px] flex-1 sm:max-w-[420px]">
            {trend.length > 1 && <Trail points={trend} />}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["present", "late", "absent", "excused"] as const).map((s) => (
          <div key={s} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s}</div>
            <div className="mt-1 font-num text-2xl font-semibold text-slate-900">{byStatus[s]}</div>
          </div>
        ))}
      </div>

      {/* Session timeline */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Sessions</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sessions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No sessions recorded.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.eventId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{s.title}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">
                    <Link href={`/reports/${cityId}/node/${s.nodeId}`} className="transition hover:text-[#2f55ea]">
                      {s.nodeName}
                    </Link>{" "}
                    · {fmt(s.when)}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_PILL[s.status]}`}>
                  {s.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
