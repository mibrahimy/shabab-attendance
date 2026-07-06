"use client";

// Today's events (minimal — Chunk 2 rebuilds this to the mockup). Lists events the
// caller can mark, links into the Mark screen, and offers a lean create form for
// create_event holders. Shows an offline/pending badge from the sync engine.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
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

export default function AttendanceTodayPage() {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const { online, pending } = useOnline();
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">{t("today.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {!online
              ? t("offline.banner")
              : pending > 0
                ? t("offline.pending", { count: pending })
                : t("offline.synced")}
          </span>
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            {t("today.newEvent")}
          </Button>
        </div>
      </div>

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
        <p className="text-sm text-gray-400">…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-400">{t("today.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/mark/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <span>
                  <span className="block font-medium text-gray-900">{e.title}</span>
                  <span className="block text-xs text-gray-400">
                    {new Date(e.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {t("today.roster", { marked: e.markedCount, total: e.rosterCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
