"use client";

// Connectivity + outbox state for the offline affordances (offline band, pending
// badge, "last synced"). Both read through useSyncExternalStore — no setState in an
// effect — so online status and outbox counters come from their sources directly.

import { useEffect, useSyncExternalStore } from "react";
import { startSyncEngine } from "./sync-engine";
import { subscribe as subscribeStore, getSnapshot, SERVER_SNAPSHOT } from "./store";

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): { online: boolean; pending: number; lastSyncedAt: number | null } {
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

  return { online, pending: snap.pending, lastSyncedAt: snap.lastSyncedAt };
}
