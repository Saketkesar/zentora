// Basic SW for caching static assets and OSM tiles
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const TILE_CACHE = `tiles-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll([
    '/',
    '/favicon.ico',
  ])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![STATIC_CACHE, TILE_CACHE].includes(k)).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache OSM tiles with stale-while-revalidate
  if (/tile.openstreetmap.org\//.test(url.hostname + url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }
  // Default: network first, fallback to cache
  event.respondWith((async () => {
    try {
      const net = await fetch(event.request);
      if (event.request.method === 'GET' && net.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(event.request, net.clone());
      }
      return net;
    } catch (e) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw e;
    }
  })());
});
