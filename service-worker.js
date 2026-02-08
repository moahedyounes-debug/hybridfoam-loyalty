self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("membership-cache").then(cache => {
      return cache.addAll([
        "/card.html",
        "/api.js",
        "/manifest.json",
        "/icon-192.png",
        "/icon-512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
