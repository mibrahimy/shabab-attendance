// Attendance service worker.
// - Navigations: network-first, fall back to the cached app shell (offline open).
// - Attendance reads (GET /api/events, /api/events/*/roster): NETWORK-FIRST, falling
//   back to cache only when offline, so an online user always gets their OWN fresh
//   data and a stale cache is a last resort. Writes (POST) are never cached — they go
//   through the app's IndexedDB outbox + sync engine.
// The cache is not user-partitioned, so the app clears it on sign-out (see
// SignOutButton) to avoid serving a previous user's roster on a shared device.

const CACHE_NAME = "attendance-v2";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isCacheableRead(url) {
  if (url.pathname === "/api/events") return true; // today's list
  return /^\/api\/events\/[^/]+\/roster$/.test(url.pathname); // a marker's roster
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    // Offline: serve the requested route from cache if present (so a refresh or
    // deep-link to /mark/<id> doesn't bounce to the home shell), else the shell.
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.origin === self.location.origin && isCacheableRead(url)) {
    // Network-first: fetch fresh (and refresh the cache); only fall back to the
    // cached copy when the network is unavailable.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error("offline and not cached");
        }
      }),
    );
  }
});
