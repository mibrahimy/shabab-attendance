"use client";

// City attendance report — trend (the Trail at scale), overall rate, status
// breakdown, and a by-node table sorted lowest-first for triage. Client-side CSV
// export from the same data.

import Link from "next/link";
import { Trail } from "@/components/home/Trail";
import type { CityReport } from "@/server/services/report-service";

const PERIODS: { key: string; label: string }[] = [
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
  { key: "all", label: "All" },
];

const STATUS_STYLE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700",
  late: "bg-amber-50 text-amber-700",
  absent: "bg-rose-50 text-rose-700",
  excused: "bg-slate-100 text-slate-600",
};

// Rate → bar color: red (low) → amber → green (high). Attendance triage at a glance.
function rateColor(rate: number): string {
  if (rate < 40) return "bg-rose-500";
  if (rate < 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ report, cityId, period }: { report: CityReport; cityId: string; period: string }) {
  const { overall, byStatus, byNode, trend } = report;

  function exportCsv() {
    const header = ["Node", "Level", "Sessions", "Present", "Total", "Rate %"];
    const rows = byNode.map((n) => [n.nodeName, n.level, n.sessions, n.present, n.total, n.rate]);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    download(`${report.city.name}-attendance-report.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">Administration</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">{report.city.name} · attendance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/reports/${cityId}?period=${p.key}`}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  period === p.key ? "bg-[#2f55ea] text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/40 hover:text-[#2f55ea]"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Headline: Trail + overall */}
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-[#f6f5ff] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">Attendance rate</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="bg-[linear-gradient(90deg,#2b27c2,#6f1f9e,#c41f6a)] bg-clip-text font-num text-5xl font-semibold tracking-tight text-transparent">
                {overall.rate}
              </span>
              <span className="text-lg font-semibold text-slate-300">%</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              <span className="font-num text-slate-600">{overall.present.toLocaleString()}</span> present of{" "}
              <span className="font-num">{overall.total.toLocaleString()}</span> · {overall.sessions} sessions
            </div>
          </div>
          <div className="min-w-[220px] flex-1 sm:max-w-[420px]">
            {trend.length > 1 && <Trail points={trend.map((t) => t.rate)} />}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["present", "late", "absent", "excused"] as const).map((s) => (
          <div key={s} className={`rounded-2xl px-4 py-3 ${STATUS_STYLE[s]}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{s}</div>
            <div className="mt-1 font-num text-2xl font-semibold">{byStatus[s].toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* By node — lowest first (triage) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">By location</h2>
          <span className="text-xs text-slate-400">lowest attendance first</span>
        </div>
        <div className="divide-y divide-slate-100">
          {byNode.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No completed sessions yet.</p>
          ) : (
            byNode.map((n) => (
              <div key={n.nodeId} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">{n.nodeName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {n.level}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    <span className="font-num">{n.sessions}</span> sessions ·{" "}
                    <span className="font-num">{n.present}</span>/<span className="font-num">{n.total}</span>
                  </div>
                </div>
                <div className="w-32 shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-num font-medium text-slate-600">{n.rate}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${rateColor(n.rate)}`} style={{ inlineSize: `${n.rate}%` }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
