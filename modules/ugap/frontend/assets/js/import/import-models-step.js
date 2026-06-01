/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-models-step.js
 * RÔLE : Étape 1 workflow import — tableau modèles, validation, prix.
 * ENTRÉES : `window.currentImportStaging`, DOM `#import-workflow-content-models`.
 * SORTIES : HTML étape 1 ; POST validate-models ; mise à jour staging.
 * DÉPEND DE : `window.apiCall`, `window.renderImportWorkflow`, `window.renderImportStagingIndicator`,
 *   `window.switchImportWorkflowStep`, `window.loadData`, `window.normalizeUgapDataContract`, etc.
 * NE PAS : minorations, options de base, familles, publication.
 * APPELÉ PAR : import-workflow-shell.js (`renderImportWorkflow`).
 */
(function () {
    'use strict';

    function escapeHtml(value) {
        if (window.UgapShared?.escapeHtml) return window.UgapShared.escapeHtml(value);
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
        return String(value ?? '');
    }
    const apiCall = (e, o) => window.apiCall(e, o);
    const showAlert = (m, t) => window.showAlert(m, t);
    const wf = () => window.importWorkflowState || (window.importWorkflowState = { step: 'models' });

    function importModelRowDisplayValidated(modelId, stagingValidatedIdSet) {
        const id = String(modelId || '').trim();
        return !!id && stagingValidatedIdSet.has(id);
    }

    function collectImportModelPriceUpdates() {
        return Array.from(document.querySelectorAll('.import-model-price-input')).map((input) => {
            const encodedId = String(input?.getAttribute('data-model-id') || '').trim();
            let id = encodedId;
            try { id = decodeURIComponent(encodedId); } catch (_) { /* ignore */ }
            const raw = String(input?.value || '').replace(',', '.').trim();
            const parsed = Number(raw);
            return { id, basePrice: Number.isFinite(parsed) ? parsed : 0 };
        }).filter((row) => row.id);
    }

    function formatImportModelMoneyInput(inputEl) {
        const el = inputEl;
        if (!el) return;
        const raw = String(el.value || '').replace(',', '.').trim();
        const parsed = Number(raw);
        const safe = Number.isFinite(parsed) ? parsed : 0;
        el.dataset.rawValue = Number.isFinite(parsed) ? String(parsed) : '0';
        el.value = safe.toFixed(2);
    }

    function focusImportModelMoneyInput(inputEl) {
        const el = inputEl;
        if (!el) return;
        const raw = String(el.dataset.rawValue || '').trim();
        if (raw) {
            el.value = raw;
            return;
        }
        const parsed = Number(String(el.value || '').replace(',', '.').trim());
        if (Number.isFinite(parsed)) el.value = String(parsed);
    }

    function toggleImportModelSelection(modelId, checked) {
        const id = String(modelId || '').trim();
        if (!id) return;
        const selected = new Set(wf().selectedModelIds || []);
        if (checked) selected.add(id);
        else selected.delete(id);
        wf().selectedModelIds = Array.from(selected);
    }

    function selectAllImportModelsVisible() {
        const checkboxes = Array.from(
            document.querySelectorAll('#import-workflow-content-models input[data-import-model-id]:not(:disabled)')
        );
        if (!checkboxes.length) {
            showAlert('Aucun modele a selectionner.', 'info');
            return;
        }
        const selected = new Set(wf().selectedModelIds || []);
        checkboxes.forEach((el) => {
            const encodedId = String(el?.getAttribute('data-import-model-id') || '').trim();
            let id = encodedId;
            try { id = decodeURIComponent(encodedId); } catch (_) { /* ignore */ }
            if (!id) return;
            el.checked = true;
            selected.add(String(id).trim());
        });
        wf().selectedModelIds = Array.from(selected);
    }

    function onImportModelStatusFilterChange(value) {
        const v = String(value || '').trim();
        wf().modelStatusFilter = v === 'all' ? 'all' : 'to_validate';
        if (typeof window.renderImportWorkflow === 'function') window.renderImportWorkflow();
    }

    /**
     * Rend le tableau modèles (étape 1) dans `#import-workflow-content-models`.
     */
    function renderImportModelsStepHtml() {
        const staging = window.currentImportStaging;
        if (!staging) {
            return '<div style="color:#6b7280;">Aucun workflow import actif.</div>';
        }
        const models = Array.isArray(staging.models) ? staging.models : [];
        const validatedIds = new Set((staging?.progress?.validatedModelIds || []).map((x) => String(x)));
        const statusFilter = String(wf().modelStatusFilter || 'to_validate');
        const visibleModels = models.filter((m) => {
            const id = String(m?.id || '');
            const displayOk = importModelRowDisplayValidated(id, validatedIds);
            if (statusFilter === 'all') return true;
            return !displayOk;
        });

        return `
            <div style="margin-bottom:10px; color:#4b5563;">Etape 1: valider les modeles detectes.</div>
            <div style="margin-bottom:10px; display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn btn-outline" onclick="selectAllImportModelsVisible()" style="margin-right:auto;">Tout selectionner</button>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#4b5563;">
                    Statut
                    <select onchange="onImportModelStatusFilterChange(this.value)" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px;">
                        <option value="to_validate" ${statusFilter === 'to_validate' ? 'selected' : ''}>A valider</option>
                        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Tous</option>
                    </select>
                </label>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center; width:52px;">OK</th>
                        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Modele</th>
                        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Poste</th>
                        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left; width:150px;">Prix</th>
                        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:left;">Etat</th>
                    </tr>
                </thead>
                <tbody>
                    ${visibleModels.map((m) => {
                        const id = String(m?.id || '');
                        const encodedId = encodeURIComponent(id);
                        const displayOk = importModelRowDisplayValidated(id, validatedIds);
                        return `<tr>
                            <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                <input type="checkbox" data-import-model-id="${encodedId}" ${displayOk ? 'checked' : ''} ${displayOk ? 'disabled' : ''} onchange="toggleImportModelSelection(decodeURIComponent('${encodedId}'), this.checked)">
                            </td>
                            <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.name || id || '-'))}</td>
                            <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.posteNumber ?? '-'))}</td>
                            <td style="padding:8px; border-bottom:1px solid #f1f5f9;">
                                <div style="display:inline-flex; align-items:center; gap:6px; border:1px solid #ddd; border-radius:4px; padding:0 8px; background:#fff;">
                                    <input class="import-model-price-input" data-model-id="${encodedId}" data-raw-value="${escapeHtml(String(Number.isFinite(Number(m?.basePrice)) ? Number(m.basePrice) : 0))}" type="text" inputmode="decimal" value="${escapeHtml((Number.isFinite(Number(m?.basePrice)) ? Number(m.basePrice) : 0).toFixed(2))}" onfocus="focusImportModelMoneyInput(this)" onblur="formatImportModelMoneyInput(this)" style="width:100px; padding:6px 0; border:none; outline:none; background:transparent;">
                                    <span style="color:#6b7280; font-size:12px;">€</span>
                                </div>
                            </td>
                            <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${displayOk ? '<span style="color:#16a34a; font-weight:600;">Valide</span>' : '<span style="color:#b45309;">A valider</span>'}</td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="5" style="padding:10px; color:#6b7280;">Aucun modele a afficher pour ce filtre.</td></tr>'}
                </tbody>
            </table>
            <div style="margin-top:12px; display:flex; justify-content:flex-end;">
                <button type="button" class="btn btn-success" onclick="validateImportModelsStep()">Valider la selection</button>
            </div>`;
    }

    async function validateImportModelsStep() {
        const staging = window.currentImportStaging;
        if (!staging?._id) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        const models = Array.isArray(staging.models) ? staging.models : [];
        const validatedIds = new Set((staging?.progress?.validatedModelIds || []).map((x) => String(x)));
        const modelIdsPresent = new Set(models.map((m) => String(m?.id || '').trim()).filter(Boolean));
        const selectedFromDom = Array.from(
            document.querySelectorAll('#import-workflow-content-models input[data-import-model-id]:checked:not(:disabled)')
        ).map((el) => {
            const encodedId = String(el?.getAttribute('data-import-model-id') || '').trim();
            try { return String(decodeURIComponent(encodedId || '')).trim(); } catch (_) { return encodedId; }
        }).filter(Boolean);
        const modelIds = selectedFromDom
            .map((id) => String(id || '').trim())
            .filter((id) => id && modelIdsPresent.has(id) && !importModelRowDisplayValidated(id, validatedIds));
        const modelUpdates = collectImportModelPriceUpdates().filter((row) => modelIds.includes(String(row?.id || '').trim()));
        if (!modelIds.length) {
            showAlert('Selectionnez au moins un modele "A valider" puis relancez la validation.', 'warning');
            return;
        }
        try {
            const result = await apiCall(
                `/imports/staging/${encodeURIComponent(String(staging._id))}/validate-models`,
                { method: 'POST', body: JSON.stringify({ modelIds, modelUpdates }) }
            );
            if (result?.data) {
                window.currentImportStaging = result.data;
                window.currentImportId = String(result.data?._id || window.currentImportId || '');
            }
            wf().selectedModelIds = [];
            if (typeof window.publishImportWorkflowGlobals === 'function') {
                window.publishImportWorkflowGlobals();
            }
            try {
                const freshCatalog = await apiCall('/data', { allowBusinessError: true });
                if (freshCatalog?.data && typeof window.normalizeUgapDataContract === 'function') {
                    window.__lastLoadDataSnapshot = window.normalizeUgapDataContract(freshCatalog.data);
                    if (typeof window.hydrateUiStateFromServer === 'function') await window.hydrateUiStateFromServer();
                    if (typeof window.cleanupDeletedOptionReferences === 'function') window.cleanupDeletedOptionReferences();
                    if (typeof window.updateStats === 'function') window.updateStats();
                    if (typeof window.updateAllTabWarningBadges === 'function') window.updateAllTabWarningBadges();
                } else if (typeof window.loadData === 'function') {
                    await window.loadData(true);
                }
            } catch (_e) {
                if (typeof window.loadData === 'function') await window.loadData(true);
            }
            showAlert(`${modelIds.length} modèle(s) enregistré(s).`, 'success');
            if (typeof window.renderImportStagingIndicator === 'function') {
                window.renderImportStagingIndicator(window.currentImportStaging);
            }
            if (typeof window.updateStats === 'function') window.updateStats();
            if (typeof window.renderImportWorkflow === 'function') window.renderImportWorkflow();
            if (typeof window.switchImportWorkflowStep === 'function') window.switchImportWorkflowStep('families-tri');
        } catch (error) {
            showAlert('Erreur validation modeles: ' + error.message, 'error');
        }
    }

    window.importModelRowDisplayValidated = importModelRowDisplayValidated;
    window.renderImportModelsStepHtml = renderImportModelsStepHtml;
    window.toggleImportModelSelection = toggleImportModelSelection;
    window.selectAllImportModelsVisible = selectAllImportModelsVisible;
    window.onImportModelStatusFilterChange = onImportModelStatusFilterChange;
    window.collectImportModelPriceUpdates = collectImportModelPriceUpdates;
    window.formatImportModelMoneyInput = formatImportModelMoneyInput;
    window.focusImportModelMoneyInput = focusImportModelMoneyInput;
    window.validateImportModelsStep = validateImportModelsStep;
})();
