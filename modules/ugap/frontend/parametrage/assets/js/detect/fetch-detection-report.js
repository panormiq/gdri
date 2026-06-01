/**
 * FICHIER : parametrage/assets/js/detect/fetch-detection-report.js
 * RÔLE : Appelle GET /api/ugap/import/detect-excel.
 * ENTRÉES : —
 * SORTIES : Promise<object> rapport détection.
 * DÉPEND DE : shared/ugap-api.js (apiCall).
 * NE PAS : rendre tableaux DOM.
 * APPELÉ PAR : bind-detection-panel.js.
 */
(function (global) {
    'use strict';

    async function fetchDetectionReport() {
        if (typeof global.apiCall !== 'function') {
            throw new Error('apiCall indisponible');
        }
        const res = await global.apiCall('/import/detect-excel');
        return res.data || {};
    }

    global.UgapDetectFetch = { fetchDetectionReport };
})(window);
