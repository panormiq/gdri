/**
 * Tableau minorations : nom moteur + numéros de poste.
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function renderDetectionMinorationTable(mount, lines) {
        if (!mount) return;
        const rows = Array.isArray(lines) ? lines : [];
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune minoration détectée.</p>';
            return;
        }
        const body = rows.map((line) => `
            <tr>
                <td>${esc(line.rowIndex)}${line.splitFromRowIndex ? `<br><small>↳ split L${esc(line.splitFromRowIndex)}</small>` : ''}</td>
                <td>${esc(line.label)}</td>
                <td>${esc(line.refUgap)}</td>
                <td>${esc(line.motorName || '')}</td>
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
                        <th>Réf. UGAP</th>
                        <th>Moteur</th>
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

    global.UgapDetectRenderMinoration = { renderDetectionMinorationTable };
})(window);
