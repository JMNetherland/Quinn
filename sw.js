// Quinn Service Worker — network-first, always fresh
// Bump CACHE_NAME when you want to force-wipe the offline cache
const CACHE_NAME = 'quinn-v1';

// Install — take over immediately, don't wait for old tabs to close
self.addEventListener('install', () => self.skipWaiting());

// Activate — delete any old cache versions, claim all open tabs
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Navigation (the app HTML) — always hit the network, skip all caches.
  // Falls back to cached copy only when genuinely offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // External resources (Google Fonts etc.) — cache-first, fine to serve stale
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        return response;
      });
    })
  );
});
