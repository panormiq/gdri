/**
 * Tableau générique catalogue / PR — postes au lieu des noms de modèle.
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function renderDetectionLinesTable(mount, lines, _models, kind) {
        if (!mount) return;
        const rows = Array.isArray(lines) ? lines : [];
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune ligne pour ce type.</p>';
            return;
        }
        const showRef = kind !== 'pr';
        const body = rows.map((line) => `
            <tr>
                <td>${esc(line.rowIndex)}</td>
                <td>${esc(line.label)}</td>
                ${showRef ? `<td>${esc(line.refUgap)}</td>` : ''}
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceClient))}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceUgap))}</td>
                <td>${esc(line.crosses)}</td>
                <td>${esc(line.displayPostes || '')}</td>
            </tr>
        `).join('');

        mount.innerHTML = `
            <table class="ugap-detect-table">
                <thead>
                    <tr>
                        <th>Ligne</th>
                        <th>Libellé</th>
                        ${showRef ? '<th>Réf. UGAP</th>' : ''}
                        <th class="num">Prix client</th>
                        <th class="num">Prix UGAP</th>
                        <th>Croix</th>
                        <th>Postes</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    global.UgapDetectRenderLines = { renderDetectionLinesTable };
})(window);
