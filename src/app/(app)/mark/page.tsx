"use client";

// Today — the marker's events for today, as cards grouped To mark / Done. Tap a
// card to open the Mark screen. Keeps the lean create-event affordance and an
// offline/pending chip.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Eyebrow from "@/components/ui/Eyebrow";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/lib/offline/use-online";
import { pending as pendingMarks } from "@/lib/offline/outbox";
import { CreateEventForm } from "@/components/attendance/CreateEventForm";

type TodayEvent = {
  id: string;
  title: string;
  scheduledAt: string;
  rosterCount: number;
  markedCount: number;
};

function EventCard({ e, done }: { e: TodayEvent; done: boolean }) {
  const { t } = useTranslation("attendance");
  const time = new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const rate = e.rosterCount > 0 ? Math.round((e.markedCount / e.rosterCount) * 100) : 0;
  return (
    <Link
      href={`/mark/${e.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/30 hover:shadow-[0_2px_10px_rgba(47,85,234,0.08)]"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-num font-semibold ${
          done ? "bg-emerald-50 text-emerald-600" : "bg-[#2f55ea]/[0.08] text-[#2f55ea]"
        }`}
      >
        {done ? "✓" : e.rosterCount}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-900">{e.title}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
              done ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-[#2f55ea]/[0.07] text-[#2f55ea] ring-[#2f55ea]/20"
            }`}
          >
            {done ? t("today.marked") : t("today.notMarked")}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">
          {time} · {t("today.people", { count: e.rosterCount })}
        </span>
      </span>
      <span className="hidden w-28 shrink-0 sm:block">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-num font-medium text-slate-600">{rate}%</span>
          <span className="font-num">{e.markedCount}/{e.rosterCount}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-[#2f55ea]"}`} style={{ inlineSize: `${rate}%` }} />
        </div>
      </span>
      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2f55ea]" aria-hidden>→</span>
    </Link>
  );
}

export default function AttendanceTodayPage() {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const { online, pending, failed, lastSyncedAt, syncNow, dismissFailed } = useOnline();
  const [events, setEvents] = useState<TodayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const json = await res.json().catch(() => ({}));
      const evs: TodayEvent[] = res.ok ? json.data.events : [];
      // Overlay locally-queued (unsynced) marks so a card reflects offline work —
      // otherwise a session you just marked offline stays in "To mark".
      const queued = await pendingMarks();
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
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on mount and whenever the outbox count changes (marks queued or synced).
  useEffect(() => {
    void load();
  }, [load, pending]);

  const toMark = events.filter((e) => e.markedCount < e.rosterCount || e.rosterCount === 0);
  const done = events.filter((e) => e.rosterCount > 0 && e.markedCount >= e.rosterCount);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
            {t("today.eyebrow", "Operations")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t("today.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("today.subtitle", "Today’s sessions")}</p>
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

      {failed > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#fdecec] px-4 py-2 text-xs font-semibold text-[#dc2626]">
          <span>{t("offline.failed", { count: failed })}</span>
          <button onClick={dismissFailed} className="ms-3 shrink-0 underline" aria-label={t("offline.dismiss")}>
            {t("offline.dismiss")}
          </button>
        </div>
      )}

      {creating && (
        <div className="mb-4">
          <CreateEventForm
            onCreated={() => {
              setCreating(false);
              toast(t("mark.saved"));
              void load();
            }}
          />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
            </svg>
          }
          title={t("today.empty")}
        />
      ) : (
        <div className="space-y-6">
          {toMark.length > 0 && (
            <section>
              <Eyebrow>{t("today.toMark")}</Eyebrow>
              <ul className="space-y-2">
                {toMark.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} done={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <Eyebrow>{t("today.done")}</Eyebrow>
              <ul className="space-y-2">
                {done.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} done />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
