const CACHE_NAME = 'motazt-signed-images-v2';
const META_CACHE_NAME = 'motazt-signed-images-meta-v2';
const SIGNED_PATH = '/storage/v1/object/sign/fotos/';
const LOCAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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
  return tokenExpiry(request) > Math.floor(Date.now() / 1000) + SAFETY_WINDOW_SECONDS;
}

function cacheKey(request) {
  const url = new URL(request.url);
  const path = url.pathname.split('/object/sign/fotos/')[1] || url.pathname;
  return new Request(`${self.location.origin}/__motaz-image-cache__/fotos/${path}`);
}

async function readCached(cache, metaCache, key) {
  const response = await cache.match(key);
  const meta = await metaCache.match(key);
  if (!response || !meta) return null;
  const cachedAt = Number(await meta.text());
  if (!cachedAt || Date.now() - cachedAt > LOCAL_CACHE_TTL_MS) {
    await Promise.all([cache.delete(key), metaCache.delete(key)]);
    return null;
  }
  return response;
}

async function storeCached(cache, metaCache, key, response) {
  await cache.put(key, response.clone());
  await metaCache.put(key, new Response(String(Date.now()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  }));
}

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('motazt-signed-images-') && ![CACHE_NAME, META_CACHE_NAME].includes(key))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.pathname.includes(SIGNED_PATH)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const metaCache = await caches.open(META_CACHE_NAME);
    const key = cacheKey(request);
    const cached = await readCached(cache, metaCache, key);
    if (cached) return cached;

    const response = await fetch(request);
    if (isFresh(request) && (response.ok || response.type === 'opaque')) {
      try { await storeCached(cache, metaCache, key, response); } catch { /* resposta não cacheável */ }
    }
    return response;
  })());
});
