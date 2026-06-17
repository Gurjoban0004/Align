// =============================================================
// ALIGN v2 — Service Worker
// =============================================================

const CACHE_VERSION = 'align-v2-2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const MAX_DYNAMIC = 60;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/views.css',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — strategy per resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase / Google APIs — network only, never cache
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('generativelanguage')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — cache first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2?|svg|png|ico)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML — network first, cache fallback
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await trimCache(cache);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html');
  }
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length >= MAX_DYNAMIC) {
    await cache.delete(keys[0]);
  }
}

// Background sync for offline writes
self.addEventListener('sync', (event) => {
  if (event.tag === 'align-sync-logs') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SYNC_PENDING' }));
      })
    );
  }
});
