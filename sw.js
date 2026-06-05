const CACHE_NAME = 'life-tracker-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './firebase-config.js',
  './gemini.js',
  './manifest.json',
  './logo.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network-first for scripts/HTML, Cache-first for styles/fonts/images)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Firebase dynamic requests, Firestore syncs, and Gemini API calls
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.origin.includes('generativelanguage.googleapis.com') ||
    url.origin.includes('firebase')
  ) {
    return;
  }

  // Cache-first for fonts, styles, and SVG logo
  if (
    event.request.destination === 'font' ||
    url.href.includes('fonts.googleapis.com') ||
    url.href.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        }).catch(() => new Response("Offline resource unavailable"));
      })
    );
    return;
  }

  // Network-first for everything else (HTML, JS, manifest)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback if offline and not cached
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response("Offline - connection unavailable");
        });
      })
  );
});
