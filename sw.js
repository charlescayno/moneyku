const CACHE_NAME = 'moneyku-cache-v40';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './tailwind.css',
  './js/app.js',
  './js/utils.js',
  './js/state.js',
  './js/firebase.js',
  './js/charts.js',
  './js/calendar.js',
  './js/events.js',
  './js/insights.js',
  './js/categories.js',
  './js/tabs.js',
  './js/extras.js',
  './js/gemini.js',
  './js/itemOps.js',
  './js/ui/quicklog.js',
  './js/ui/index.js',
  './js/ui/core.js',
  './js/ui/components.js',
  './js/ui/modals.js',
  './js/ui/actions.js',
  './js/ui/layout.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/morphdom@2.7.0/dist/morphdom-umd.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cache each file independently so one 404 doesn't abort the whole install
      Promise.all(urlsToCache.map(url => cache.add(url).catch(err => console.warn('SW cache skip:', url, err))))
    )
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
    fetch(event.request, new URL(event.request.url).origin === self.location.origin ? { cache: 'no-cache' } : undefined)
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
