"use client";

// Barebones Mark screen (Chunk 1 proof — Chunk 2 rebuilds to the mockup). Loads the
// marker's slice, defaults everyone absent, writes each tap to the IndexedDB outbox
// (local-first), and flushes on Save. Works offline: the roster GET is SW-cached and
// marks queue locally until sync.

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance-status";
import { queueMark } from "@/lib/offline/outbox";
import { flush } from "@/lib/offline/sync-engine";
import { useOnline } from "@/lib/offline/use-online";

type Entry = { personId: string; name: string; segment: string | null; status: AttendanceStatus };

const LETTER: Record<AttendanceStatus, string> = { present: "P", late: "L", absent: "A", excused: "E" };
const COLOR: Record<AttendanceStatus, string> = {
  present: "bg-[#15a34a] text-white",
  late: "bg-[#ef8a23] text-white",
  absent: "bg-[#dc2626] text-white",
  excused: "bg-[#5b6b8c] text-white",
};

export default function MarkPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const { online, pending } = useOnline();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [roster, setRoster] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Mirror of `roster` for the queue side-effects, so bulk/queue actions never read
  // a stale render closure (e.g. a click racing a re-load).
  const rosterRef = useRef<Entry[]>([]);

  function applyRoster(next: Entry[]) {
    rosterRef.current = next;
    setRoster(next);
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/roster`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTitle(json.data.event.title);
        rosterRef.current = json.data.roster;
        setRoster(json.data.roster);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(personId: string, status: AttendanceStatus) {
    applyRoster(rosterRef.current.map((e) => (e.personId === personId ? { ...e, status } : e)));
    await queueMark({ eventId, personId, status });
  }

  async function markAllPresent() {
    const next = rosterRef.current.map((e) => ({ ...e, status: "present" as AttendanceStatus }));
    applyRoster(next);
    await Promise.all(
      next.map((e) => queueMark({ eventId, personId: e.personId, status: "present" })),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const drained = await flush();
      if (drained) {
        toast(t("mark.saved"));
        router.push("/mark");
      } else if (!online) {
        toast(t("offline.banner")); // safely queued on this device
        router.push("/mark");
      } else {
        // online but the outbox didn't drain — a submit failed; stay so they can retry.
        toast(t("mark.saveError"), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  const counts = roster.reduce(
    (a, e) => ({ ...a, [e.status]: a[e.status] + 1 }),
    { present: 0, late: 0, absent: 0, excused: 0 } as Record<AttendanceStatus, number>,
  );

  if (loading) return <p className="text-sm text-gray-400">…</p>;

  return (
    <div className="pb-24">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{title || t("mark.title")}</h1>
        <Button size="sm" variant="secondary" onClick={markAllPresent}>
          {t("mark.allPresent")}
        </Button>
      </div>
      {!online && (
        <div className="mb-3 rounded-xl bg-[#fbf1e3] px-4 py-2 text-xs font-semibold text-[#9a5a17]">
          {t("offline.banner")}
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-sm text-gray-400">{t("mark.empty")}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {roster.map((e) => (
            <li key={e.personId} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate text-sm font-medium text-gray-900">{e.name}</span>
              <span className="flex gap-1">
                {ATTENDANCE_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(e.personId, s)}
                    aria-pressed={e.status === s}
                    className={`min-w-[34px] rounded-lg px-2 py-1 font-mono text-xs font-semibold transition ${
                      e.status === s ? COLOR[s] : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {LETTER[s]}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="font-mono text-xs text-gray-500">
            {t("mark.summary", counts)}
            {pending > 0 ? ` · ${t("offline.pending", { count: pending })}` : ""}
          </span>
          <Button onClick={save} loading={saving}>
            {online ? t("mark.save") : t("mark.saveOffline")}
          </Button>
        </div>
      </div>
    </div>
  );
}
