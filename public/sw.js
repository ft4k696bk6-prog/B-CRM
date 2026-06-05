const CACHE_NAME = "bcrm-lean-sales-v1";
const OFFLINE_URLS = [
  "/",
  "/sales",
  "/materials",
  "/calculators",
  "/materials/prezentacja-re-energy-system.pdf",
  "/materials/umowa-na-fotowoltaike.pdf",
  "/materials/wniosek-kredytowy.pdf",
  "/icons/bcrm-icon.svg",
  "/products/ja-solar-panel.webp",
  "/products/deye-inverter.webp",
  "/products/deye-storage.webp",
  "/products/felicity-storage.jpg",
  "/products/kon-tec-storage.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
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
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/materials") || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (["style", "script", "image", "font"].includes(request.destination) || url.pathname.startsWith("/materials/"))) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
