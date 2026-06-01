/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-list.js
 * RÔLE : Liste des imports staging (zone tampon) — affichage, renommage, ouverture éditeur.
 * ENTRÉES : DOM `#import-list-*`, API `/api/ugap/imports/staging/*` via `window.apiCall`.
 * SORTIES : Tableau liste ; bascule liste/éditeur ; globals `currentImportStaging`, `importViewMode`.
 * DÉPEND DE : `window.apiCall`, `window.showAlert`, `window.escapeHtml` (ou `UgapShared`) ;
 *   `admin.php` : `publishImportWorkflowGlobals`, `syncImportGlobalsFromWindow`,
 *   `applyImportStagingToCurrentData`, `ensureImportTabVisible`, `switchImportWorkflowStep`,
 *   `renderImportStagingIndicator`, `renderImportWorkflow`, `resolveImportWorkflowResumeStep`, `importExcel`.
 * NE PAS : rendu des étapes workflow (modèles, minorations, etc.).
 * APPELÉ PAR : `admin.php` (`initUgapImportTab`), onglet Import.
 */
(function () {
    'use strict';

    const escapeHtml = (value) => {
        if (window.UgapShared?.escapeHtml) return window.UgapShared.escapeHtml(value);
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
        return String(value ?? '');
    };

    const apiCall = (endpoint, options) => {
        if (typeof window.apiCall !== 'function') {
            return Promise.reject(new Error('apiCall indisponible (charger admin ou ugap-api.js).'));
        }
        return window.apiCall(endpoint, options);
    };

    const showAlert = (message, type) => {
        if (typeof window.showAlert === 'function') {
            window.showAlert(message, type);
            return;
        }
        console.error('[import-list]', message);
    };

    /** État workflow partagé (défini aussi dans admin.php). */
    function workflowState() {
        return window.importWorkflowState || (window.importWorkflowState = {
            step: 'models',
            selectedModelIds: [],
            selectedBaseModelIds: [],
            modelStatusFilter: 'to_validate',
            posteFilter: '',
            optionTypeFilter: '',
            minoAutoSeeded: false,
            majorationAutoSeeded: false,
            validateAssignAllPostesToUnassigned: true
        });
    }

    function publishGlobals() {
        if (typeof window.publishImportWorkflowGlobals === 'function') {
            window.publishImportWorkflowGlobals();
            return;
        }
        window.importWorkflowState = workflowState();
        window.importViewMode = window.importViewMode || 'list';
    }

    function hideRecapDock() {
        if (typeof window.hideImportMinorationRecapDockInParent === 'function') {
            window.hideImportMinorationRecapDockInParent();
        }
    }

    /**
     * Libellé affiché pour une ligne staging (displayName ou nom fichier source).
     */
    function getStagingLabel(item) {
        if (!item || typeof item !== 'object') return 'Sans nom';
        const source = item.source && typeof item.source === 'object' ? item.source : {};
        const displayName = String(item.displayName || source.displayName || '').trim();
        if (displayName) return displayName;
        const fileName = String(item.sourceFileName || source.sourceFileName || item.label || '').trim();
        return fileName || 'Sans nom';
    }

    /**
     * Affiche la section liste ou la section éditeur workflow.
     */
    function setImportViewMode(mode) {
        const next = mode === 'editor' ? 'editor' : 'list';
        window.importViewMode = next;
        publishGlobals();
        const listSection = document.getElementById('import-list-section');
        const editorSection = document.getElementById('import-editor-section');
        if (listSection) listSection.style.display = next === 'list' ? 'block' : 'none';
        if (editorSection) editorSection.style.display = next === 'editor' ? 'block' : 'none';
        if (next !== 'editor') hideRecapDock();
        if (typeof window.syncImportActionsDock === 'function') window.syncImportActionsDock();
    }

    /**
     * Rend le tbody `#import-list-tbody` à partir des entrées staging.
     */
    function renderImportListTable(items) {
        const tbody = document.getElementById('import-list-tbody');
        if (!tbody) return;
        const rows = Array.isArray(items) ? items : [];
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:16px 12px; color:#6b7280;">Aucun import en zone tampon.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((row) => {
            const id = String(row._id || '').trim();
            const label = getStagingLabel(row);
            const status = String(row.status || 'draft').toLowerCase();
            const statusLabel = {
                draft: 'Brouillon',
                in_review: 'En cours',
                validated: 'Validé',
                published: 'Reprendre l\'importation'
            }[status] || status;
            const editLabel = status === 'published' ? 'Reprendre l\'importation' : 'Éditer';
            const importedAt = row.importedAt
                ? new Date(row.importedAt).toLocaleString('fr-FR')
                : '—';
            const validated = Number(row.validatedModelsCount || 0);
            const total = Number(row.modelsCount || 0);
            const progress = total > 0 ? `${validated}/${total} modèles` : '—';
            return `<tr>
                <td style="padding:10px 12px; border-bottom:1px solid #eef2f7;">
                    <input type="text" class="import-list-rename-input" data-import-id="${escapeHtml(id)}"
                        value="${escapeHtml(label)}" data-prev-value="${escapeHtml(label)}"
                        style="width:100%; max-width:420px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px;">
                </td>
                <td style="padding:10px 12px; border-bottom:1px solid #eef2f7;">${escapeHtml(statusLabel)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eef2f7;">${escapeHtml(importedAt)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eef2f7;">${escapeHtml(progress)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:right;">
                    <button type="button" class="btn btn-primary btn-import-edit" data-import-id="${escapeHtml(id)}">${escapeHtml(editLabel)}</button>
                </td>
            </tr>`;
        }).join('');
    }

    /**
     * GET `/imports/staging/list` — met à jour `window.importListCache` et le tableau.
     */
    async function loadImportList() {
        const tbody = document.getElementById('import-list-tbody');
        const statusEl = document.getElementById('import-list-status');
        if (!tbody) return;
        if (statusEl) statusEl.textContent = 'Chargement…';
        try {
            const result = await apiCall('/imports/staging/list');
            window.importListCache = Array.isArray(result?.data) ? result.data : [];
            renderImportListTable(window.importListCache);
            if (statusEl) {
                statusEl.textContent = window.importListCache.length
                    ? `${window.importListCache.length} import(s)`
                    : '';
            }
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding:16px 12px; color:#b91c1c;">Erreur: ${escapeHtml(error.message || 'chargement impossible')}</td></tr>`;
            if (statusEl) statusEl.textContent = '';
        }
    }

    /**
     * PATCH displayName sur un import staging.
     */
    async function saveImportDisplayName(importId, displayName) {
        await apiCall(`/imports/staging/${encodeURIComponent(importId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ displayName })
        });
    }

    /**
     * Si statut `published`, POST `/reopen` avant édition.
     */
    async function reopenImportIfPublished(importId) {
        const id = String(importId || '').trim();
        if (!id) return;
        const cached = (window.importListCache || []).find((row) => String(row._id || '') === id);
        const status = String(cached?.status || '').toLowerCase();
        if (status === 'published') {
            await apiCall(`/imports/staging/${encodeURIComponent(id)}/reopen`, { method: 'POST' });
            if (cached) cached.status = 'validated';
        }
    }

    /**
     * Charge un staging, passe en mode éditeur, reprend l’étape workflow adaptée.
     */
    async function openImportEditor(importId, options) {
        const id = String(importId || '').trim();
        if (!id) return;
        const opts = options && typeof options === 'object' ? options : {};
        window.currentImportId = id;
        publishGlobals();
        try {
            await reopenImportIfPublished(id);
            const result = await apiCall(`/imports/staging?importId=${encodeURIComponent(id)}`);
            if (!result?.data) {
                showAlert('Import introuvable.', 'warning');
                return;
            }
            window.currentImportStaging = result.data;
            window.currentImportId = String(result.data._id || id);
            if (typeof window.syncImportGlobalsFromWindow === 'function') {
                window.syncImportGlobalsFromWindow();
            }
            publishGlobals();
            if (typeof window.applyImportStagingToCurrentData === 'function') {
                window.applyImportStagingToCurrentData();
            }
            const titleEl = document.getElementById('import-editor-title');
            if (titleEl) titleEl.textContent = getStagingLabel(result.data);
            if (typeof window.ensureImportTabVisible === 'function') {
                window.ensureImportTabVisible();
            }
            setImportViewMode('editor');
            document.getElementById('import-editor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (typeof window.workspaceMode !== 'undefined') window.workspaceMode = 'import';
            const resumeStep = opts.resume !== false && typeof window.resolveImportWorkflowResumeStep === 'function'
                ? window.resolveImportWorkflowResumeStep(window.currentImportStaging)
                : 'models';
            const wf = workflowState();
            wf.minoAutoSeeded = false;
            wf.majorationAutoSeeded = false;
            if (typeof window.switchImportWorkflowStep === 'function') {
                window.switchImportWorkflowStep(resumeStep);
            }
            if (typeof window.renderImportStagingIndicator === 'function') {
                window.renderImportStagingIndicator(window.currentImportStaging);
            }
            if (typeof window.renderImportWorkflow === 'function') {
                window.renderImportWorkflow();
            }
            if (typeof window.scheduleParentEmbedResize === 'function') {
                window.scheduleParentEmbedResize();
            }
        } catch (error) {
            showAlert('Erreur ouverture import: ' + error.message, 'error');
        }
    }

    /**
     * Retour liste : reset staging courant et recharge la liste.
     */
    function closeImportEditor() {
        setImportViewMode('list');
        if (typeof window.workspaceMode !== 'undefined') window.workspaceMode = 'backoffice';
        window.currentImportId = '';
        window.currentImportStaging = null;
        publishGlobals();
        hideRecapDock();
        loadImportList();
    }

    function bindImportListEvents() {
        if (!window.__ugapImportListClickBound) {
            window.__ugapImportListClickBound = true;
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-import-edit');
                if (!btn || !btn.closest('#import-list-tbody')) return;
                e.preventDefault();
                const importId = btn.getAttribute('data-import-id');
                Promise.resolve(openImportEditor(importId, { resume: true })).catch((err) => {
                    console.error('openImportEditor', err);
                    showAlert('Erreur ouverture import: ' + (err?.message || 'inconnue'), 'error');
                });
            });
        }

        if (window.__ugapImportListEventsBound) return;
        window.__ugapImportListEventsBound = true;

        document.getElementById('import-list-tbody')?.addEventListener('change', async (e) => {
            const input = e.target.closest('.import-list-rename-input');
            if (!input) return;
            const importId = input.getAttribute('data-import-id');
            const prev = String(input.dataset.prevValue || input.value || '').trim();
            const next = String(input.value || '').trim();
            if (!next || next === prev) return;
            try {
                await saveImportDisplayName(importId, next);
                input.dataset.prevValue = next;
                showAlert('Nom mis à jour.', 'success');
            } catch (error) {
                input.value = prev;
                showAlert('Erreur renommage: ' + error.message, 'error');
            }
        });

        document.getElementById('import-list-tbody')?.addEventListener('focusin', (e) => {
            const input = e.target.closest('.import-list-rename-input');
            if (input) input.dataset.prevValue = String(input.value || '').trim();
        }, true);

        document.getElementById('btn-import-back-list')?.addEventListener('click', closeImportEditor);

        document.getElementById('btn-import-new')?.addEventListener('click', () => {
            if (typeof window.ensureImportTabVisible === 'function') window.ensureImportTabVisible();
            setImportViewMode('editor');
            if (typeof window.importExcel === 'function') {
                window.importExcel();
                return;
            }
            showAlert('Import Excel : utilisez le bouton « Importer depuis Excel ».', 'info');
        });
    }

    function activateImportTab() {
        const tab = document.querySelector('.tab[data-tab="import"]');
        const panel = document.getElementById('tab-import');
        if (!tab || !panel) return;
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        panel.classList.add('active');
        if (typeof window.onEmbeddedTabActivated === 'function') {
            window.onEmbeddedTabActivated();
        } else if (typeof window.scheduleParentEmbedResize === 'function') {
            window.scheduleParentEmbedResize();
        }
    }

    /**
     * Init onglet Import : events + première charge liste.
     */
    function initImportTab() {
        if (window.__ugapImportTabInitialized) return;
        window.__ugapImportTabInitialized = true;
        window.importViewMode = window.importViewMode || 'list';
        window.importListCache = window.importListCache || [];
        publishGlobals();
        bindImportListEvents();
        setImportViewMode('list');
        if (typeof window.ensureImportTabVisible === 'function') {
            window.ensureImportTabVisible();
        } else {
            activateImportTab();
        }
        loadImportList();
    }

    window.loadImportList = loadImportList;
    window.openImportEditor = openImportEditor;
    window.closeImportEditor = closeImportEditor;
    window.setImportViewMode = setImportViewMode;
    window.initUgapImportTab = initImportTab;
    window.getImportStagingLabel = getStagingLabel;
})();
