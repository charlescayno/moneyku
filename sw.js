const CACHE_NAME = 'moneyku-cache-v5';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/utils.js',
  './js/state.js',
  './js/firebase.js',
  './js/charts.js',
  './js/calendar.js',
  './js/ui.js',
  './js/events.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/morphdom@2.7.0/dist/morphdom-umd.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If network succeeds, save a clone to the cache for future offline use
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, serve from cache
        return caches.match(event.request);
      })
  );
});
