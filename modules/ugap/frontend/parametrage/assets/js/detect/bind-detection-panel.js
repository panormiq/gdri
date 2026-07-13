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
        const importBtn = document.getElementById('ugap-detect-import');
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

        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                if (typeof global.apiCall !== 'function') {
                    if (typeof global.showAlert === 'function') {
                        global.showAlert('apiCall indisponible.', 'error');
                    }
                    return;
                }
                importBtn.disabled = true;
                if (status) status.textContent = 'Import staging en cours…';
                try {
                    const result = await global.apiCall('/import', { method: 'POST' });
                    const staging = result?.data?.staging || result?.data || null;
                    if (staging) {
                        global.currentImportStaging = staging;
                        global.currentImportId = String(staging._id || result?.data?.importId || '');
                    }
                    if (status) status.textContent = 'Import terminé.';
                    if (typeof global.showAlert === 'function') {
                        const n = result?.data?.modelsCount ?? staging?.models?.length ?? 0;
                        global.showAlert(`Import réussi (${n} modèle(s)). Onglet Modèles pour valider.`, 'success');
                    }
                    const modelesTab = document.querySelector('.ugap-import-tab[data-tab="modeles"]');
                    if (modelesTab) modelesTab.click();
                } catch (err) {
                    if (status) status.textContent = '';
                    if (typeof global.showAlert === 'function') {
                        global.showAlert(err?.message || 'Erreur import', 'error');
                    }
                } finally {
                    importBtn.disabled = false;
                }
            });
        }
    }

    global.UgapDetectBind = { bindDetectionPanel };
})(window);
