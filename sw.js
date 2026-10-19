/* Momentum service worker — offline-first app shell. */
const VERSION = 'momentum-v1.0.4';
const SHELL = `${VERSION}-shell`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/ui.js',
  './js/utils.js',
  './js/store.js',
  './js/plan.js',
  './js/coach.js',
  './js/charts.js',
  './js/onboarding.js',
  './js/recipes.js',
  './js/vision.js',
  './js/snaplog.js',
  './js/views/today.js',
  './js/views/body.js',
  './js/views/fuel.js',
  './js/views/flow.js',
  './js/views/move.js',
  './js/views/progress.js',
  './js/views/coach.js',
  './js/views/settings.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let the browser handle CDNs

  // Navigations: network first (so updates land), fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else: stale-while-revalidate — serve from cache instantly so the
  // app opens offline, and refresh the entry in the background so updates land.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const refresh = fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);
    event.waitUntil(refresh);
    if (cached) return cached;
    const fresh = await refresh;
    return fresh || new Response('', { status: 504, statusText: 'offline' });
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
