const CACHE = 'muzyka-v1';
const STATIC = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/youtube.js',
  '/js/lastfm.js',
  '/js/swipe.js',
  '/js/library.js',
  '/js/settings.js',
  '/js/toast.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Don't cache Firebase, YouTube API, Last.fm calls
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('audioscrobbler.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com') ||
    e.request.method !== 'GET'
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' })));
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
