"use client";

// IndexedDB-backed outbox of pending attendance marks. Marks are written here
// FIRST (local-first), then the sync engine flushes them to the server. Keyed by
// `${eventId}:${personId}` so re-marking the same person before a sync just
// overwrites the pending entry (no duplicates).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AttendanceStatus } from "@/lib/attendance-status";
import { setPending } from "./store";

export type PendingMark = {
  key: string; // `${eventId}:${personId}`
  eventId: string;
  personId: string;
  status: AttendanceStatus;
  clientUpdatedAt: string; // ISO — the local moment the mark was made
  overrideReason?: string;
};

interface OutboxDB extends DBSchema {
  marks: {
    key: string;
    value: PendingMark;
    indexes: { "by-event": string };
  };
}

const DB_NAME = "shabab-attendance";
const STORE = "marks";

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  dbPromise ??= openDB<OutboxDB>(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: "key" });
      store.createIndex("by-event", "eventId");
    },
  });
  return dbPromise;
}

export async function queueMark(
  m: Omit<PendingMark, "key" | "clientUpdatedAt"> & { clientUpdatedAt?: string },
): Promise<void> {
  const database = await db();
  const key = `${m.eventId}:${m.personId}`;
  await database.put(STORE, {
    key,
    eventId: m.eventId,
    personId: m.personId,
    status: m.status,
    clientUpdatedAt: m.clientUpdatedAt ?? new Date().toISOString(),
    overrideReason: m.overrideReason,
  });
  await refreshPending();
}

export async function pending(eventId?: string): Promise<PendingMark[]> {
  const database = await db();
  return eventId
    ? database.getAllFromIndex(STORE, "by-event", eventId)
    : database.getAll(STORE);
}

export async function pendingCount(): Promise<number> {
  return (await db()).count(STORE);
}

// Recompute the pending count into the external store (drives the UI badge).
export async function refreshPending(): Promise<number> {
  const n = await pendingCount();
  setPending(n);
  return n;
}

export async function remove(keys: string[]): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, "readwrite");
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
  await refreshPending();
}

// Delete each key ONLY if its stored clientUpdatedAt still matches what was synced.
// Guards the lost-update race: if the user re-marked the same person while a flush
// was in flight, the outbox now holds a newer entry that must survive to sync next.
export async function removeIfUnchanged(
  entries: { key: string; clientUpdatedAt: string }[],
): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, "readwrite");
  await Promise.all(
    entries.map(async ({ key, clientUpdatedAt }) => {
      const cur = await tx.store.get(key);
      if (cur && cur.clientUpdatedAt === clientUpdatedAt) await tx.store.delete(key);
    }),
  );
  await tx.done;
  await refreshPending();
}
