"use client";

// Foreground sync engine: flush the outbox to the server. Groups pending marks by
// event and POSTs each batch to the idempotent attendance endpoint. Runs on load
// and on `online`. No PWA Background Sync — that's a native-app concern (Phase 8).
//
// Response handling per event batch:
//   ok (2xx)       → drop the acked keys (synced + skipped + rejected), but only if
//                    unchanged since we sent them (a re-mark mid-flight must survive).
//   network / 5xx  → transient; leave queued and retry on the next tick.
//   401 (no auth)  → transient (retry after re-login); leave queued.
//   other 4xx      → terminal (event closed/deleted, malformed); drop so it can't
//                    retry forever, and flag it as failed for the UI to surface.

import { pending, remove, removeIfUnchanged, refreshPending, type PendingMark } from "./outbox";
import { setLastSyncedAt, addFailed } from "./store";

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

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

// How to treat an attendance POST response:
//   "ack"   → server durably decided; drop the acked keys.
//   "retry" → transient (5xx / 401 re-auth); leave queued for the next tick.
//   "drop"  → terminal 4xx (event closed/deleted, malformed); drop so it can't
//             loop forever, and surface as failed.
export function classifyResponse(status: number): "ack" | "retry" | "drop" {
  if (status >= 200 && status < 300) return "ack";
  if (status >= 500 || status === 401) return "retry";
  return "drop";
}

// Returns true if the outbox is now empty (nothing left pending).
export async function flush(): Promise<boolean> {
  if (flushing || isOffline()) return (await pending()).length === 0;
  flushing = true;
  try {
    const all = await pending();
    if (all.length === 0) return true;

    for (const [eventId, marks] of groupByEvent(all)) {
      let res: Response;
      try {
        res = await fetch(`/api/events/${eventId}/attendance`, {
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
      } catch {
        break; // network dropped mid-flush — stop; retry when back online
      }

      const decision = classifyResponse(res.status);
      if (decision === "ack") {
        const json = await res.json().catch(() => null);
        const acked = new Set<string>([
          ...(json?.data?.syncedPersonIds ?? []),
          ...(json?.data?.skippedPersonIds ?? []),
          ...(json?.data?.rejectedPersonIds ?? []),
        ]);
        // Compare-and-delete: only drop keys unchanged since we sent them, so a
        // re-mark that landed mid-flush survives to sync next tick.
        await removeIfUnchanged(
          marks
            .filter((m) => acked.has(m.personId))
            .map((m) => ({ key: `${eventId}:${m.personId}`, clientUpdatedAt: m.clientUpdatedAt })),
        );
      } else if (decision === "retry") {
        continue; // transient — leave queued, retry next tick
      } else {
        // Terminal 4xx: the server will never accept these. Drop so they don't
        // retry forever; surface a failed count.
        await remove(marks.map((m) => `${eventId}:${m.personId}`));
        addFailed(marks.length);
      }
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
