"use client";

// Connectivity + outbox state for the offline affordances (offline band, pending
// badge, "last synced"). Both read through useSyncExternalStore — no setState in an
// effect — so online status and outbox counters come from their sources directly.
// A React hook, so it lives in src/hooks (not src/lib, which stays a pure leaf).

import { useEffect, useSyncExternalStore } from "react";
import { startSyncEngine, flush } from "@/lib/offline/sync-engine";
import { subscribe as subscribeStore, getSnapshot, SERVER_SNAPSHOT, clearFailed } from "@/lib/offline/store";
import { clearFailedMarks } from "@/lib/offline/outbox";

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): {
  online: boolean;
  pending: number;
  lastSyncedAt: number | null;
  failed: number;
  syncNow: () => void;
  dismissFailed: () => void;
} {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const snap = useSyncExternalStore(subscribeStore, getSnapshot, () => SERVER_SNAPSHOT);

  // Side effect only (no setState): ensure the engine's listeners + initial flush run.
  useEffect(() => {
    startSyncEngine();
  }, []);

  return {
    online,
    pending: snap.pending,
    lastSyncedAt: snap.lastSyncedAt,
    failed: snap.failed,
    syncNow: () => void flush(),
    dismissFailed: () => void clearFailedMarks().then(clearFailed),
  };
}
