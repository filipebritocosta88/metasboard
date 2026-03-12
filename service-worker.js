const cacheName = 'metasboard-v1';
const assets = [
  '/metasboard/',
  '/metasboard/index.html',
  '/metasboard/app.js',
  '/metasboard/manifest.json'
];

// Instala o service worker e guarda os arquivos no cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Responde com o cache quando estiver offline
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
