/**
 * Affiche le tableau des modèles (ligne récap).
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function renderDetectionModelsTable(mount, models) {
        if (!mount) return;
        const rows = Array.isArray(models) ? models : [];
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucun modèle détecté.</p>';
            return;
        }
        const body = rows.map((m) => `
            <tr>
                <td>${esc(m.colIndex)}</td>
                <td>${esc(m.name)}</td>
                <td>${esc(m.motorizationBase)}</td>
                <td>${esc(m.posteNumber ?? '')}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(m.priceClient))}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(m.priceUgap))}</td>
                <td>${esc(m.rowIndex)}</td>
            </tr>
        `).join('');
        mount.innerHTML = `
            <table class="ugap-detect-table">
                <thead>
                    <tr>
                        <th>Col.</th>
                        <th>Modèle</th>
                        <th>Motorisation base</th>
                        <th>Poste</th>
                        <th class="num">Prix client</th>
                        <th class="num">Prix UGAP</th>
                        <th>Ligne</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    global.UgapDetectRenderModels = { renderDetectionModelsTable };
})(window);
