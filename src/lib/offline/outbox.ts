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
  // Marks the server terminally rejected (4xx that isn't re-auth/rate-limit). Kept
  // here — not deleted — so nothing silently vanishes; recoverable/inspectable.
  failed: {
    key: string;
    value: PendingMark;
  };
}

const DB_NAME = "shabab-attendance";
const STORE = "marks";
const FAILED = "failed";

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  dbPromise ??= openDB<OutboxDB>(DB_NAME, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("by-event", "eventId");
      }
      if (oldVersion < 2) {
        database.createObjectStore(FAILED, { keyPath: "key" });
      }
    },
  });
  return dbPromise;
}

// Close the DB connection (and reset the cached promise) so a subsequent
// deleteDatabase on sign-out isn't blocked by an open connection from this page.
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    (await dbPromise).close();
  } catch {
    // already closing/closed — fine
  }
  dbPromise = null;
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

// Queue many marks in ONE transaction + ONE refreshPending (mark-all-present on a
// large roster shouldn't fire N writes + N store notifications).
export async function queueMany(
  marks: (Omit<PendingMark, "key" | "clientUpdatedAt"> & { clientUpdatedAt?: string })[],
): Promise<void> {
  if (marks.length === 0) return;
  const database = await db();
  const now = new Date().toISOString();
  const tx = database.transaction(STORE, "readwrite");
  await Promise.all(
    marks.map((m) =>
      tx.store.put({
        key: `${m.eventId}:${m.personId}`,
        eventId: m.eventId,
        personId: m.personId,
        status: m.status,
        clientUpdatedAt: m.clientUpdatedAt ?? now,
        overrideReason: m.overrideReason,
      }),
    ),
  );
  await tx.done;
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

// Move terminally-rejected marks OUT of the retry path into the durable `failed`
// store (preserve the data — never silently delete) so they can't loop forever
// and can be surfaced/recovered. One transaction across both stores.
export async function moveToFailed(marks: PendingMark[]): Promise<void> {
  if (marks.length === 0) return;
  const database = await db();
  const tx = database.transaction([STORE, FAILED], "readwrite");
  await Promise.all(
    marks.flatMap((m) => [tx.objectStore(FAILED).put(m), tx.objectStore(STORE).delete(m.key)]),
  );
  await tx.done;
  await refreshPending();
}

export async function failedCount(): Promise<number> {
  return (await db()).count(FAILED);
}

export async function clearFailedMarks(): Promise<void> {
  await (await db()).clear(FAILED);
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
