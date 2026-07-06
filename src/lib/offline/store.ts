"use client";

// Tiny external store for offline UI state (pending outbox count + last sync time),
// read via useSyncExternalStore. The outbox and sync engine push updates here; the
// snapshot reference only changes when a value changes (stable for React).

export type OfflineSnapshot = { pending: number; lastSyncedAt: number | null; failed: number };

export const SERVER_SNAPSHOT: OfflineSnapshot = { pending: 0, lastSyncedAt: null, failed: 0 };

let snapshot: OfflineSnapshot = { pending: 0, lastSyncedAt: null, failed: 0 };
const subscribers = new Set<() => void>();

export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getSnapshot(): OfflineSnapshot {
  return snapshot;
}

function set(next: Partial<OfflineSnapshot>): void {
  const merged = { ...snapshot, ...next };
  if (
    merged.pending === snapshot.pending &&
    merged.lastSyncedAt === snapshot.lastSyncedAt &&
    merged.failed === snapshot.failed
  ) {
    return;
  }
  snapshot = merged;
  for (const cb of subscribers) cb();
}

export function setPending(pending: number): void {
  set({ pending });
}

export function setLastSyncedAt(lastSyncedAt: number): void {
  set({ lastSyncedAt });
}

// Count of marks the server terminally rejected (dropped from the outbox so they
// don't retry forever). Surfaced in the UI; reset when acknowledged.
export function addFailed(n: number): void {
  if (n > 0) set({ failed: snapshot.failed + n });
}

// Dismiss the failed indicator (terminally-dropped marks aren't recoverable).
export function clearFailed(): void {
  if (snapshot.failed !== 0) set({ failed: 0 });
}
