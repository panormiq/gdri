/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-validate-step.js
 * RÔLE : Étape 7 du workflow import — validation finale + publication catalogue.
 *
 * ENTRÉES : `window.currentImportStaging`, `window.importWorkflowState`, API `/api/ugap/imports/staging/:id/*`
 * SORTIES : HTML étape 7 ; appels API validate-options / apply-assignments / publish ; refresh UI workflow.
 *
 * DÉPEND DE : `shared/ugap-api.js` (apiCall, showAlert), `import-workflow-shell.js` (renderImportWorkflow, renderImportStagingIndicator).
 * NE PAS : logique des étapes 2–6, parsing Excel, règles métier import.
 *
 * APPELÉ PAR : `import-workflow-shell.js` (rendu step "validate"), onclick UI.
 */
(function () {
    'use strict';

    const wfState = () => window.importWorkflowState || (window.importWorkflowState = {});
    const staging = () => window.currentImportStaging || null;
    const stagingId = () => String(window.currentImportId || staging()?._id || '').trim();

    function escapeHtml(value) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showAlert(message, type) {
        if (typeof window.showAlert === 'function') return window.showAlert(message, type);
        // fallback minimal
        alert(String(message || ''));
    }

    async function apiCall(endpoint, options) {
        if (typeof window.apiCall !== 'function') {
            throw new Error('apiCall indisponible (ugap-api.js non chargé).');
        }
        return window.apiCall(endpoint, options);
    }

    function getImportPrOptionsForStagingFallback() {
        const st = staging();
        const allOptions = Array.isArray(st?.importOptions) && st.importOptions.length
            ? st.importOptions
            : (Array.isArray(st?.categories) ? st.categories : [])
                .flatMap((cat) => (Array.isArray(cat?.options) ? cat.options : []));
        const out = [];
        allOptions.forEach((opt) => {
            const id = String(opt?.id || '').trim();
            if (!id) return;
            const name = String(opt?.name || id).trim();
            if (!/^PR\s/i.test(name)) return;
            out.push({ id, name });
        });
        return out;
    }

    function getImportPrCount() {
        if (typeof window.getImportPrOptionsForStaging === 'function') {
            try {
                return (window.getImportPrOptionsForStaging() || []).length;
            } catch (_e) {
                return getImportPrOptionsForStagingFallback().length;
            }
        }
        return getImportPrOptionsForStagingFallback().length;
    }

    function applyImportStagingApiResult(result, importId) {
        const id = String(importId || '').trim();
        if (typeof window.applyImportStagingApiResult === 'function') {
            window.applyImportStagingApiResult(result, id);
            return;
        }
        const next = result?.data || null;
        if (next && typeof next === 'object') {
            window.currentImportStaging = next;
            window.currentImportId = String(next?._id || id || '');
        }
    }

    function rerenderAfterMutation() {
        if (typeof window.renderImportStagingIndicator === 'function') {
            window.renderImportStagingIndicator(staging());
        }
        if (typeof window.renderImportWorkflow === 'function') {
            window.renderImportWorkflow();
        }
        if (typeof window.scheduleParentEmbedResize === 'function') {
            window.scheduleParentEmbedResize();
            setTimeout(window.scheduleParentEmbedResize, 120);
        }
    }

    function renderImportValidateStepHtml() {
        const st = staging();
        const models = Array.isArray(st?.models) ? st.models : [];
        const validatedCount = Number(st?.progress?.validatedModelIds?.length || 0);
        const prCount = getImportPrCount();
        const assignChecked = wfState()?.validateAssignAllPostesToUnassigned !== false ? 'checked' : '';
        return `<div style="border:1px solid #dbe3ea; border-radius:8px; background:#fff; padding:12px;">
            <div style="font-weight:600; margin-bottom:8px;">Validation finale de l'import</div>
            <div style="color:#475569; font-size:13px; margin-bottom:12px;">
                Modèles validés: <strong>${validatedCount}/${models.length}</strong> — PR détectées: <strong>${prCount}</strong>
            </div>
            <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; font-size:13px; color:#374151; cursor:pointer;">
                <input type="checkbox" id="import-validate-assign-all-postes" ${assignChecked}
                    onchange="importWorkflowState.validateAssignAllPostesToUnassigned = this.checked"
                    style="margin-top:2px;">
                <span>Assigner tous les postes aux options qui n'ont aucun poste affecté</span>
            </label>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn btn-outline" onclick="validateImportOptionsStep()">Valider options import</button>
                <button type="button" class="btn btn-success" onclick="publishCurrentImportStep()">Publier dans le catalogue</button>
            </div>
            <div style="margin-top:10px;color:#64748b;font-size:12px;line-height:1.4;">
                Publier copie l'import validé dans le catalogue UGAP (données utilisées par le configurateur).
            </div>
        </div>`;
    }

    async function validateImportOptionsStep() {
        const importId = stagingId();
        if (!importId) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        try {
            if (wfState()?.validateAssignAllPostesToUnassigned !== false) {
                const assigned = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/apply-assignments`, {
                    method: 'POST'
                });
                applyImportStagingApiResult(assigned, importId);
            }
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/validate-options`, {
                method: 'POST'
            });
            applyImportStagingApiResult(result, importId);
            showAlert('Options import validées.', 'success');
            rerenderAfterMutation();
        } catch (error) {
            showAlert(error?.message || 'Erreur lors de la validation des options.', 'danger');
        }
    }

    async function publishCurrentImportStep() {
        const importId = stagingId();
        if (!importId) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        try {
            // On s’assure que les assignations automatiques sont appliquées si demandé.
            if (wfState()?.validateAssignAllPostesToUnassigned !== false) {
                const assigned = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/apply-assignments`, {
                    method: 'POST'
                });
                applyImportStagingApiResult(assigned, importId);
            }
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/publish`, {
                method: 'POST'
            });
            applyImportStagingApiResult(result, importId);
            showAlert('Import publié dans le catalogue.', 'success');
            // après publish, on rafraîchit le workflow (statut "published" possible) + dataset côté GDRI.
            if (typeof window.refreshImportStagingIndicator === 'function') {
                await window.refreshImportStagingIndicator();
                return;
            }
            rerenderAfterMutation();
        } catch (error) {
            showAlert(error?.message || 'Erreur lors de la publication.', 'danger');
        }
    }

    window.renderImportValidateStepHtml = renderImportValidateStepHtml;
    window.validateImportOptionsStep = validateImportOptionsStep;
    window.publishCurrentImportStep = publishCurrentImportStep;
})();

