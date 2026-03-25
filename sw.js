// Quinn Service Worker — v0.3.1
// Bump CACHE_NAME when you want to force-wipe the offline cache
const CACHE_NAME = 'quinn-v0.6.0';

// Static assets to precache on install (icons + manifest rarely change)
const PRECACHE_ASSETS = [
  'manifest.json',
  'icons/icon-72x72.png',
  'icons/icon-96x96.png',
  'icons/icon-128x128.png',
  'icons/icon-144x144.png',
  'icons/icon-152x152.png',
  'icons/icon-192x192.png',
  'icons/icon-384x384.png',
  'icons/icon-512x512.png',
  'icons/apple-touch-icon.png',
  'icons/splash-1170x2532.png',
  'icons/splash-1284x2778.png',
  'icons/splash-750x1334.png',
];

// Install — precache icons + manifest, take over immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

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

  // Navigation (the app HTML) — network-first, always fresh.
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

  // Icons and manifest — cache-first, update in background (stale-while-revalidate).
  // These rarely change; serve instantly from cache, refresh behind the scenes.
  const isIcon     = url.pathname.includes('/icons/');
  const isManifest = url.pathname.endsWith('manifest.json');
  if (isIcon || isManifest) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          return response;
        });
        // Serve cache immediately; let network update run in background
        return cached || networkFetch;
      })
    );
    return;
  }

  // Other same-origin static assets (sw.js itself, etc.) — cache-first
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
