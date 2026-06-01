/**
 * FICHIER : parametrage/assets/js/detect/bind-detection-panel.js
 * RÔLE : Bouton « Lancer la détection » et chargement rapport.
 * ENTRÉES : clic #ugap-detect-run.
 * SORTIES : rapport peint ou message erreur.
 * DÉPEND DE : fetch-detection-report, paint-detection-report, render-detection-summary.
 */
(function (global) {
    'use strict';

    function bindDetectionPanel() {
        const btn = document.getElementById('ugap-detect-run');
        const status = document.getElementById('ugap-detect-status');
        const summary = document.getElementById('ugap-detect-summary');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            if (status) status.textContent = 'Analyse en cours…';
            try {
                const report = await global.UgapDetectFetch.fetchDetectionReport();
                if (global.UgapDetectSummary && summary) {
                    global.UgapDetectSummary.renderDetectionSummary(summary, report);
                }
                if (global.UgapDetectPaint) {
                    global.UgapDetectPaint.paintDetectionReport(report);
                }
                if (status) status.textContent = 'Détection terminée.';
                if (typeof global.showAlert === 'function') {
                    global.showAlert('Détection Excel terminée.', 'success');
                }
            } catch (err) {
                if (status) status.textContent = '';
                if (typeof global.showAlert === 'function') {
                    global.showAlert(err.message || 'Erreur détection', 'error');
                }
            } finally {
                btn.disabled = false;
            }
        });
    }

    global.UgapDetectBind = { bindDetectionPanel };
})(window);
