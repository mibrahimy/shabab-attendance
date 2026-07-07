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

import { pending, moveToFailed, removeIfUnchanged, failedCount, refreshPending, type PendingMark } from "./outbox";
import { setLastSyncedAt, setFailed } from "./store";

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
//   "retry" → transient (5xx / 401 re-auth / 429 rate-limit); leave queued.
//   "drop"  → terminal 4xx (event deleted, malformed, no permission); move to the
//             durable failed store so it can't loop forever AND isn't lost.
// 429 is explicitly transient — rate-limited marks are valid and must not be lost.
export function classifyResponse(status: number): "ack" | "retry" | "drop" {
  if (status >= 200 && status < 300) return "ack";
  if (status >= 500 || status === 401 || status === 429) return "retry";
  return "drop";
}

// Exponential backoff for transient-failure retries: 2s, 4s, 8s, 16s, capped ~30s.
export function backoffDelay(attempt: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt));
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

// Schedule a self-healing retry when marks are still queued while online (a
// transient failure). One timer at a time; backs off; resets on drain/online.
function scheduleRetry(): void {
  clearRetry();
  const delay = backoffDelay(retryAttempt);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

// Outcome of a flush. `drained` = outbox empty. `ackedAny` = the server durably
// accepted at least one batch. `failedCount` = marks terminally rejected THIS
// flush (moved to the durable failed store). Note: drained can be true while
// failedCount > 0 (all remaining marks were rejected) — callers must NOT treat an
// empty outbox as success.
export type FlushResult = { drained: boolean; ackedAny: boolean; failedCount: number };

export async function flush(): Promise<FlushResult> {
  if (flushing || isOffline()) {
    return { drained: (await pending()).length === 0, ackedAny: false, failedCount: 0 };
  }
  flushing = true;
  try {
    const all = await pending();
    if (all.length === 0) return { drained: true, ackedAny: false, failedCount: 0 };

    let ackedAny = false;
    let failedThisFlush = 0;

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
        ackedAny = true;
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
        // Terminal 4xx: the server will never accept these. Preserve them in the
        // failed store (never silently deleted) so they can't loop forever and
        // stay recoverable/inspectable.
        await moveToFailed(marks);
        failedThisFlush += marks.length;
      }
    }

    if (failedThisFlush > 0) setFailed(await failedCount());
    // Only claim "synced" when the server actually acked something — never on a
    // no-op / all-failed flush (that would falsely tell the marker their data is safe).
    if (ackedAny) setLastSyncedAt(Date.now());
    const drained = (await pending()).length === 0;
    // Self-heal transient failures: if anything is still queued while online, it's
    // a transient error — retry with backoff (no reload/online event needed).
    if (drained) {
      retryAttempt = 0;
      clearRetry();
    } else if (!isOffline()) {
      scheduleRetry();
    }
    return { drained, ackedAny, failedCount: failedThisFlush };
  } finally {
    flushing = false;
  }
}

let started = false;
export function startSyncEngine(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    retryAttempt = 0; // fresh connectivity — retry immediately, reset backoff
    clearRetry();
    void flush();
  });
  void refreshPending(); // seed the pending badge
  void failedCount().then(setFailed); // seed the failed badge from the durable store
  void flush();
}
