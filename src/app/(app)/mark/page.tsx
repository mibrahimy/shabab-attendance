"use client";

// Today — the marker's events for today, as cards grouped To mark / Done. Tap a
// card to open the Mark screen. Keeps the lean create-event affordance and an
// offline/pending chip.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Eyebrow from "@/components/ui/Eyebrow";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/lib/offline/use-online";
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
  return (
    <Link
      href={`/mark/${e.id}`}
      className="flex items-stretch gap-3 overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:bg-gray-50"
    >
      <span className={`w-1.5 shrink-0 ${done ? "bg-[#15a34a]" : "bg-[#2f55ea]"}`} aria-hidden />
      <span className="flex flex-1 items-center justify-between gap-3 py-3 pe-4">
        <span className="min-w-0">
          <span className="block font-num text-xs text-gray-400">{time}</span>
          <span className="block truncate font-medium text-gray-900">{e.title}</span>
          <span className="block text-xs text-gray-400">
            {t("today.people", { count: e.rosterCount })}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            done ? "bg-[#e7f6ed] text-[#15a34a]" : "bg-[#eef1fe] text-[#2f55ea]"
          }`}
        >
          {done ? t("today.marked") : t("today.notMarked")}
        </span>
      </span>
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
      setEvents(res.ok ? json.data.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toMark = events.filter((e) => e.markedCount < e.rosterCount || e.rosterCount === 0);
  const done = events.filter((e) => e.rosterCount > 0 && e.markedCount >= e.rosterCount);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">{t("today.title")}</h1>
        <div className="flex items-center gap-3">
          {!online ? (
            <span className="text-xs font-semibold text-[#9a5a17]">{t("offline.banner")}</span>
          ) : pending > 0 ? (
            <button onClick={syncNow} className="text-xs font-medium text-[#2f55ea] hover:underline">
              {t("offline.pending", { count: pending })} · {t("offline.syncNow")}
            </button>
          ) : (
            <span className="text-xs text-gray-400">
              {lastSyncedAt == null
                ? t("offline.synced")
                : Date.now() - lastSyncedAt < 60_000
                  ? t("offline.justSynced")
                  : t("offline.lastSynced", { mins: Math.floor((Date.now() - lastSyncedAt) / 60_000) })}
            </span>
          )}
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            {t("today.newEvent")}
          </Button>
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
