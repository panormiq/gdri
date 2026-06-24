/**
 * FICHIER : parametrage/assets/js/import/valider-tab.js
 * ROLE : Rebranche l'onglet "Valider" dans Parametrage > Importation.
 * ENTREES : API /imports/staging, /apply-assignments, /validate-options, /publish.
 * SORTIES : panneau de validation + actions de publication.
 */
(function bindParamImportValider(global) {
    'use strict';

    const state = {
        loading: false,
        staging: null,
        assignAllPostes: false,
    };

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function apiCall(endpoint, options) {
        if (typeof global.apiCall !== 'function') {
            throw new Error('apiCall indisponible.');
        }
        return global.apiCall(endpoint, options);
    }

    function host() {
        return document.getElementById('ugap-import-valider-mount');
    }

    function getDisplayName(staging) {
        const source = staging && typeof staging.source === 'object' ? staging.source : {};
        return String(staging?.displayName || source?.displayName || source?.sourceFileName || 'Sans nom');
    }

    function render() {
        const el = host();
        if (!el) return;

        if (state.loading && !state.staging) {
            el.innerHTML = '<p style="margin:0;color:#64748b;">Chargement du staging import…</p>';
            return;
        }

        const staging = state.staging;
        if (!staging) {
            el.innerHTML = `
                <div style="color:#64748b;">
                    <p style="margin:0 0 8px;">Aucun staging import trouvé.</p>
                    <button type="button" class="btn btn-outline" id="ugap-valider-refresh">Rafraîchir</button>
                </div>
            `;
            return;
        }

        const models = Array.isArray(staging.models) ? staging.models : [];
        const validated = Array.isArray(staging?.progress?.validatedModelIds) ? staging.progress.validatedModelIds : [];
        const allOptions = Array.isArray(staging.importOptions) && staging.importOptions.length
            ? staging.importOptions
            : (Array.isArray(staging.categories) ? staging.categories : []).flatMap((cat) => (
                Array.isArray(cat?.options) ? cat.options : []
            ));
        const prCount = allOptions.filter((opt) => /^PR\s/i.test(String(opt?.name || ''))).length;
        const status = String(staging.status || 'draft');
        const importedAt = staging?.source?.importedAt
            ? new Date(staging.source.importedAt).toLocaleString('fr-FR')
            : '—';

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                <div>
                    <div style="font-weight:600;color:#111827;">${escapeHtml(getDisplayName(staging))}</div>
                    <div style="font-size:12px;color:#6b7280;">Statut: ${escapeHtml(status)} - Importé le ${escapeHtml(importedAt)}</div>
                </div>
                <button type="button" class="btn btn-outline" id="ugap-valider-refresh">Rafraîchir</button>
            </div>
            <div style="font-size:13px;color:#374151;margin-bottom:12px;">
                Modèles validés: <strong>${validated.length}/${models.length}</strong>
                - PR détectées: <strong>${prCount}</strong>
            </div>
            <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px;font-size:13px;color:#374151;cursor:pointer;">
                <input type="checkbox" id="ugap-valider-assign-all" ${state.assignAllPostes ? 'checked' : ''} style="margin-top:2px;">
                <span>Assigner tous les postes aux options catalogue sans poste (pas les mino/majo)</span>
            </label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button type="button" class="btn btn-outline" id="ugap-valider-options-btn">Sauvegarder brouillon</button>
                <button type="button" class="btn btn-success" id="ugap-valider-publish-btn">Publier dans le catalogue</button>
            </div>
            <div style="margin-top:10px;color:#64748b;font-size:12px;line-height:1.4;">
                Publication : toutes les lignes <strong>importOptions</strong> (catalogue, mino, majo, PR).
                Les <code>opt_ibp_*</code> viennent seulement de <strong>importBaseProducts</strong> (moteurs de base / saisie étape 4) — pas une copie des mino/majo.
                Prérequis staging : <code>POST /import</code> (pas seulement Détection).
            </div>
        `;
    }

    function setLoading(next) {
        state.loading = !!next;
        const el = host();
        if (!el) return;
        el.style.opacity = state.loading ? '0.7' : '1';
        el.style.pointerEvents = state.loading ? 'none' : 'auto';
    }

    async function refreshStaging() {
        setLoading(true);
        try {
            const res = await apiCall('/imports/staging');
            state.staging = res?.data || null;
            if (state.staging?._id) {
                global.currentImportStaging = state.staging;
                global.currentImportId = String(state.staging._id);
            }
            render();
        } catch (err) {
            if (typeof global.showAlert === 'function') {
                global.showAlert(err?.message || 'Erreur chargement staging import.', 'error');
            }
        } finally {
            setLoading(false);
        }
    }

    async function applyAssignmentsIfNeeded(importId) {
        if (!state.assignAllPostes) return;
        const assigned = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/apply-assignments`, {
            method: 'POST'
        });
        state.staging = assigned?.data || state.staging;
    }

    async function validateOptions() {
        const importId = String(state.staging?._id || '').trim();
        if (!importId) {
            if (typeof global.showAlert === 'function') {
                global.showAlert('Aucun import staging actif.', 'warning');
            }
            return;
        }
        setLoading(true);
        try {
            await applyAssignmentsIfNeeded(importId);
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/validate-options`, {
                method: 'POST'
            });
            state.staging = result?.data || state.staging;
            global.currentImportStaging = state.staging;
            global.currentImportId = String(state.staging?._id || importId);
            render();
            if (typeof global.showAlert === 'function') {
                global.showAlert('Brouillon sauvegardé.', 'success');
            }
        } catch (err) {
            if (typeof global.showAlert === 'function') {
                global.showAlert(err?.message || 'Erreur validation options.', 'error');
            }
        } finally {
            setLoading(false);
        }
    }

    async function publishImport() {
        const importId = String(state.staging?._id || '').trim();
        if (!importId) {
            if (typeof global.showAlert === 'function') {
                global.showAlert('Aucun import staging actif.', 'warning');
            }
            return;
        }
        setLoading(true);
        try {
            await applyAssignmentsIfNeeded(importId);
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/publish`, {
                method: 'POST'
            });
            state.staging = result?.data || state.staging;
            global.currentImportStaging = state.staging;
            global.currentImportId = String(state.staging?._id || importId);
            render();
            if (typeof global.showAlert === 'function') {
                global.showAlert('Import publié dans le catalogue.', 'success');
            }
        } catch (err) {
            if (typeof global.showAlert === 'function') {
                global.showAlert(err?.message || 'Erreur publication import.', 'error');
            }
        } finally {
            setLoading(false);
        }
    }

    function bindEvents() {
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.id === 'ugap-valider-refresh') {
                refreshStaging();
            } else if (target.id === 'ugap-valider-options-btn') {
                validateOptions();
            } else if (target.id === 'ugap-valider-publish-btn') {
                publishImport();
            }
        });

        document.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (target.id === 'ugap-valider-assign-all') {
                state.assignAllPostes = !!target.checked;
            }
        });
    }

    function onReady() {
        if (!host()) return;
        bindEvents();
        refreshStaging();
    }

    global.UgapImportValiderTab = {
        refreshStaging,
        validateOptions,
        publishImport
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})(window);
