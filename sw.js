// Quinn Service Worker — network-first, always fresh
// Bump CACHE_NAME when you want to force-wipe the offline cache
const CACHE_NAME = 'quinn-v0.2.0';

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

  // Never intercept cross-origin requests (Supabase API, CDN, Edge Functions).
  // Let these go straight to the network — service worker must not touch them.
  if (url.origin !== self.location.origin) return;

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

  // Same-origin static assets (sw.js itself, etc.) — cache-first
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
