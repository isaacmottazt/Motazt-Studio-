/* Utilitários de segurança do frontend Motazt Studio. */
(function (global) {
    'use strict';

    const STORAGE_HOST = 'tbwmsgztpyyratambgqs.supabase.co';

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

    function textToSafeHtml(value) {
        const escaped = escapeHtml(value);
        return escaped
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    async function getSignedStorageUrls(values, scope = {}) {
        const inputs = Array.isArray(values) ? values : [values];
        const paths = inputs.map(value => String(value ?? '').trim()).filter(Boolean);
        if (!paths.length) return new Map();
        const response = await fetch('/api/signed-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ paths, galleryId: scope.galleryId || undefined, portfolio: scope.portfolio === true })
        });
        if (!response.ok) throw new Error('Não foi possível carregar as imagens com segurança.');
        const payload = await response.json();
        const result = new Map();
        const entries = Array.isArray(payload.signed) ? payload.signed : [];
        entries.forEach(entry => {
            const path = entry?.path || entry?.name;
            const signedUrl = entry?.signedURL || entry?.signedUrl || entry?.url;
            if (path && signedUrl) result.set(path, safeStorageUrl(signedUrl));
        });
        return new Map(inputs.map(value => [value, result.get(value) || '']));
    }

    global.MotaztSecurity = Object.freeze({
        escapeHtml,
        safeUrl,
        safeStorageUrl,
        getSignedStorageUrls,
        textToSafeHtml
    });
})(window);
