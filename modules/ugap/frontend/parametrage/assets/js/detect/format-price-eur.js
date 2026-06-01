/**
 * FICHIER : parametrage/assets/js/detect/format-price-eur.js
 * RÔLE : Formate un nombre en euros affichage FR.
 * ENTRÉES : number.
 * SORTIES : string.
 */
(function (global) {
    'use strict';

    function formatPriceEur(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    global.UgapDetectFormat = { formatPriceEur };
})(window);
