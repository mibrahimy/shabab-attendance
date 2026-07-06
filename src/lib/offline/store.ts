"use client";

// Tiny external store for offline UI state (pending outbox count + last sync time),
// read via useSyncExternalStore. The outbox and sync engine push updates here; the
// snapshot reference only changes when a value changes (stable for React).

export type OfflineSnapshot = { pending: number; lastSyncedAt: number | null };

export const SERVER_SNAPSHOT: OfflineSnapshot = { pending: 0, lastSyncedAt: null };

let snapshot: OfflineSnapshot = { pending: 0, lastSyncedAt: null };
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
  if (merged.pending === snapshot.pending && merged.lastSyncedAt === snapshot.lastSyncedAt) return;
  snapshot = merged;
  for (const cb of subscribers) cb();
}

export function setPending(pending: number): void {
  set({ pending });
}

export function setLastSyncedAt(lastSyncedAt: number): void {
  set({ lastSyncedAt });
}
