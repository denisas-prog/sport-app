// Salė PWA - Service Worker
// Įsidiegus kartą, programėlė veikia ir be interneto

const CACHE_NAME = 'sale-v2.2'; // keisti kartu su versija index.html "Apie" skiltyje
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Installation: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
    // Pastaba: NEKVIEČIAM skipWaiting() automatiškai. Naujas SW lauks,
    // kol vartotojas paspaus „Atnaujinti" mygtuką (žiūr. message handler žemiau).
  );
});

// Vartotojui paspaudus „Atnaujinti" — perimti valdymą iš karto
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activation: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For HTML: network-first, fallback to cache (so updates appear when online)
// - For everything else (assets, fonts): cache-first, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isHTML = request.mode === 'navigate' ||
                 (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // v2.2: nekešuojam klaidų puslapių (404/500), kad jie neperrašytų gero index.html
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for assets and fonts
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        // Cache Google Fonts and same-origin successful responses
        if (res && res.status === 200 && (url.origin === location.origin || url.host.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
