/* Service worker: deja la app usable sin conexión.
 * - App shell: red primero, caché como respaldo (para que las versiones nuevas lleguen siempre).
 * - Mosaicos del mapa: cache-first con tope de tamaño (solo los que ya viste).
 * - Nominatim / OSRM: sin interceptar, necesitan red por definición.
 */
const SHELL_CACHE = 'watrip-shell-v10';
const TILE_CACHE  = 'watrip-tiles-v1';
const MAX_TILES   = 800;

const SHELL = [
  './', './index.html', './styles.css', './app.js', './plan.js',
  './vendor/leaflet.js', './vendor/leaflet.css',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_TILES).map(k => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Mosaicos del mapa
  if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(request, res.clone());
          trimTiles();
        }
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'sin conexión' });
      }
    })());
    return;
  }

  // App shell (mismo origen): red primero, caché como respaldo.
  // Al revés (caché primero) una versión nueva tardaba dos recargas en aparecer,
  // y se podía quedar el HTML nuevo con el JS viejo.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) || cache.match('./index.html');
      }
    })());
  }
  // El resto (Nominatim, OSRM) va directo a la red.
});
