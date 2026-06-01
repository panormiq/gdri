/**
 * Peint tous les onglets à partir du rapport API.
 */
(function (global) {
    'use strict';

    function paintDetectionReport(report) {
        global.__ugapDetectionReport = report;

        const modelsMount = document.getElementById('ugap-detect-models-table');
        if (modelsMount && global.UgapDetectRenderModels) {
            global.UgapDetectRenderModels.renderDetectionModelsTable(modelsMount, report?.models);
        }

        const minoWrap = document.querySelector('[data-detect-kind="minoration"]');
        if (minoWrap && global.UgapDetectRenderMinoration) {
            global.UgapDetectRenderMinoration.renderDetectionMinorationTable(
                minoWrap,
                report?.linesByKind?.minoration
            );
        }

        const majoWrap = document.querySelector('[data-detect-kind="majoration"]');
        if (majoWrap && global.UgapDetectRenderMajoration) {
            global.UgapDetectRenderMajoration.renderDetectionMajorationTable(
                majoWrap,
                report?.linesByKind?.majoration
            );
        }

        const baseWrap = document.querySelector('[data-detect-kind="base_option"]');
        if (baseWrap && global.UgapDetectRenderBaseOption) {
            global.UgapDetectRenderBaseOption.renderDetectionBaseOptionTable(
                baseWrap,
                report?.linesByKind?.base_option
            );
        }

        ['catalogue', 'pr'].forEach((kind) => {
            const wrap = document.querySelector(`[data-detect-kind="${kind}"]`);
            if (!wrap || !global.UgapDetectRenderLines) return;
            global.UgapDetectRenderLines.renderDetectionLinesTable(
                wrap,
                report?.linesByKind?.[kind],
                report?.models,
                kind
            );
        });

        const importSection = document.getElementById('ugap-section-importation');
        (importSection || document).querySelectorAll('.ugap-import-tab').forEach((btn) => {
            const tab = btn.getAttribute('data-tab');
            if (tab === 'detect' || tab === 'valider') return;
            const count = tab === 'modeles'
                ? (report?.counts?.models ?? 0)
                : (report?.counts?.[tab] ?? 0);
            const base = btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
            btn.textContent = count > 0 ? `${base} (${count})` : base;
        });
    }

    global.UgapDetectPaint = { paintDetectionReport };
})(window);
