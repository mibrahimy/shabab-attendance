"use client";

// City attendance report — trend (the Trail at scale), overall rate, status
// breakdown, and a by-node table sorted lowest-first for triage. Client-side CSV
// export from the same data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Trail } from "@/components/home/Trail";
import type { ReportBody, NodePerson, Crumb } from "@/server/services/report-service";

type PersonHit = { id: string; name: string; nodeName: string | null };

// Debounced people typeahead → per-person report. On a node report `nodeId` scopes
// the search to that node's subtree.
function PeopleSearch({ cityId, nodeId }: { cityId: string; nodeId?: string }) {
  const { t } = useTranslation("reports");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonHit[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setResults([]);
        return;
      }
      const node = nodeId ? `&node=${encodeURIComponent(nodeId)}` : "";
      fetch(`/api/cities/${cityId}/people?q=${encodeURIComponent(query)}${node}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setResults(j?.data?.people ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, cityId, nodeId]);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPersonPlaceholder", "Find a person’s attendance…")}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {results.map((p) => (
            <li key={p.id}>
              <Link
                href={`/reports/${cityId}/person/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]">
                    {p.name.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{p.name}</span>
                </span>
                {p.nodeName && <span className="text-xs text-slate-400">{p.nodeName}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type NodeHit = { id: string; name: string; level: string };

// Debounced node typeahead → any zone/park/class report in the current city.
function NodeSearch({ cityId, nodeId }: { cityId: string; nodeId?: string }) {
  const { t } = useTranslation("reports");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NodeHit[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setResults([]);
        return;
      }
      const node = nodeId ? `&node=${encodeURIComponent(nodeId)}` : "";
      fetch(`/api/cities/${cityId}/nodes?q=${encodeURIComponent(query)}${node}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setResults(j?.data?.nodes ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, cityId, nodeId]);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchLocationPlaceholder", "Search a zone, park, or class…")}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {results.map((n) => (
            <li key={n.id}>
              <Link
                href={`/reports/${cityId}/node/${n.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50"
              >
                <span className="truncate text-sm font-medium text-slate-900">{n.name}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {n.level}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

// A PKT week's Sunday, labeled as "Jul 5" in the org's timezone.
function fmtWeek(weekStartIso: string): string {
  return new Date(weekStartIso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", timeZone: "Asia/Karachi",
  });
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

export function ReportView({
  report, cityId, period, heading, basePath, csvName,
  nodeId, trail, people, peopleTruncated,
}: {
  report: ReportBody;
  cityId: string;
  period: string;
  heading: { title: string; subtitle: string; backHref?: string };
  basePath: string; // period links → `${basePath}?period=`
  csvName: string;
  nodeId?: string; // set on a node report → scopes the people-search to the subtree
  trail?: Crumb[]; // node report ancestor breadcrumb (city → … → parent)
  people?: NodePerson[]; // node report "people here" (undefined on the city report)
  peopleTruncated?: boolean;
}) {
  const { t } = useTranslation("reports");
  const { overall, byStatus, byNode, trend, weekly, weekSummary } = report;

  // The headline Trail reads best as weekly progress; fall back to the per-session
  // trend only when there aren't enough weeks to draw a line.
  const trailPoints = weekly.length > 1 ? weekly.map((w) => w.rate) : trend.map((t) => t.rate);
  const weeks = weekly.slice(-12); // recent weeks for the trend strip
  const { thisWeek, lastWeek, deltaPts } = weekSummary;

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const nodeHeader = ["Node", "Level", "Sessions", "Present", "Total", "Rate %"];
    const nodeRows = byNode.map((n) => [n.nodeName, n.level, n.sessions, n.present, n.total, n.rate]);
    const weekHeader = ["Week of", "Sessions", "Present", "Total", "Rate %"];
    const weekRows = weekly.map((w) => [fmtWeek(w.weekStart), w.sessions, w.present, w.total, w.rate]);
    const csv = [nodeHeader, ...nodeRows, [], weekHeader, ...weekRows]
      .map((r) => r.map(esc).join(","))
      .join("\n");
    download(`${csvName}-attendance-report.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {trail && trail.length > 0 ? (
            <nav aria-label={t("breadcrumb", "Breadcrumb")} className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
              {trail.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className="text-slate-300">›</span>}
                  <Link
                    href={c.isCity ? `/reports/${cityId}` : `/reports/${cityId}/node/${c.id}`}
                    className="transition hover:text-[#2f55ea]"
                  >
                    {c.name}
                  </Link>
                </span>
              ))}
              <span aria-hidden className="text-slate-300">›</span>
              <span className="text-slate-500">{heading.title}</span>
            </nav>
          ) : (
            heading.backHref && (
              <Link href={heading.backHref} className="text-sm text-slate-400 transition hover:text-slate-600">‹ Reports</Link>
            )
          )}
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">Administration</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{heading.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{heading.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`${basePath}?period=${p.key}`}
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
            {thisWeek.total > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-400">This week</span>
                <span className="font-num font-semibold text-slate-700">{thisWeek.rate}%</span>
                {lastWeek.total > 0 && (
                  <span className={`font-num font-semibold ${deltaPts > 0 ? "text-emerald-600" : deltaPts < 0 ? "text-rose-500" : "text-slate-400"}`}>
                    {deltaPts > 0 ? "▲" : deltaPts < 0 ? "▼" : "±"} {Math.abs(deltaPts)} pts
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="min-w-[220px] flex-1 sm:max-w-[420px]">
            {trailPoints.length > 1 && <Trail points={trailPoints} />}
          </div>
        </div>
      </div>

      {/* Weekly trend — attendance by PKT calendar week (Sun–Sat) */}
      {weeks.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Weekly progress</h2>
            <span className="text-xs text-slate-400">last {weeks.length} week{weeks.length === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-4 flex items-end gap-2 sm:gap-3">
            {weeks.map((w) => (
              <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${fmtWeek(w.weekStart)} · ${w.present}/${w.total} · ${w.sessions} session${w.sessions === 1 ? "" : "s"}`}>
                <span className="font-num text-[11px] font-semibold text-slate-600">{w.rate}</span>
                <div className="flex h-24 w-full items-end rounded-md bg-slate-50">
                  <div className={`w-full rounded-md ${rateColor(w.rate)}`} style={{ blockSize: `${Math.max(w.rate, 3)}%` }} />
                </div>
                <span className="truncate text-[10px] text-slate-400">{fmtWeek(w.weekStart)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["present", "late", "absent", "excused"] as const).map((s) => (
          <div key={s} className={`rounded-2xl px-4 py-3 ${STATUS_STYLE[s]}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{s}</div>
            <div className="mt-1 font-num text-2xl font-semibold">{byStatus[s].toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Jump to any location + people search → per-person report */}
      <div className="grid gap-3 sm:grid-cols-2">
        <NodeSearch cityId={cityId} nodeId={nodeId} />
        <PeopleSearch cityId={cityId} nodeId={nodeId} />
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
              <Link
                key={n.nodeId}
                href={`/reports/${cityId}/node/${n.nodeId}`}
                className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50"
              >
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
                <span className="text-slate-300" aria-hidden>›</span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* People here — the node's tracked individuals, worst attendance first */}
      {people && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t("peopleHere", "People here")}</h2>
            <span className="text-xs text-slate-400">{t("peopleHint", "lowest attendance first")}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {people.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">{t("noPeople", "No tracked attendance yet.")}</p>
            ) : (
              people.map((p) => (
                <Link
                  key={p.id}
                  href={`/reports/${cityId}/person/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]">
                    {p.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {p.role ? <span>{p.role} · </span> : null}
                      <span className="font-num">{p.present}</span>/<span className="font-num">{p.total}</span>
                    </div>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-num font-medium text-slate-600">{p.rate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${rateColor(p.rate)}`} style={{ inlineSize: `${p.rate}%` }} />
                    </div>
                  </div>
                  <span className="text-slate-300" aria-hidden>›</span>
                </Link>
              ))
            )}
          </div>
          {peopleTruncated && (
            <p className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-400">
              {t("peopleTruncated", "Showing the {{count}} lowest — search above for anyone else.", { count: people.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
