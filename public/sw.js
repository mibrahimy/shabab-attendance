// Attendance service worker.
// - Navigations: network-first, fall back to the cached app shell (offline open).
// - Attendance reads (GET /api/events, /api/events/*/roster): stale-while-revalidate
//   so a murabbi can open today's event + roster without signal. Writes (POST) are
//   never cached — they go through the app's IndexedDB outbox + sync engine.

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
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.origin === self.location.origin && isCacheableRead(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
