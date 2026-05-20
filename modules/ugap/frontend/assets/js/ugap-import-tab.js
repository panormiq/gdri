/**
 * Liste / éditeur import Excel (onglet Import dans admin.php).
 */
(function () {
    'use strict';

    function escapeHtml(value) {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(value);
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function apiCall(endpoint, options) {
        if (typeof window.apiCall !== 'function') {
            return Promise.reject(new Error('apiCall non disponible (script admin non chargé).'));
        }
        return window.apiCall(endpoint, options);
    }

    function showAlert(message, type) {
        if (typeof window.showAlert === 'function') {
            window.showAlert(message, type);
            return;
        }
        console.error('[import-tab]', message);
    }

    function wf() {
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
        window.currentImportStaging = window.currentImportStaging;
        window.importWorkflowState = wf();
        window.importViewMode = window.importViewMode || 'list';
    }

    function hideRecapDock() {
        if (typeof window.hideImportMinorationRecapDockInParent === 'function') {
            window.hideImportMinorationRecapDockInParent();
        }
    }

    function getStagingLabel(item) {
        if (!item || typeof item !== 'object') return 'Sans nom';
        const source = item.source && typeof item.source === 'object' ? item.source : {};
        const displayName = String(item.displayName || source.displayName || '').trim();
        if (displayName) return displayName;
        const fileName = String(item.sourceFileName || source.sourceFileName || item.label || '').trim();
        return fileName || 'Sans nom';
    }

    function setImportViewMode(mode) {
        const next = mode === 'editor' ? 'editor' : 'list';
        window.importViewMode = next;
        publishGlobals();
        const listSection = document.getElementById('import-list-section');
        const editorSection = document.getElementById('import-editor-section');
        if (listSection) listSection.style.display = window.importViewMode === 'list' ? 'block' : 'none';
        if (editorSection) editorSection.style.display = window.importViewMode === 'editor' ? 'block' : 'none';
        if (window.importViewMode !== 'editor') hideRecapDock();
        if (typeof window.syncImportActionsDock === 'function') window.syncImportActionsDock();
    }

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
            const encodedId = encodeURIComponent(id);
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

    async function saveImportDisplayName(importId, displayName) {
        await apiCall(`/imports/staging/${encodeURIComponent(importId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ displayName })
        });
    }

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
            if (typeof applyImportStagingToCurrentData === 'function') {
                applyImportStagingToCurrentData();
            }
            const titleEl = document.getElementById('import-editor-title');
            if (titleEl) titleEl.textContent = getStagingLabel(result.data);
            if (typeof window.ensureImportTabVisible === 'function') {
                window.ensureImportTabVisible();
            }
            setImportViewMode('editor');
            document.getElementById('import-editor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (typeof window.workspaceMode !== 'undefined') window.workspaceMode = 'import';
            const resumeStep = opts.resume !== false && typeof resolveImportWorkflowResumeStep === 'function'
                ? resolveImportWorkflowResumeStep(window.currentImportStaging)
                : 'models';
            wf().minoAutoSeeded = false;
            wf().majorationAutoSeeded = false;
            if (typeof switchImportWorkflowStep === 'function') switchImportWorkflowStep(resumeStep);
            if (typeof renderImportStagingIndicator === 'function') {
                renderImportStagingIndicator(window.currentImportStaging);
            }
            if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
            if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        } catch (error) {
            showAlert('Erreur ouverture import: ' + error.message, 'error');
        }
    }

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
                    if (typeof showAlert === 'function') {
                        showAlert('Erreur ouverture import: ' + (err?.message || 'inconnue'), 'error');
                    }
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
            if (typeof importExcel === 'function') {
                importExcel();
                return;
            }
            showAlert('Import Excel : utilisez le bouton dans l’éditeur.', 'info');
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
        if (typeof scheduleParentEmbedResize === 'function') {
            scheduleParentEmbedResize();
            setTimeout(scheduleParentEmbedResize, 80);
            setTimeout(scheduleParentEmbedResize, 350);
        }
    }

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
