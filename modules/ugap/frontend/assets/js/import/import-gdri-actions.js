/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-gdri-actions.js
 * RÔLE : Actions Import en inclusion GDRI (sans admin-legacy.js).
 *
 * ENTRÉES : DOM boutons import, API /import, /import-audit, staging.
 * SORTIES : importExcel, reprise workflow, audit simplifié.
 *
 * DÉPEND DE : ugap-api.js, import-list.js, import-workflow-shell.js.
 * NE PAS : catalogue admin, familles, prompts.
 *
 * APPELÉ PAR : import-boot.js.
 */
(function (global) {
    'use strict';

    function apiCall(endpoint, options) {
        if (typeof global.apiCall !== 'function') {
            return Promise.reject(new Error('apiCall indisponible.'));
        }
        return global.apiCall(endpoint, options);
    }

    function showAlert(message, type) {
        if (typeof global.showAlert === 'function') {
            global.showAlert(message, type);
            return;
        }
        alert(String(message || ''));
    }

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isImportGdriEmbed() {
        return !!document.getElementById('ugap-import-app');
    }

    function ensureImportTabVisible() {
        if (!isImportGdriEmbed()) return false;
        global.workspaceMode = 'import';
        return true;
    }

    function applyImportStagingToCurrentData() {
        /* Hors legacy admin : le workflow lit currentImportStaging directement. */
    }

    async function importExcel() {
        if (!ensureImportTabVisible()) return;
        if (typeof global.setImportViewMode === 'function') {
            global.setImportViewMode('editor');
        }
        const statusEl = document.getElementById('import-status');
        if (statusEl) {
            statusEl.textContent = 'Import en cours…';
            statusEl.style.color = '#007bff';
        }
        try {
            const result = await apiCall('/import', { method: 'POST' });
            const importId = String(result?.data?.importId || '').trim();
            showAlert(
                `Import réussi : ${result?.data?.modelsCount ?? 0} modèle(s), ${result?.data?.optionsCount ?? 0} option(s).`,
                'success'
            );
            if (statusEl) {
                statusEl.textContent = 'Import réussi';
                statusEl.style.color = '#28a745';
            }
            if (typeof global.refreshImportStagingIndicator === 'function') {
                await global.refreshImportStagingIndicator();
            }
            if (importId && typeof global.openImportEditor === 'function') {
                await global.openImportEditor(importId, { resume: false });
            }
        } catch (error) {
            showAlert('Erreur lors de l\'import : ' + (error?.message || error), 'error');
            if (statusEl) {
                statusEl.textContent = 'Erreur';
                statusEl.style.color = '#dc3545';
            }
        }
    }

    async function resumeImportWorkflow() {
        if (typeof global.refreshImportStagingIndicator === 'function') {
            await global.refreshImportStagingIndicator();
        }
        const st = global.currentImportStaging;
        if (!st?._id) {
            showAlert('Aucun import en cours à reprendre.', 'warning');
            return;
        }
        const importId = String(st._id || global.currentImportId || '').trim();
        const published = String(st?.status || '').toLowerCase() === 'published';
        if (published && importId) {
            try {
                await apiCall(`/imports/staging/${encodeURIComponent(importId)}/reopen`, { method: 'POST' });
                if (typeof global.refreshImportStagingIndicator === 'function') {
                    await global.refreshImportStagingIndicator();
                }
            } catch (error) {
                showAlert('Erreur reprise import : ' + error.message, 'error');
                return;
            }
        }
        if (importId && typeof global.openImportEditor === 'function') {
            await global.openImportEditor(importId, { resume: true });
        }
    }

    async function runImportAudit() {
        try {
            const result = await apiCall('/import-audit');
            const reports = Array.isArray(result?.data?.reports) ? result.data.reports : [];
            const nonZero = reports.filter((r) => Number(r?.deltas?.options || 0) !== 0);
            if (!nonZero.length) {
                showAlert('Audit OK : aucun écart sur les options par modèle.', 'success');
                return;
            }
            const lines = nonZero.slice(0, 8).map((r) => {
                const mid = escapeHtml(String(r?.modelId || r?.modelName || '—'));
                const delta = Number(r?.deltas?.options || 0);
                return `<li>${mid} : écart ${delta} option(s)</li>`;
            }).join('');
            const more = nonZero.length > 8 ? `<li>… et ${nonZero.length - 8} autre(s) modèle(s)</li>` : '';
            const host = document.getElementById('ugap-import-app') || document.body;
            let modal = document.getElementById('ugap-import-audit-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'ugap-import-audit-modal';
                modal.className = 'modal active';
                modal.style.cssText = 'display:flex;align-items:flex-start;justify-content:center;padding:16px;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;';
                host.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="modal-content" style="background:#fff;border-radius:8px;padding:20px;max-width:640px;width:95%;max-height:85vh;overflow:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h2 style="margin:0;font-size:18px;">Audit écarts Excel</h2>
                        <button type="button" class="btn btn-outline" id="ugap-import-audit-close">Fermer</button>
                    </div>
                    <p style="color:#64748b;font-size:13px;">${nonZero.length} modèle(s) avec écart(s).</p>
                    <ul style="margin:12px 0 0;padding-left:20px;font-size:13px;">${lines}${more}</ul>
                </div>`;
            modal.style.display = 'flex';
            modal.querySelector('#ugap-import-audit-close')?.addEventListener('click', () => {
                modal.remove();
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
            showAlert(`Audit terminé : ${nonZero.length} modèle(s) avec écart(s).`, 'warning');
        } catch (error) {
            showAlert('Erreur audit import : ' + error.message, 'error');
        }
    }

    function bindImportGdriActions() {
        if (!isImportGdriEmbed() || global.__ugapImportGdriActionsBound) return;
        global.__ugapImportGdriActionsBound = true;

        document.getElementById('btn-import')?.addEventListener('click', () => {
            importExcel().catch((e) => showAlert(e?.message || String(e), 'error'));
        });
        document.getElementById('btn-import-audit')?.addEventListener('click', () => {
            runImportAudit().catch((e) => showAlert(e?.message || String(e), 'error'));
        });
        document.getElementById('btn-resume-import')?.addEventListener('click', () => {
            resumeImportWorkflow().catch((e) => showAlert(e?.message || String(e), 'error'));
        });
    }

    global.importExcel = importExcel;
    global.runImportAudit = runImportAudit;
    global.resumeImportWorkflow = resumeImportWorkflow;
    global.ensureImportTabVisible = ensureImportTabVisible;
    global.applyImportStagingToCurrentData = applyImportStagingToCurrentData;
    global.workspaceMode = 'import';

    global.UgapImportGdriActions = {
        bindImportGdriActions,
        importExcel,
        resumeImportWorkflow,
        runImportAudit
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindImportGdriActions);
    } else {
        bindImportGdriActions();
    }
})(window);
