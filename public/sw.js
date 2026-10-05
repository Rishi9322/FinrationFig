// FinRatio service worker - deliberately small.
//
// - Pages: network-first, so users always get the latest deploy; if the
//   network is down, show /offline.html instead of the browser's dino page.
// - /assets/*: cache-first. Build output is content-hashed, so a cached file is
//   never stale, and the app (incl. the 1.4 MB pdf.js worker) loads instantly
//   on repeat visits.
// - Everything else is left alone: API calls (Supabase, Firebase, AI),
//   analytics and any other-origin request never go through the cache, so
//   financial data and auth are never served stale.
const VERSION = "v1";
const SHELL = `finratio-shell-${VERSION}`;
const ASSETS = `finratio-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_ASSET_ENTRIES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, "/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  // Oldest first (insertion order); old deploys' hashed files age out.
  for (let i = 0; i < keys.length - MAX_ASSET_ENTRIES; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // The offline page's logo: precached at install, so it still shows offline.
  if (url.pathname === "/icon-192.png") {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
