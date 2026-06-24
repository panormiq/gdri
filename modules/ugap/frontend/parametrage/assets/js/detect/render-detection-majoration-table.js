/**
 * Tableau majorations — nom option cible + libellé Excel + postes.
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function optionNameForLine(line) {
        if (global.UgapOptionDisplayName?.resolveDetectionAdjOptionName) {
            return global.UgapOptionDisplayName.resolveDetectionAdjOptionName(line, 'majoration');
        }
        return String(line?.replacedObject || line?.newObject || line?.optionName || '').trim();
    }

    function renderDetectionMajorationTable(mount, lines) {
        if (!mount) return;
        const rows = Array.isArray(lines) ? lines : [];
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune majoration détectée.</p>';
            return;
        }
        const body = rows.map((line) => `
            <tr>
                <td>${esc(line.rowIndex)}</td>
                <td class="ugap-detect-option-name">${esc(optionNameForLine(line) || '—')}</td>
                <td class="ugap-detect-excel-label">${esc(line.label)}</td>
                <td>${esc(line.refUgap)}</td>
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
                        <th>Nom de l'option</th>
                        <th>Libellé Excel</th>
                        <th>Réf. UGAP</th>
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

    global.UgapDetectRenderMajoration = { renderDetectionMajorationTable };
})(window);
