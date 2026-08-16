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

    global.MotaztSecurity = Object.freeze({
        escapeHtml,
        safeUrl,
        safeStorageUrl,
        textToSafeHtml
    });
})(window);
