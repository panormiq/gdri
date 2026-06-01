/**
 * FICHIER : parametrage/assets/js/detect/render-detection-summary.js
 * RÔLE : Affiche le résumé compteurs après détection.
 * ENTRÉES : mount HTMLElement, report { counts, sourceFile }.
 * SORTIES : HTML dans mount.
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function renderDetectionSummary(mount, report) {
        if (!mount) return;
        const c = report?.counts || {};
        mount.hidden = false;
        mount.innerHTML = `
            <p><strong>Fichier :</strong> ${esc(report?.sourceFile || '—')}</p>
            <ul class="ugap-detect-counts">
                <li><strong>${c.models ?? 0}</strong> modèles</li>
                <li><strong>${c.minoration ?? 0}</strong> minorations</li>
                <li><strong>${c.majoration ?? 0}</strong> majorations</li>
                <li><strong>${c.catalogue ?? 0}</strong> options catalogue</li>
                <li><strong>${c.base_option ?? 0}</strong> options de base (candidats)</li>
                <li><strong>${c.pr ?? 0}</strong> PR</li>
            </ul>
        `;
    }

    global.UgapDetectSummary = { renderDetectionSummary };
})(window);
