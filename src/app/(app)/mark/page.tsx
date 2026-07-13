"use client";

// Attendance hub — the marker's events across Today / Upcoming / Past. Today is
// grouped To mark / Done; Upcoming and Past are grouped under date headers. Tap a
// card to open the Mark screen. Keeps the create-event affordance and the
// offline/pending chip.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Eyebrow from "@/components/ui/Eyebrow";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/hooks/use-online";
import { pending as pendingMarks } from "@/lib/offline/outbox";
import { CreateEventForm } from "@/components/attendance/CreateEventForm";
import { RosterModeChip } from "@/components/attendance/RosterModeChip";
import { EVENT_STATUS_PILL } from "@/components/attendance/event-status-styles";
import { Segmented } from "@/components/ui/Segmented";

type Scope = "today" | "upcoming" | "past";

type HubEvent = {
  id: string;
  title: string;
  scheduledAt: string;
  orgNodeId: string;
  nodeName: string;
  status: "scheduled" | "completed" | "cancelled";
  rosterMode: "members" | "team";
  rosterCount: number;
  markedCount: number;
};

const SCOPES: Scope[] = ["today", "upcoming", "past"];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Group key + label for a date header, in the org's timezone (PKT).
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Karachi",
  });
}

function EventCard({ e, scope }: { e: HubEvent; scope: Scope }) {
  const { t } = useTranslation("attendance");
  const rate = e.rosterCount > 0 ? Math.round((e.markedCount / e.rosterCount) * 100) : 0;
  const done = e.rosterCount > 0 && e.markedCount >= e.rosterCount;
  const cancelled = e.status === "cancelled";

  // Pill: Today reads as marked-progress; other scopes show the event's status.
  const pill =
    scope === "today"
      ? done
        ? { cls: EVENT_STATUS_PILL.completed, text: t("today.marked") }
        : { cls: EVENT_STATUS_PILL.scheduled, text: t("today.notMarked") }
      : { cls: EVENT_STATUS_PILL[e.status], text: t(`eventStatus.${e.status}`, e.status) };

  return (
    <Link
      href={`/mark/${e.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/30 hover:shadow-[0_2px_10px_rgba(47,85,234,0.08)]"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-num font-semibold ${
          cancelled
            ? "bg-slate-100 text-slate-400"
            : done
              ? "bg-emerald-50 text-emerald-600"
              : "bg-[#2f55ea]/[0.08] text-[#2f55ea]"
        }`}
      >
        {done && scope !== "upcoming" ? "✓" : e.rosterCount}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {e.title}
          </span>
          <RosterModeChip mode={e.rosterMode} />
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${pill.cls}`}>
            {pill.text}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-400">
          <span className="font-num">{fmtTime(e.scheduledAt)}</span> · {e.nodeName} ·{" "}
          {t("today.people", { count: e.rosterCount })}
        </span>
      </span>
      {scope !== "upcoming" && (
        <span className="hidden w-28 shrink-0 sm:block">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-num font-medium text-slate-600">{rate}%</span>
            <span className="font-num">{e.markedCount}/{e.rosterCount}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-[#2f55ea]"}`} style={{ inlineSize: `${rate}%` }} />
          </div>
        </span>
      )}
      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2f55ea]" aria-hidden>→</span>
    </Link>
  );
}

