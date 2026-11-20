const CACHE_NAME = 'moneyku-cache-v214';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/money-icon.png',
  './assets/avatar-charlie.jpg',
  './assets/avatar-karla.jpg',
  './assets/avatar-ynah.jpg',
  './assets/avatar-charles.jpg',
  './style.css',
  './theme.css',
  './tailwind.css',
  './js/app.js',
  './js/utils.js',
  './js/state.js',
  './js/firebase.js',
  './js/charts.js',
  './js/calendar.js',
  './js/events.js', './js/edgeswipe.js',
  './js/insights.js',
  './js/categories.js',
  './js/tabs.js',
  './js/extras.js',
  './js/gemini.js',
  './js/itemOps.js', './js/migrations.js',
  './js/arrange.js', './js/payfrom.js', './js/scope.js', './js/card.js',
  './js/ui/next5.js', './js/simulated.js', './js/history.js', './js/ui/historyui.js', './js/ui/cardui.js',
  './js/ui/quicklog.js',
  './js/ui/index.js',
  './js/ui/core.js',
  './js/ui/components.js',
  './js/ui/modals.js',
  './js/ui/actions.js',
  './js/ui/layout.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/morphdom@2.7.0/dist/morphdom-umd.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  // Firebase SDK modules (imported by js/firebase.js), so the app can start offline after one online visit
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
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
        // Save good responses (and opaque CDN ones) for offline use; never cache errors
        if (response && (response.ok || response.type === 'opaque')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        // Offline: exact match, then ignore ?v= cache-busters, then the app shell for page loads
        return (
          (await caches.match(event.request)) ||
          (await caches.match(event.request, { ignoreSearch: true })) ||
          (event.request.mode === 'navigate' ? await caches.match('./index.html') : undefined) ||
          Response.error()
        );
      })
  );
});
