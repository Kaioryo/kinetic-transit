const CACHE_NAME = 'kinetic-transit-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Hanya navigasi halaman (bukan aset/API) yang di-fallback ke /offline —
  // tanpa ini, ESP32/GPS masih gagal, tapi setidaknya pengguna melihat
  // halaman offline sendiri, bukan halaman "no internet" bawaan browser.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE_URL)));
  }
});
