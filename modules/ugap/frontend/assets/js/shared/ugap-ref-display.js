/**
 * Références UGAP affichables — conserve MINO (ref minoration légitime).
 */
(function initUgapRefDisplay(global) {
    'use strict';

    function isTechnicalCatalogRef(ref) {
        const r = String(ref || '').trim();
        if (!r) return false;
        return /^(BASE-|IBP-|bp_src_|opt_ibp_)/i.test(r);
    }

    function sanitizeUgapRefForDisplay(ref) {
        const raw = String(ref || '').trim();
        if (!raw || isTechnicalCatalogRef(raw)) return '';
        return raw;
    }

    global.UgapRefDisplay = {
        isTechnicalCatalogRef,
        sanitizeUgapRefForDisplay,
    };
})(typeof window !== 'undefined' ? window : globalThis);
