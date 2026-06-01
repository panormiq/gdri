/**
 * Tableau options de base dérivées (1 par mino/majo, sauf hors-bord).
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function renderDetectionBaseOptionTable(mount, lines) {
        if (!mount) return;
        const rows = Array.isArray(lines) ? lines : [];
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune option de base dérivée.</p>';
            return;
        }
        const body = rows.map((line) => `
            <tr>
                <td>${esc(line.sourceRowIndex)}</td>
                <td>${esc(line.sourceKind)}</td>
                <td>${esc(line.baseOptionName || '')}</td>
                <td>${esc(line.label)}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceClient))}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceUgap))}</td>
                <td>${esc(line.displayPostes || '')}</td>
            </tr>
        `).join('');

        mount.innerHTML = `
            <table class="ugap-detect-table">
                <thead>
                    <tr>
                        <th>Ligne source</th>
                        <th>Source</th>
                        <th>Nom option de base</th>
                        <th>Libellé Excel</th>
                        <th class="num">Prix client</th>
                        <th class="num">Prix UGAP</th>
                        <th>Postes</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    global.UgapDetectRenderBaseOption = { renderDetectionBaseOptionTable };
})(window);
