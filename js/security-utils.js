(function (global) {
    'use strict';

    const STORAGE_HOST = 'tbwmsgztpyyratambgqs.supabase.co';
    const SIGNED_URL_CACHE_KEY = 'motazt:signed-url-cache:v1';
    const CACHE_SAFETY_WINDOW_MS = 10 * 60 * 1000;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeUrl(value, options = {}) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
        if (raw.startsWith('./') || raw.startsWith('../')) return raw;
        try {
            const parsed = new URL(raw, global.location?.origin || 'https://motaztstudio.local');
            const allowedHosts = options.allowedHosts || [STORAGE_HOST];
            const allowSameOrigin = options.allowSameOrigin !== false;
            const sameOrigin = global.location && parsed.origin === global.location.origin;
            const hostAllowed = allowedHosts.includes(parsed.hostname);
            if (parsed.protocol !== 'https:') return '';
            if (!sameOrigin && !hostAllowed) return '';
            if (!allowSameOrigin && sameOrigin) return '';
            return parsed.href;
        } catch {
            return '';
        }
    }

    function safeStorageUrl(value) {
        return safeUrl(value, { allowedHosts: [STORAGE_HOST] });
    }

    function thumbnailUrl(value, width = 700, quality = 70) {
        const safe = safeStorageUrl(value);
        if (!safe) return '';
        try {
            const url = new URL(safe);
            if (url.pathname.includes('/storage/v1/object/sign/')) {
                url.pathname = url.pathname.replace('/storage/v1/object/sign/', '/storage/v1/render/image/sign/');
                url.searchParams.set('width', String(width));
                url.searchParams.set('quality', String(quality));
                return url.href;
            }
            if (url.pathname.includes('/storage/v1/object/public/')) {
                url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
                url.searchParams.set('width', String(width));
                url.searchParams.set('quality', String(quality));
                return url.href;
            }
        } catch {
            return safe;
        }
        return safe;
    }

    function textToSafeHtml(value) {
        const escaped = escapeHtml(value);
        return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    function cacheScope(scope) {
        return scope.galleryId ? `gallery:${scope.galleryId}` : (scope.portfolio ? 'portfolio' : 'default');
    }

    function readSignedCache() {
        try {
            const raw = global.localStorage?.getItem(SIGNED_URL_CACHE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeSignedCache(cache) {
        try {
            global.localStorage?.setItem(SIGNED_URL_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // Storage cheio ou indisponível: a aplicação continua sem cache persistente.
        }
    }

    function getCachedUrl(cache, key) {
        const item = cache[key];
        if (!item || typeof item.url !== 'string' || item.expiresAt <= Date.now() + CACHE_SAFETY_WINDOW_MS) {
            if (item) delete cache[key];
            return '';
        }
        return safeStorageUrl(item.url);
    }

    async function getSignedStorageUrls(values, scope = {}) {
        const inputs = Array.isArray(values) ? values : [values];
        const cleanInputs = inputs.map(value => String(value ?? '').trim()).filter(Boolean);
        if (!cleanInputs.length) return new Map();

        const scopeKey = cacheScope(scope);
        const cache = readSignedCache();
        const result = new Map();
        const missing = [];
        cleanInputs.forEach(value => {
            const cached = getCachedUrl(cache, `${scopeKey}|${value}`);
            if (cached) result.set(value, cached);
            else missing.push(value);
        });

        if (missing.length) {
            const response = await fetch('/api/signed-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    paths: missing,
                    galleryId: scope.galleryId || undefined,
                    portfolio: scope.portfolio === true
                })
            });
            if (!response.ok) throw new Error('Não foi possível carregar as imagens com segurança.');
            const payload = await response.json();
            const expiresIn = Number(payload.expiresIn) > 0 ? Number(payload.expiresIn) : 3600;
            const entries = Array.isArray(payload.signed) ? payload.signed : [];
            entries.forEach(entry => {
                const path = entry?.path || entry?.name;
                const signedUrl = safeStorageUrl(entry?.signedURL || entry?.signedUrl || entry?.url);
                if (path && signedUrl) {
                    result.set(path, signedUrl);
                    cache[`${scopeKey}|${path}`] = {
                        url: signedUrl,
                        expiresAt: Date.now() + (expiresIn * 1000)
                    };
                }
            });
            writeSignedCache(cache);
        }

        return new Map(cleanInputs.map(value => [value, result.get(value) || '']));
    }

    if (global.navigator?.serviceWorker) {
        global.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    global.MotaztSecurity = Object.freeze({
        escapeHtml,
        safeUrl,
        safeStorageUrl,
        thumbnailUrl,
        getSignedStorageUrls,
        textToSafeHtml
    });
})(window);
