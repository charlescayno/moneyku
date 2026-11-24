const CACHE_NAME = 'moneyku-cache-v309';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/money-icon.png',
  './assets/bpi-logo.png',
  './assets/fonts/material-icons.woff2',
  './assets/brands/adobe.png',
  './assets/brands/amazon.png',
  './assets/brands/angkas.png',
  './assets/brands/apple.png',
  './assets/brands/aub.png',
  './assets/brands/bdo.png',
  './assets/brands/bpi.png',
  './assets/brands/canva.png',
  './assets/brands/ccf.png',
  './assets/brands/chatgpt.png',
  './assets/brands/cimb.png',
  './assets/brands/claude.png',
  './assets/brands/cms.png',
  './assets/brands/coinsph.png',
  './assets/brands/converge.png',
  './assets/brands/ctbc.png',
  './assets/brands/cursor.png',
  './assets/brands/disney.png',
  './assets/brands/eastwest.png',
  './assets/brands/gcash.png',
  './assets/brands/globe.png',
  './assets/brands/google.png',
  './assets/brands/gotyme.png',
  './assets/brands/grab.png',
  './assets/brands/grabpay.png',
  './assets/brands/hbo.png',
  './assets/brands/hsbc.png',
  './assets/brands/icloud.png',
  './assets/brands/ing.png',
  './assets/brands/jollibee.png',
  './assets/brands/landbank.png',
  './assets/brands/lazada.png',
  './assets/brands/maribank.png',
  './assets/brands/mcdo.png',
  './assets/brands/metrobank.png',
  './assets/brands/microsoft.png',
  './assets/brands/moveit.png',
  './assets/brands/netflix.png',
  './assets/brands/notion.png',
  './assets/brands/ownbank.png',
  './assets/brands/petron.png',
  './assets/brands/pldt.png',
  './assets/brands/prulife.png',
  './assets/brands/psbank.png',
  './assets/brands/puregold.png',
  './assets/brands/rcbc.png',
  './assets/brands/sc.png',
  './assets/brands/seabank.png',
  './assets/brands/securitybank.png',
  './assets/brands/shell.png',
  './assets/brands/shopee.png',
  './assets/brands/shopeepay.png',
  './assets/brands/sm.png',
  './assets/brands/spotify.png',
  './assets/brands/starbucks.png',
  './assets/brands/tiktok.png',
  './assets/brands/unionbank.png',
  './assets/brands/viu.png',
  './assets/brands/youtube.png',
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
  './js/icons.js', './js/ui/next5.js', './js/ui/runway.js', './js/simulated.js', './js/ui/childmenu.js', './js/history.js', './js/ui/historyui.js', './js/ui/cardui.js',
  './js/ui/quicklog.js', './js/ui/addsheet.js',
  './js/ui/index.js',
  './js/ui/core.js',
  './js/ui/components.js',
  './js/ui/modals.js',
  './js/ui/actions.js',
  './js/ui/layout.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/morphdom@2.7.0/dist/morphdom-umd.min.js',
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

  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  const network = fetch(event.request, sameOrigin ? { cache: 'no-cache' } : undefined)
    .then(response => {
      // Save good responses (and opaque CDN ones) for offline use; never cache errors
      if (response && (response.ok || response.type === 'opaque')) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
      }
      return response;
    });
  // Offline: exact match, then ignore ?v= cache-busters, then the app shell for page loads
  const fromCache = async () =>
    (await caches.match(event.request)) ||
    (await caches.match(event.request, { ignoreSearch: true })) ||
    (event.request.mode === 'navigate' ? await caches.match('./index.html') : undefined);
  // Network first so updates arrive, but on a weak connection the app must not wait: after 4 seconds use the saved copy
  // (the request keeps going and refreshes the cache for next time).
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 4000));
  event.respondWith(
    Promise.race([network.catch(() => null), timeout]).then(async res => {
      if (res) return res;
      return (await fromCache()) || network.catch(() => Response.error());
    })
  );
});
