/**
 * Tableau options de base — délègue à base-option-editor (double-clic → modale).
 */
(function (global) {
    'use strict';

    function renderDetectionBaseOptionTable(mount, lines, models) {
        if (!mount) return;
        if (global.UgapBaseOptionEditor?.renderBaseOptionTable) {
            global.UgapBaseOptionEditor.renderBaseOptionTable(mount, lines, models);
            return;
        }
        const rows = Array.isArray(lines) ? lines : [];
        mount.innerHTML = rows.length
            ? '<p class="ugap-param-placeholder">Éditeur options de base indisponible (rechargez la page).</p>'
            : '<p class="ugap-param-placeholder">Aucune option de base dérivée.</p>';
    }

    global.UgapDetectRenderBaseOption = { renderDetectionBaseOptionTable };
})(window);
