"use client";

// Report — the marker's slice summary for an event: rate + per-status breakdown.
// Reached after Save, and re-openable later. Computed from the server roster
// overlaid with any still-queued outbox marks, so it's correct offline/pre-sync.

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/attendance-status";
import Spinner from "@/components/ui/Spinner";
import { pending } from "@/lib/offline/outbox";
import { overlayPending, tally, attendanceRate } from "@/lib/offline/overlay";
import { STATUS_SOFT } from "@/components/attendance/status-styles";

type Entry = { personId: string; status: AttendanceStatus };

export default function ReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const { t } = useTranslation("attendance");
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [roster, setRoster] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [res, queued] = await Promise.all([
        fetch(`/api/events/${eventId}/roster`),
        pending(eventId),
      ]);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTitle(json.data.event.title);
        setRoster(overlayPending(json.data.roster as Entry[], queued));
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;

  const counts = tally(roster);
  const rate = attendanceRate(counts);

  return (
    <div className="mx-auto max-w-md">
      {/* Gradient hero */}
      <div className="rounded-3xl bg-[linear-gradient(135deg,#2b27c2_0%,#6f1f9e_50%,#c41f6a_100%)] p-6 text-center text-white shadow-[0_22px_44px_-20px_rgba(27,36,64,0.4)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-sm text-white/80">{title}</p>
        <p className="mt-1 font-num text-3xl font-semibold">{rate.percent}%</p>
        <p className="mt-1 text-sm text-white/80">
          {t("report.rate", { attended: rate.attended, total: rate.total, percent: rate.percent })}
        </p>
      </div>

      {/* Per-status breakdown — zero-count statuses are muted so the ones that
          matter stand out. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ATTENDANCE_STATUSES.map((s) => (
          <div
            key={s}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              counts[s] === 0 ? "bg-gray-50 text-gray-300" : STATUS_SOFT[s]
            }`}
          >
            <span className="text-sm font-medium">{t(`status.${s}`)}</span>
            <span className="font-num text-lg font-semibold">{counts[s]}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push("/mark")}
        className="mt-5 w-full rounded-2xl bg-[#2f55ea] py-3 text-sm font-semibold text-white transition hover:bg-[#2546c9]"
      >
        {t("report.done")}
      </button>
    </div>
  );
}
