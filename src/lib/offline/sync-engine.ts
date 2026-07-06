"use client";

// Foreground sync engine: flush the outbox to the server. Groups pending marks by
// event, POSTs each batch to the idempotent attendance endpoint, and removes the
// acked (synced + skipped) keys from the outbox. Runs on load and on `online`.
// No PWA Background Sync — that's a native-app concern (Phase 8).

import { pending, remove, refreshPending, type PendingMark } from "./outbox";
import { setLastSyncedAt } from "./store";

let flushing = false;

function groupByEvent(marks: PendingMark[]): Map<string, PendingMark[]> {
  const m = new Map<string, PendingMark[]>();
  for (const mk of marks) {
    const arr = m.get(mk.eventId) ?? [];
    arr.push(mk);
    m.set(mk.eventId, arr);
  }
  return m;
}

// Returns true if the outbox is now empty (nothing left pending).
export async function flush(): Promise<boolean> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) {
    return (await pending()).length === 0;
  }
  flushing = true;
  try {
    const all = await pending();
    if (all.length === 0) return true;

    for (const [eventId, marks] of groupByEvent(all)) {
      const res = await fetch(`/api/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks: marks.map((m) => ({
            personId: m.personId,
            status: m.status,
            clientUpdatedAt: m.clientUpdatedAt,
            overrideReason: m.overrideReason,
          })),
        }),
      });
      if (!res.ok) continue; // leave this event's marks queued; retry next tick
      const json = await res.json().catch(() => null);
      const acked: string[] = [
        ...(json?.data?.syncedPersonIds ?? []),
        ...(json?.data?.skippedPersonIds ?? []),
      ];
      await remove(acked.map((personId) => `${eventId}:${personId}`));
    }

    setLastSyncedAt(Date.now());
    return (await pending()).length === 0;
  } finally {
    flushing = false;
  }
}

let started = false;
export function startSyncEngine(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void flush());
  void refreshPending(); // seed the pending badge
  void flush();
}
