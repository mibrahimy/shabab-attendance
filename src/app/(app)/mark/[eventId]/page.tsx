"use client";

// Mark screen — to the mockup. Loads the marker's slice (overlaid with any queued
// offline marks), defaults everyone absent, P/L/A/E per row, live summary, magenta
// save. Local-first: taps queue to the outbox; Save flushes and goes to the Report.
// A non-scheduled (cancelled/completed) event renders read-only.

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance-status";
import { initials } from "@/lib/initials";
import { queueMark, pending } from "@/lib/offline/outbox";
import { flush } from "@/lib/offline/sync-engine";
import { overlayPending, tally } from "@/lib/offline/overlay";
import { useOnline } from "@/lib/offline/use-online";
import { STATUS_LETTER, STATUS_SOLID, STATUS_GLOW } from "@/components/attendance/status-styles";

type Entry = { personId: string; name: string; segment: string | null; status: AttendanceStatus };

export default function MarkPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const { online } = useOnline();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [roster, setRoster] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const rosterRef = useRef<Entry[]>([]);

  function applyRoster(next: Entry[]) {
    rosterRef.current = next;
    setRoster(next);
  }

  const load = useCallback(async () => {
    try {
      const [res, queued] = await Promise.all([
        fetch(`/api/events/${eventId}/roster`),
        pending(eventId),
      ]);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTitle(json.data.event.title);
        setScheduledAt(json.data.event.scheduledAt);
        setReadOnly(json.data.event.status !== "scheduled");
        // Overlay queued (unsynced) marks so the screen shows what was marked.
        applyRoster(overlayPending(json.data.roster as Entry[], queued));
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(personId: string, status: AttendanceStatus) {
    if (readOnly) return;
    applyRoster(rosterRef.current.map((e) => (e.personId === personId ? { ...e, status } : e)));
    await queueMark({ eventId, personId, status });
  }

  async function markAllPresent() {
    if (readOnly) return;
    const next = rosterRef.current.map((e) => ({ ...e, status: "present" as AttendanceStatus }));
    applyRoster(next);
    await Promise.all(next.map((e) => queueMark({ eventId, personId: e.personId, status: "present" })));
  }

  async function save() {
    setSaving(true);
    try {
      const drained = await flush();
      if (drained || !online) {
        router.push(`/mark/${eventId}/report`);
      } else {
        toast(t("mark.saveError"), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  const counts = tally(roster);
  const time = scheduledAt
    ? new Date(scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (loading) return <p className="text-sm text-gray-400">…</p>;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-3">
        <button onClick={() => router.push("/mark")} className="text-sm text-gray-400 hover:text-gray-600">
          ‹ {t("today.title")}
        </button>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
          {title || t("mark.title")}
        </h1>
        <p className="text-sm text-gray-500">
          {time && <span className="font-num">{time}</span>}
          {time && " · "}
          {t("today.people", { count: roster.length })}
        </p>
      </div>

      {readOnly && (
        <div className="mb-3 rounded-xl bg-[#eef1f6] px-4 py-2 text-xs font-semibold text-[#5b6b8c]">
          {t("report.closed")}
        </div>
      )}
      {!online && !readOnly && (
        <div className="mb-3 rounded-xl bg-[#fbf1e3] px-4 py-2 text-xs font-semibold text-[#9a5a17]">
          {t("offline.banner")}
        </div>
      )}

      {/* Toolbar */}
      {!readOnly && roster.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">{t("mark.everyoneAbsent")}</span>
          <button
            onClick={markAllPresent}
            className="rounded-full border border-[#b9e6c7] bg-[#e7f6ed] px-3 py-1 text-xs font-semibold text-[#15a34a]"
          >
            {t("mark.allPresent")}
          </button>
        </div>
      )}

      {/* Roster */}
      {roster.length === 0 ? (
        <p className="text-sm text-gray-400">{t("mark.empty")}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {roster.map((e) => (
            <li key={e.personId} className="flex items-center gap-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-[#f5f6fd] font-num text-xs text-gray-600">
                {initials(e.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{e.name}</span>
              <span className="flex shrink-0 gap-0.5">
                {ATTENDANCE_STATUSES.map((s) => {
                  const on = e.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(e.personId, s)}
                      disabled={readOnly}
                      aria-pressed={on}
                      className={`min-w-[33px] rounded-lg px-2 py-1.5 font-num text-xs font-semibold transition ${
                        on
                          ? `${STATUS_SOLID[s]} ${STATUS_GLOW[s]}`
                          : "bg-[#edeff5] text-gray-500 hover:bg-gray-200"
                      } ${readOnly ? "opacity-60" : ""}`}
                    >
                      {STATUS_LETTER[s]}
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Sticky save bar */}
      {!readOnly && roster.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:bottom-0">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="font-num text-xs text-gray-500">
              {t("mark.summary", counts)}
            </span>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-2xl bg-[#c41f6a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_#c41f6a] transition hover:bg-[#a51a5a] disabled:opacity-60"
            >
              {online ? t("mark.save") : t("mark.saveOffline")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