export default function AttendanceHubPage() {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const { online, pending, failed, lastSyncedAt, syncNow, dismissFailed } = useOnline();
  const [scope, setScope] = useState<Scope>("today");
  const [events, setEvents] = useState<HubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // Guards against a stale response clobbering a newer one when tabs are switched
  // quickly (an earlier slow fetch resolving after a later one).
  const reqRef = useRef(0);

  const load = useCallback(async (s: Scope) => {
    const reqId = ++reqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/events?scope=${s}`);
      const json = await res.json().catch(() => ({}));
      const evs: HubEvent[] = res.ok ? json.data.events : [];
      // Overlay locally-queued (unsynced) marks so a card reflects offline work.
      const queued = await pendingMarks();
      if (reqRef.current !== reqId) return; // a newer load superseded this one
      const pendingByEvent = new Map<string, Set<string>>();
      for (const m of queued) {
        const set = pendingByEvent.get(m.eventId) ?? new Set<string>();
        set.add(m.personId);
        pendingByEvent.set(m.eventId, set);
      }
      setEvents(
        evs.map((e) => ({
          ...e,
          markedCount: Math.min(e.rosterCount, e.markedCount + (pendingByEvent.get(e.id)?.size ?? 0)),
        })),
      );
    } catch {
      if (reqRef.current === reqId) setEvents([]);
    } finally {
      if (reqRef.current === reqId) setLoading(false);
    }
  }, []);

  // Reload on scope change and whenever the outbox count changes (marks queued/synced).
  useEffect(() => {
    void load(scope);
  }, [load, scope, pending]);

  const toMark = events.filter((e) => e.markedCount < e.rosterCount || e.rosterCount === 0);
  const done = events.filter((e) => e.rosterCount > 0 && e.markedCount >= e.rosterCount);

  // Upcoming / Past: group under date headers (events already ordered by the API).
  const grouped: { key: string; items: HubEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(e.scheduledAt);
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.items.push(e);
    else grouped.push({ key, items: [e] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
            {t("today.eyebrow", "Operations")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t("hub.title", "Attendance")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("hub.subtitle", "Your sessions to mark")}</p>
        </div>
        <div className="flex items-center gap-3">
          {!online ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {t("offline.banner")}
            </span>
          ) : pending > 0 ? (
            <button onClick={syncNow} className="text-xs font-medium text-[#2f55ea] hover:underline">
              {t("offline.pending", { count: pending })} · {t("offline.syncNow")}
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              {lastSyncedAt == null
                ? t("offline.synced")
                : Date.now() - lastSyncedAt < 60_000
                  ? t("offline.justSynced")
                  : t("offline.lastSynced", { mins: Math.floor((Date.now() - lastSyncedAt) / 60_000) })}
            </span>
          )}
          <button
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2f55ea] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.1),0_4px_12px_rgba(47,85,234,0.25)] transition hover:bg-[#2848c8]"
          >
            {t("today.newEvent")}
          </button>
        </div>
      </div>

      {/* Scope tabs */}
      <Segmented
        value={scope}
        options={SCOPES.map((s) => ({ value: s, label: t(`hub.scope.${s}`, s) }))}
        onChange={setScope}
      />

      {failed > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-[#fdecec] px-4 py-2 text-xs font-semibold text-[#dc2626]">
          <span>{t("offline.failed", { count: failed })}</span>
          <button onClick={dismissFailed} className="ms-3 shrink-0 underline" aria-label={t("offline.dismiss")}>
            {t("offline.dismiss")}
          </button>
        </div>
      )}

      <CreateEventForm
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          toast(t("mark.saved"));
          void load(scope);
        }}
      />

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
            </svg>
          }
          title={t(`hub.empty.${scope}`, t("today.empty"))}
          action={
            scope === "today" ? (
              <button
                onClick={() => setCreating(true)}
                className="rounded-xl bg-[#2f55ea] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2848c8]"
              >
                {t("today.newEvent")}
              </button>
            ) : undefined
          }
        />
      ) : scope === "today" ? (
        <div className="space-y-6">
          {toMark.length > 0 && (
            <section>
              <Eyebrow>{t("today.toMark")}</Eyebrow>
              <ul className="space-y-2">
                {toMark.map((e) => (
                  <li key={e.id}><EventCard e={e} scope="today" /></li>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <Eyebrow>{t("today.done")}</Eyebrow>
              <ul className="space-y-2">
                {done.map((e) => (
                  <li key={e.id}><EventCard e={e} scope="today" /></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.key}>
              <Eyebrow>{g.key}</Eyebrow>
              <ul className="space-y-2">
                {g.items.map((e) => (
                  <li key={e.id}><EventCard e={e} scope={scope} /></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
