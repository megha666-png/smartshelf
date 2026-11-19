// SmartShelf Service Worker for Offline Caching and Android Installation
const CACHE_NAME = "smartshelf-v4-periwinkle";
const STATIC_ASSETS = [
  "/",
  "/static/css/variables.css",
  "/static/css/layout.css",
  "/static/css/components.css",
  "/static/js/api.js",
  "/static/js/app.js",
  "/static/manifest.json",
  "/static/assets/logo.jpg",
  "/static/assets/icon-192.svg",
  "/static/assets/icon-512.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SmartShelf SW] Purging old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // API requests: Network first with JSON fallback
  if (e.request.url.includes("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline mode" }), {
          headers: { "Content-Type": "application/json" }
        });
      })
    );
  } else {
    // Static assets & HTML: Network-first to always show latest updates, fallback to cache offline
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request);
        })
    );
  }
});
