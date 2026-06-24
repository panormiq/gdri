/**
 * Tableau minorations : nom option cible + libellé Excel + postes.
 */
(function (global) {
    'use strict';

    function esc(s) {
        return typeof global.escapeHtml === 'function'
            ? global.escapeHtml(s)
            : String(s ?? '');
    }

    function postesFromModelIds(modelIds, models) {
        const mids = (Array.isArray(modelIds) ? modelIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!mids.length) return '';
        const map = new Map(
            (Array.isArray(models) ? models : [])
                .map((m) => [String(m?.id || '').trim(), Number(m?.posteNumber)])
        );
        const nums = mids
            .map((id) => map.get(id))
            .filter((p) => Number.isFinite(p))
            .sort((a, b) => a - b);
        return nums.length ? nums.join(', ') : '';
    }

    function optionNameForLine(line) {
        if (global.UgapOptionDisplayName?.resolveDetectionAdjOptionName) {
            return global.UgapOptionDisplayName.resolveDetectionAdjOptionName(line, 'minoration');
        }
        return String(line?.optionName || line?.motorName || '').trim();
    }

    function enrichMinorationLineForDisplay(line, models) {
        const base = line && typeof line === 'object' ? { ...line } : {};
        const label = global.UgapPosteFromLabel?.normalizeLabelForPosteParse
            ? global.UgapPosteFromLabel.normalizeLabelForPosteParse(base.label)
            : String(base.label || '');

        const fromLabel = global.UgapPosteFromLabel?.getSortedExplicitPosteNumbersFromLabel
            ? global.UgapPosteFromLabel.getSortedExplicitPosteNumbersFromLabel(label)
            : [];

        let displayPostes = String(base.displayPostes || '').trim();
        if (!displayPostes && fromLabel.length) {
            displayPostes = fromLabel.join(', ');
        }
        if (!displayPostes) {
            displayPostes = postesFromModelIds(base.compatibleModelIds, models);
        }

        const excelCrosses = Number(base.crosses) || 0;
        let crosses = excelCrosses;
        if (!crosses && fromLabel.length) {
            crosses = fromLabel.length;
        } else if (!crosses && displayPostes) {
            crosses = displayPostes.split(',').filter((x) => x.trim()).length;
        }

        const fromLabelHint = fromLabel.length > 0 && excelCrosses === 0;
        const optionName = optionNameForLine({ ...base, label });
        return { ...base, label, displayPostes, crosses, optionName, _fromLabelHint: fromLabelHint };
    }

    function renderDetectionMinorationTable(mount, lines, models) {
        if (!mount) return;
        const modelList = Array.isArray(models) ? models : global.__ugapDetectionReport?.models;
        const rows = (Array.isArray(lines) ? lines : []).map((line) => enrichMinorationLineForDisplay(line, modelList));
        if (!rows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune minoration détectée.</p>';
            return;
        }
        const body = rows.map((line) => `
            <tr>
                <td>${esc(line.rowIndex)}${line.splitFromRowIndex ? `<br><small>↳ split L${esc(line.splitFromRowIndex)}</small>` : ''}</td>
                <td class="ugap-detect-option-name">${esc(line.optionName || '—')}</td>
                <td class="ugap-detect-excel-label">${esc(line.label)}</td>
                <td>${esc(line.refUgap)}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceClient))}</td>
                <td class="num">${esc(global.UgapDetectFormat.formatPriceEur(line.priceUgap))}</td>
                <td>${esc(line.crosses)}${line._fromLabelHint ? ' <span class="ugap-import-mino-hint">(libellé)</span>' : ''}</td>
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

    global.UgapDetectRenderMinoration = {
        renderDetectionMinorationTable,
        enrichMinorationLineForDisplay,
    };
})(window);
