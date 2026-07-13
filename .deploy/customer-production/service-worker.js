const CACHE_NAME = "thank-you-cai-production-v1";
const CORE_ASSETS = [
  "./customer.html",
  "./styles.css",
  "./customer-production.css",
  "./cloud-config.js",
  "./cloud-client.js",
  "./catalog.js",
  "./app.js",
  "./customer-production.js",
  "./gacha-feedback.css",
  "./gacha-feedback.js",
  "./card-visual-upgrade.css",
  "./card-visual-upgrade.js",
  "./card-effects.css",
  "./card-effects.js",
  "./manifest.webmanifest",
  "./app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./customer.html", copy));
          return response;
        })
        .catch(() => caches.match("./customer.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
