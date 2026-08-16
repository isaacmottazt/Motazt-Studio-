const CACHE_NAME = 'motazt-signed-images-v1';
const SIGNED_PATH = '/storage/v1/object/sign/fotos/';
const SAFETY_WINDOW_SECONDS = 30;

function tokenExpiry(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return 0;
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Number(decoded.exp) || 0;
  } catch {
    return 0;
  }
}

function isFresh(request) {
  const expiry = tokenExpiry(request);
  return expiry > Math.floor(Date.now() / 1000) + SAFETY_WINDOW_SECONDS;
}

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('motazt-signed-images-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.destination !== 'image' || !url.pathname.includes(SIGNED_PATH)) return;

  event.respondWith((async () => {
    if (!isFresh(request)) return fetch(request);
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
