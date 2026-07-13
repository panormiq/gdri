/**
 * FICHIER : modules/ugap/frontend/assets/js/configurateur/configurateur-link-bridge.js
 * RÔLE : Pont configurateur ↔ runtime liaisons (modal conflit, code couleur).
 */
(function initUgapConfiguratorLinkBridge(global) {
    'use strict';

    let runtime = null;
    let stateRef = null;
    let findOptionById = null;

    const STATUS_CLASS = {
        recommended: 'ugap-link--recommended',
        incompatible: 'ugap-link--incompatible',
        neutral: 'ugap-link--neutral',
        selected: 'ugap-link--selected',
    };

    function ensureModal() {
        if (document.getElementById('ugap-link-conflict-modal')) return;
        const wrap = document.createElement('div');
        wrap.id = 'ugap-link-conflict-modal';
        wrap.hidden = true;
        wrap.className = 'ugap-model-base-modal';
        wrap.innerHTML = `
            <div class="ugap-model-base-modal__panel card" style="width:min(560px,96vw);">
                <div class="ugap-model-base-modal__head">
                    <strong>Incompatibilité détectée</strong>
                    <button type="button" class="btn btn-outline" id="ugap-link-conflict-close">×</button>
                </div>
                <div style="padding:14px;">
                    <p id="ugap-link-conflict-message" class="ugap-param-lead" style="margin:0 0 12px;"></p>
                    <div id="ugap-link-conflict-alternatives"></div>
                    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                        <button type="button" class="btn btn-outline" id="ugap-link-conflict-cancel">Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-link-conflict-force">Sélectionner quand même</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrap);
        if (global.UgapEmbedLayout?.portalUgapModalToBody) {
            global.UgapEmbedLayout.portalUgapModalToBody(wrap);
        }
    }

    function showConflictModal(analysis) {
        ensureModal();
        const modal = document.getElementById('ugap-link-conflict-modal');
        const msg = document.getElementById('ugap-link-conflict-message');
        const alt = document.getElementById('ugap-link-conflict-alternatives');
        if (!modal || !msg || !alt) return Promise.resolve({ action: 'cancel' });

        msg.textContent = analysis.message || 'Cette option est incompatible avec la sélection actuelle.';
        const alternatives = Array.isArray(analysis.alternatives) ? analysis.alternatives : [];
        alt.innerHTML = alternatives.length
            ? `<p style="font-size:13px;margin:0 0 8px;"><strong>Alternatives :</strong></p>
                ${alternatives.map((item, index) => `
                    <button type="button" class="btn btn-outline ugap-link-alt-btn" data-alt-index="${index}"
                        style="display:block;width:100%;text-align:left;margin-bottom:6px;">
                        ${escapeHtml(item.label || item.optionId)}
                        ${item.message ? `<span style="display:block;font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(item.message)}</span>` : ''}
                    </button>
                `).join('')}`
            : '<p style="font-size:12px;color:#64748b;">Aucune alternative automatique — changez la sélection manuellement.</p>';

        modal.hidden = false;

        return new Promise((resolve) => {
            const cleanup = () => {
                modal.hidden = true;
                cancelBtn?.removeEventListener('click', onCancel);
                closeBtn?.removeEventListener('click', onCancel);
                forceBtn?.removeEventListener('click', onForce);
                alt.querySelectorAll('.ugap-link-alt-btn').forEach((btn) => {
                    btn.removeEventListener('click', onAlt);
                });
            };
            const onCancel = () => { cleanup(); resolve({ action: 'cancel' }); };
            const onForce = () => { cleanup(); resolve({ action: 'force' }); };
            const onAlt = (event) => {
                const btn = event.currentTarget;
                const index = Number(btn?.getAttribute('data-alt-index'));
                const pick = alternatives[index];
                cleanup();
                resolve({ action: 'alternative', alternative: pick });
            };
            const cancelBtn = document.getElementById('ugap-link-conflict-cancel');
            const closeBtn = document.getElementById('ugap-link-conflict-close');
            const forceBtn = document.getElementById('ugap-link-conflict-force');
            cancelBtn?.addEventListener('click', onCancel);
            closeBtn?.addEventListener('click', onCancel);
            forceBtn?.addEventListener('click', onForce);
            alt.querySelectorAll('.ugap-link-alt-btn').forEach((btn) => {
                btn.addEventListener('click', onAlt);
            });
        });
    }

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '');
    }

    function init(state, helpers) {
        stateRef = state;
        findOptionById = helpers?.findOptionById || null;
        const RT = global.UgapOptionLinkRuntime;
        if (!RT?.createRuntime || !state) {
            runtime = null;
            return;
        }
        runtime = RT.createRuntime({
            categories: state.categories,
            importBaseProducts: state.importBaseProducts,
            optionLinkRules: state.optionLinkRules,
            dependencyRules: state.dependencyRules,
            findOptionById: (id) => (findOptionById ? findOptionById(id) : null),
        });
    }

    function refreshVisuals() {
        if (!runtime || !stateRef) return;
        const selected = stateRef.selectedOptions;
        document.querySelectorAll('input[type="checkbox"][id]').forEach((cb) => {
            const oid = String(cb.id || '').trim();
            if (!oid || !runtime.optionById.has(oid)) return;
            const status = runtime.getVisualStatus(oid, selected);
            const row = cb.closest('tr') || cb.closest('.option-item') || cb.parentElement;
            Object.values(STATUS_CLASS).forEach((cls) => row?.classList.remove(cls));
            const cls = STATUS_CLASS[status] || STATUS_CLASS.neutral;
            row?.classList.add(cls);
            if (status === 'recommended') {
                cb.setAttribute('title', 'Recommandée pour la configuration actuelle');
            } else if (status === 'incompatible') {
                cb.setAttribute('title', 'Incompatible avec la sélection actuelle');
            } else {
                cb.removeAttribute('title');
            }
        });
    }

    async function handleSelectAttempt(optionId, proceedCallback) {
        if (!runtime || !stateRef) {
            proceedCallback();
            return;
        }
        const analysis = runtime.analyzeSelect(optionId, stateRef.selectedOptions);
        if (analysis.ok) {
            proceedCallback();
            afterSelection(optionId);
            refreshVisuals();
            return;
        }

        const decision = await showConflictModal(analysis);
        if (decision.action === 'cancel') return;

        if (decision.action === 'alternative' && decision.alternative?.optionId) {
            const altId = String(decision.alternative.optionId).trim();
            const kind = String(decision.alternative.kind || '').trim();
            analysis.conflicts.forEach((id) => {
                stateRef.selectedOptions.delete(id);
                stateRef.fivePercentOptions?.delete?.(id);
                const cb = document.getElementById(id);
                if (cb) cb.checked = false;
            });
            if (kind === 'sibling') {
                stateRef.selectedOptions.add(altId);
                const siblingCb = document.getElementById(altId);
                if (siblingCb) siblingCb.checked = true;
                const origCb = document.getElementById(optionId);
                if (origCb) origCb.checked = false;
                afterSelection(altId);
                refreshVisuals();
                return;
            }
            if (kind === 'require_parent' || kind === 'parent') {
                stateRef.selectedOptions.add(altId);
                const parentCb = document.getElementById(altId);
                if (parentCb) parentCb.checked = true;
                proceedCallback();
                afterSelection(optionId);
                refreshVisuals();
                return;
            }
        }

        if (decision.action === 'force' || decision.action === 'alternative') {
            analysis.conflicts.forEach((id) => {
                stateRef.selectedOptions.delete(id);
                stateRef.fivePercentOptions?.delete?.(id);
                const cb = document.getElementById(id);
                if (cb) cb.checked = false;
            });
            proceedCallback();
            afterSelection(optionId);
            refreshVisuals();
        }
    }

    function afterSelection(optionId) {
        if (!runtime || !stateRef) return;
        runtime.resolveIncompatibilities(stateRef.selectedOptions);
        runtime.applyAutoAdds(stateRef.selectedOptions);
        syncCheckboxesFromState();
        refreshVisuals();
    }

    function handleDeselect(optionId, proceedCallback) {
        proceedCallback();
        if (!runtime || !stateRef) return;
        runtime.reconcileDependents(optionId, stateRef.selectedOptions);
        syncCheckboxesFromState();
        refreshVisuals();
    }

    function syncCheckboxesFromState() {
        if (!stateRef) return;
        stateRef.selectedOptions.forEach((id) => {
            const cb = document.getElementById(id);
            if (cb && !cb.checked) cb.checked = true;
        });
    }

    global.UgapConfiguratorLinkBridge = {
        init,
        refreshVisuals,
        handleSelectAttempt,
        handleDeselect,
        afterSelection,
    };
})(typeof window !== 'undefined' ? window : globalThis);
