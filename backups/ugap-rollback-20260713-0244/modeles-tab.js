/**
 * Section Paramétrage > Modèles — template de base + parcours personnalisés.
 */
(function initUgapModelesTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-modeles-lc-mount';
    const EDITOR_MODAL_ID = 'ugap-modeles-editor-modal';
    const MBO = () => global.UgapModelBaseOptions;
    const CFG = () => global.UgapBateauBaseLcState;
    const PL = () => global.UgapParcoursLabels || {};

    const state = {
        editingModelId: '',
        editingConfigId: '',
        editMode: '', // 'preset' | 'preset_reorder' | 'diagnostic'
        createContext: null,
        searchQuery: '',
    };

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function fmtMoney(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
    }

    function getModels() {
        const data = MBO()?.getData?.();
        return Array.isArray(data?.models) ? data.models : [];
    }

    function getModelById(modelId) {
        const id = String(modelId || '').trim();
        return getModels().find((m) => String(m?.id || '').trim() === id) || null;
    }

    function formatCatalogModelLabel(model) {
        const m = model && typeof model === 'object' ? model : {};
        const name = String(m?.name || m?.label || '').trim();
        const pn = m?.posteNumber;
        const poste = pn != null && pn !== '' && Number.isFinite(Number(pn)) ? `P${pn}` : '';
        if (poste && name) return `${poste} — ${name}`;
        if (poste) return poste;
        if (name) return name;
        return String(m?.id || '').trim() || '—';
    }

    function compareCatalogModelsByPoste(a, b) {
        const na = Number(a?.posteNumber);
        const nb = Number(b?.posteNumber);
        const aOk = Number.isFinite(na);
        const bOk = Number.isFinite(nb);
        if (aOk && bOk && na !== nb) return na - nb;
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return formatCatalogModelLabel(a).localeCompare(formatCatalogModelLabel(b), 'fr', { sensitivity: 'base' });
    }

    function parseMoneyInput(raw) {
        const n = Number(String(raw ?? '').replace(',', '.').trim());
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    function getFilteredModels() {
        const q = String(state.searchQuery || '').trim().toLowerCase();
        let list = getModels().slice().sort(compareCatalogModelsByPoste);
        if (!q) return list;
        return list.filter((m) => {
            const hay = [
                m?.posteNumber,
                m?.name,
                m?.label,
                m?.motorizationBase,
                m?.motorization,
            ].map((x) => String(x || '').toLowerCase()).join(' ');
            return hay.includes(q);
        });
    }

    function resolveModelParcoursLabel(model) {
        const tpl = MBO()?.resolveBoatTemplateForModel?.(model);
        if (tpl) return String(tpl.label || tpl.id || '').trim() || '—';
        const templates = MBO()?.getTemplates?.() || [];
        if (!templates.length) return 'Aucun parcours';
        return '—';
    }

    function renderTemplateSelectHtml(model) {
        const mid = String(model?.id || '').trim();
        const templates = MBO()?.getTemplates?.() || [];
        const current = MBO()?.resolveBoatTemplateIdForModel?.(model, { userOnly: false }) || '';
        const ML = PL().modele || {};
        if (!templates.length) {
            return `<span class="ugap-modeles-card__parcours-value ugap-modeles-card__parcours-value--missing">${esc(ML.templateMissing || 'Aucun template de base.')}</span>`;
        }
        const options = [`<option value="">${esc(ML.templateSelectPlaceholder || '— Choisir un template de base —')}</option>`]
            .concat(templates.map((tpl) => {
                const id = String(tpl?.id || '').trim();
                const label = String(tpl?.label || id).trim();
                const sel = id === current ? ' selected' : '';
                return `<option value="${esc(id)}"${sel}>${esc(label)}</option>`;
            }));
        return `<select class="ugap-modeles-template-select" data-modeles-template="${esc(mid)}" title="Template de base du modèle">${options.join('')}</select>`;
    }

    function renderConfigurationsHtml(model) {
        const mid = String(model?.id || '').trim();
        const configs = CFG()?.getConfigurationsForModel?.(mid) || [];
        const PP = PL().parcoursPerso || {};
        if (!configs.length) {
            return `<p class="ugap-modeles-config-empty">${esc(PP.empty || 'Aucun parcours personnalisé.')}</p>`;
        }
        return configs.map((cfg) => {
            const st = MBO()?.getConfigurationStatus?.(model, cfg.id) || { filledCount: 0, totalSlots: 0 };
            const filled = Number(st.filledCount) || 0;
            const total = Number(st.totalSlots) || 0;
            const complete = total > 0 && filled >= total;
            return `
                <div class="ugap-modeles-config-row" data-config-id="${esc(cfg.id)}">
                    <div class="ugap-modeles-config-row__main">
                        <input type="text" class="ugap-modeles-config-name" data-model-id="${esc(mid)}" data-config-id="${esc(cfg.id)}"
                            value="${esc(cfg.label)}" title="Nom du parcours personnalisé">
                        <span class="ugap-modeles-config-status ${complete ? 'is-complete' : 'is-partial'}">
                            ${filled}/${total} option${total !== 1 ? 's' : ''}
                        </span>
                        ${cfg.isDefault ? '<span class="ugap-modeles-config-default-badge">Par défaut</span>' : ''}
                    </div>
                    <div class="ugap-modeles-config-row__actions">
                        <button type="button" class="btn btn-outline btn-sm" data-modeles-preset-reorder="${esc(mid)}" data-config-id="${esc(cfg.id)}">
                            ${esc(PP.reorder || 'Réordonner le parcours')}
                        </button>
                        <button type="button" class="btn btn-primary btn-sm" data-modeles-preset="${esc(mid)}" data-config-id="${esc(cfg.id)}">
                            ${esc(PP.pickOptions || 'Choisir les options')}
                        </button>
                        ${!cfg.isDefault ? `<button type="button" class="btn btn-outline btn-sm" data-modeles-set-default="${esc(mid)}" data-config-id="${esc(cfg.id)}">Défaut</button>` : ''}
                        <button type="button" class="btn btn-outline btn-sm ugap-modeles-config-delete" data-model-id="${esc(mid)}" data-config-id="${esc(cfg.id)}" title="Supprimer">×</button>
                    </div>
                </div>`;
        }).join('');
    }

    function renderModelCard(model) {
        const mid = String(model?.id || '').trim();
        const ML = PL().modele || {};
        const PP = PL().parcoursPerso || {};
        const baseStatus = MBO()?.getStatus?.(model) || { missingCount: 0, slots: [] };
        const missing = Number(baseStatus.missingCount) || 0;
        return `
            <article class="ugap-modeles-card card" data-model-id="${esc(mid)}">
                <header class="ugap-modeles-card__head">
                    <div class="ugap-modeles-card__title">
                        <span class="ugap-modeles-card__poste">${esc(model?.posteNumber != null ? `P${model.posteNumber}` : '—')}</span>
                        <h3>${esc(model?.name || model?.label || '—')}</h3>
                    </div>
                    <div class="ugap-modeles-card__meta">
                        <span>${esc(model?.motorizationBase || model?.motorization || '—')}</span>
                        <span>Client ${fmtMoney(model?.priceClient ?? model?.basePrice)}</span>
                        <span>UGAP ${fmtMoney(model?.priceUgap ?? model?.ugapPrice)}</span>
                    </div>
                </header>
                <div class="ugap-modeles-card__parcours">
                    <span class="ugap-modeles-card__label">${esc(ML.templateField || 'Template de base')}</span>
                    ${renderTemplateSelectHtml(model)}
                </div>
                <div class="ugap-modeles-card__configs">
                    <div class="ugap-modeles-card__configs-head">
                        <strong>${esc(PP.title || 'Parcours personnalisés')}</strong>
                        <button type="button" class="btn btn-outline btn-sm" data-modeles-add-config="${esc(mid)}">+ ${esc(PP.create || 'Ajouter')}</button>
                    </div>
                    <div class="ugap-modeles-config-list">${renderConfigurationsHtml(model)}</div>
                </div>
                <footer class="ugap-modeles-card__foot">
                    <button type="button" class="btn btn-outline btn-sm" data-modeles-diagnostic="${esc(mid)}">
                        Vérifier options de base${missing > 0 ? ` (${missing} manquante${missing > 1 ? 's' : ''})` : ''}
                    </button>
                </footer>
            </article>`;
    }

    function renderCardsShell() {
        const models = getFilteredModels();
        const count = models.length;
        const total = getModels().length;
        return `
            <div class="ugap-modeles-cards-shell" data-ugap-modeles-cards="1">
                <div class="ugap-modeles-cards-toolbar">
                    <div>
                        <h2 style="margin:0 0 4px;">Modèles</h2>
                        <p style="margin:0;font-size:13px;color:#64748b;">
                            Catalogue importé par poste. Choisissez un <strong>template de base</strong>, puis créez des <strong>parcours personnalisés</strong> (réordonnancement + options).
                        </p>
                    </div>
                    <input type="search" id="ugap-modeles-search" class="ugap-modeles-search" placeholder="Modèle, motorisation…"
                        value="${esc(state.searchQuery)}">
                </div>
                <p class="ugap-modeles-cards-count">${count} modèle${count !== 1 ? 's' : ''}${count !== total ? ` / ${total}` : ''}</p>
                ${count
                    ? `<div class="ugap-modeles-cards">${models.map(renderModelCard).join('')}</div>`
                    : `<p class="ugap-param-placeholder">${total ? 'Aucun modèle ne correspond à la recherche.' : 'Aucun modèle en base — validez un import d’abord.'}</p>`}
            </div>`;
    }

    function refreshCards() {
        const mount = global.document.getElementById(MOUNT_ID);
        if (!mount) return;
        const search = mount.querySelector('#ugap-modeles-search');
        const hadFocus = search && global.document.activeElement === search;
        const selStart = hadFocus ? search.selectionStart : null;
        const selEnd = hadFocus ? search.selectionEnd : null;
        mount.innerHTML = renderCardsShell();
        if (hadFocus) {
            const nextSearch = mount.querySelector('#ugap-modeles-search');
            if (nextSearch) {
                nextSearch.focus();
                if (selStart != null && selEnd != null) {
                    try { nextSearch.setSelectionRange(selStart, selEnd); } catch (_e) { /* ignore */ }
                }
            }
        }
    }

    function renderEditorBodyHtml(model) {
        const mid = String(model?.id || '').trim();
        const status = MBO()?.getStatus?.(model) || { slots: [], templateLabel: '' };
        if (!status.slots.length) {
            const tpl = MBO()?.resolveBoatTemplateForModel?.(model);
            const TB = PL().templateDeBase || {};
            if (!tpl) {
                return `<p class="ugap-param-placeholder">Aucun template de base — créez-en un dans <strong>${esc(TB.title || 'Templates de base')}</strong>.</p>`;
            }
            return `<p class="ugap-param-placeholder">Impossible d’afficher le parcours (rechargez la page). Si le problème persiste, ouvrez <strong>${esc(TB.title || 'Templates de base')}</strong> et cliquez sur <strong>Enregistrer</strong> une fois.</p>`;
        }
        return `<div id="ugap-modeles-parcours-mount" data-model-id="${esc(mid)}"></div>`;
    }

    function refreshEditorParcours() {
        const model = getModelById(state.editingModelId);
        if (!model) return;
        mountEditorParcours(model);
    }

    function mountEditorParcours(model) {
        const mount = global.document.getElementById('ugap-modeles-parcours-mount');
        if (!mount) return;
        const bridge = global.UgapParametrageParcoursBridge;
        const onChanged = () => {
            refreshCards();
            refreshEditorParcours();
        };
        const mid = String(model?.id || '').trim();
        if (state.editMode === 'preset_reorder' && state.editingConfigId) {
            MBO()?.setPresetEditContext?.(mid, state.editingConfigId);
            if (!bridge?.renderModelPresetReorderParcours) {
                mount.innerHTML = '<p class="ugap-param-placeholder">Éditeur parcours indisponible.</p>';
                return;
            }
            bridge.renderModelPresetReorderParcours(model, state.editingConfigId, mount, { onChanged });
            return;
        }
        if (state.editMode === 'preset' && state.editingConfigId) {
            MBO()?.setPresetEditContext?.(mid, state.editingConfigId);
            if (!bridge?.renderModelPresetParcours) {
                mount.innerHTML = '<p class="ugap-param-placeholder">Éditeur preset indisponible.</p>';
                return;
            }
            bridge.renderModelPresetParcours(model, state.editingConfigId, mount, { onChanged });
            return;
        }
        MBO()?.clearConfiguratorContext?.();
        if (!bridge?.renderModelBaseParcours) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Tableau parcours indisponible.</p>';
            return;
        }
        bridge.renderModelBaseParcours(model, mount, { onChanged });
    }

    function ensureEditorModal() {
        let modal = global.document.getElementById(EDITOR_MODAL_ID);
        if (modal) {
            if (!modal.querySelector('.ugap-modeles-editor-modal__foot')) {
                const panel = modal.querySelector('.ugap-modeles-editor-panel');
                if (panel) {
                    panel.insertAdjacentHTML('beforeend', `
                        <div class="ugap-modeles-editor-modal__foot">
                            <span class="ugap-modeles-editor-save-hint">Enregistrement automatique à chaque sélection.</span>
                            <div class="ugap-modeles-editor-modal__actions">
                                <button type="button" class="btn btn-outline" id="ugap-modeles-base-close">Fermer</button>
                                <button type="button" class="btn btn-primary" id="ugap-modeles-editor-save">Enregistrer et fermer</button>
                            </div>
                        </div>`);
                }
            }
            return modal;
        }
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${EDITOR_MODAL_ID}" hidden class="ugap-model-base-modal ugap-modeles-editor-modal"
                role="dialog" aria-modal="true" aria-labelledby="ugap-modeles-editor-title">
                <div class="ugap-model-base-modal__panel card ugap-modeles-editor-panel">
                    <div class="ugap-model-base-modal__head ugap-modeles-editor-modal__head">
                        <div id="ugap-modeles-editor-title-wrap"></div>
                    </div>
                    <div id="ugap-modeles-editor-hint" class="ugap-modeles-editor-modal__hint"></div>
                    <div id="ugap-modeles-editor-body" class="ugap-modeles-editor-modal__body"></div>
                    <div class="ugap-modeles-editor-modal__foot">
                        <span class="ugap-modeles-editor-save-hint">Enregistrement automatique à chaque sélection.</span>
                        <div class="ugap-modeles-editor-modal__actions">
                            <button type="button" class="btn btn-outline" id="ugap-modeles-base-close">Fermer</button>
                            <button type="button" class="btn btn-primary" id="ugap-modeles-editor-save">Enregistrer et fermer</button>
                        </div>
                    </div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
        return global.document.getElementById(EDITOR_MODAL_ID);
    }

    function openEditor(modelId, mode, configId) {
        const model = getModelById(modelId);
        if (!model) {
            closeEditor();
            return;
        }
        const modal = ensureEditorModal();
        const titleWrap = global.document.getElementById('ugap-modeles-editor-title-wrap');
        const hintEl = global.document.getElementById('ugap-modeles-editor-hint');
        const bodyEl = global.document.getElementById('ugap-modeles-editor-body');
        if (!titleWrap || !hintEl || !bodyEl) return;

        const mid = String(modelId || '').trim();
        state.editingModelId = mid;
        state.editMode = mode === 'preset_reorder'
            ? 'preset_reorder'
            : (mode === 'preset' ? 'preset' : 'diagnostic');
        state.editingConfigId = (state.editMode === 'preset' || state.editMode === 'preset_reorder')
            ? String(configId || '').trim()
            : '';

        const resolvedTemplateId = MBO()?.resolveBoatTemplateIdForModel?.(model, { userOnly: false }) || '';
        const cfg = state.editingConfigId
            ? CFG()?.getConfigurationById?.(mid, state.editingConfigId)
            : null;
        const PP = PL().parcoursPerso || {};
        const TB = PL().templateDeBase || {};
        let title = 'Diagnostic options de base';
        if (state.editMode === 'preset') {
            title = `${PP.singular ? PP.singular[0].toUpperCase() + PP.singular.slice(1) : 'Parcours'} « ${esc(cfg?.label || state.editingConfigId)} » — options`;
        } else if (state.editMode === 'preset_reorder') {
            title = `${PP.singular ? PP.singular[0].toUpperCase() + PP.singular.slice(1) : 'Parcours'} « ${esc(cfg?.label || state.editingConfigId)} » — ordre`;
        }

        let bodyHtml = '';
        if (!resolvedTemplateId) {
            bodyHtml = `<p class="ugap-param-placeholder">Aucun template de base — créez-en un dans <strong>${esc(TB.title || 'Templates de base')}</strong>.</p>`;
        } else {
            bodyHtml = renderEditorBodyHtml(model);
        }

        titleWrap.innerHTML = `
            <div>
                <h3 id="ugap-modeles-editor-title" style="margin:0 0 4px;">${title}</h3>
                <p style="margin:0;font-size:13px;color:#64748b;">
                    ${esc(model.name || mid)} · Poste ${esc(model.posteNumber ?? '—')} · ${esc(model.motorizationBase || '—')}
                </p>
            </div>`;
        hintEl.innerHTML = state.editMode === 'preset_reorder'
            ? esc(PP.reorderHint || 'Glissez pour réordonner — même liste que le template de base.')
            : (state.editMode === 'preset'
                ? esc(PP.pickHint || 'Cliquez sur une ligne pour choisir une option.')
                : 'Slots sans option de base détectée — diagnostic uniquement.');
        bodyEl.innerHTML = bodyHtml;

        modal.hidden = false;
        global.document.body.classList.add('ugap-modeles-editor-open');
        if (resolvedTemplateId) mountEditorParcours(model);
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
            requestAnimationFrame(() => global.scheduleParentEmbedResize());
        }
    }

    async function saveEditorAndClose() {
        try {
            if (state.editMode === 'preset' && state.editingConfigId) {
                const ok = await CFG()?.persistModelConfigurationsOnly?.();
                if (ok === false) return;
            } else if (state.editMode === 'preset_reorder' && state.editingConfigId) {
                const ok = await CFG()?.persistModelConfigurationsOnly?.();
                if (ok === false) return;
            } else if (CFG()?.persistModelBaseSlotPicksOnly) {
                await CFG().persistModelBaseSlotPicksOnly();
            }
            global.showAlert?.('Parcours enregistré.', 'success');
            refreshCards();
            closeEditor();
        } catch (err) {
            global.showAlert?.(err?.message || 'Erreur enregistrement', 'error');
        }
    }

    function closeEditor() {
        state.editingModelId = '';
        state.editingConfigId = '';
        state.editMode = '';
        global.UgapParametrageParcoursBridge?.clearConfiguratorBridge?.();
        MBO()?.clearConfiguratorContext?.();
        const modal = global.document.getElementById(EDITOR_MODAL_ID);
        const bodyEl = global.document.getElementById('ugap-modeles-editor-body');
        if (bodyEl) bodyEl.innerHTML = '';
        if (modal) modal.hidden = true;
        global.document.body.classList.remove('ugap-modeles-editor-open');
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    function promptConfigurationName(defaultName) {
        const PP = PL().parcoursPerso || {};
        const name = global.prompt(`Nom du ${PP.singular || 'parcours personnalisé'} :`, defaultName || 'UGAP');
        if (name == null) return null;
        const trimmed = String(name).trim();
        return trimmed || null;
    }

    function ensureCreateModal() {
        const existing = global.document.getElementById('ugap-model-base-create-modal');
        if (existing?.querySelector('#ugap-model-base-create-postes-list')) return;
        existing?.remove();
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-model-base-create-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card ugap-model-base-create-panel">
                    <div class="ugap-model-base-modal__head">
                        <strong>Créer une option de base</strong>
                        <button type="button" class="btn btn-outline" id="ugap-model-base-create-cancel">×</button>
                    </div>
                    <div style="padding:14px;">
                        <p id="ugap-model-base-create-hint" style="margin:0 0 12px;font-size:13px;color:#64748b;"></p>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Libellé</label>
                        <input id="ugap-model-base-create-name" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;">
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Détail (libellé Excel / complément, optionnel)</label>
                        <textarea id="ugap-model-base-create-details" rows="2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;resize:vertical;"></textarea>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Réf. UGAP (optionnel)</label>
                        <input id="ugap-model-base-create-ref" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;">
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-model-base-create-cancel2">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-model-base-create-submit">Créer et associer</button>
                        </div>
                    </div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
    }

    function openCreateModal(modelId, slotIdx) {
        ensureCreateModal();
        const model = getModelById(modelId);
        const status = MBO()?.getStatus?.(model) || { slots: [] };
        const slot = status.slots[Number(slotIdx)];
        if (!slot) return;
        const mid = String(modelId || '').trim();
        state.createContext = { modelId: mid, slotIdx: Number(slotIdx) };
        const modal = global.document.getElementById('ugap-model-base-create-modal');
        const hint = global.document.getElementById('ugap-model-base-create-hint');
        const nameEl = global.document.getElementById('ugap-model-base-create-name');
        const refEl = global.document.getElementById('ugap-model-base-create-ref');
        const detEl = global.document.getElementById('ugap-model-base-create-details');
        if (nameEl) nameEl.value = '';
        if (refEl) refEl.value = '';
        if (detEl) detEl.value = '';
        if (hint) {
            const nodeLabel = String(slot.catalogNodeLabel || slot.categoryName || slot.groupLabel || 'Nœud').trim();
            hint.innerHTML = `<strong>Nœud : ${esc(nodeLabel)}</strong>`;
        }
        if (modal) modal.hidden = false;
    }

    function closeCreateModal() {
        state.createContext = null;
        const modal = global.document.getElementById('ugap-model-base-create-modal');
        if (modal) modal.hidden = true;
    }

    async function submitCreateModal() {
        const ctx = state.createContext;
        if (!ctx) return;
        try {
            await MBO()?.createBaseOption?.(ctx.modelId, ctx.slotIdx, {
                name: global.document.getElementById('ugap-model-base-create-name')?.value,
                details: global.document.getElementById('ugap-model-base-create-details')?.value,
                refUgap: global.document.getElementById('ugap-model-base-create-ref')?.value,
                price: 0,
                compatibleModelIds: [ctx.modelId],
                pricingMode: 'fixed',
                pricesByModelId: { [ctx.modelId]: 0 },
            });
            closeCreateModal();
            openEditor(ctx.modelId, 'diagnostic');
            refreshCards();
            global.showAlert?.('Option créée et associée.', 'success');
        } catch (err) {
            global.showAlert?.(err?.message || 'Erreur création option', 'error');
        }
    }

    function bindListActions(mount) {
        if (!mount || mount.dataset.modelesBound === '1') return;
        mount.dataset.modelesBound = '1';

        mount.addEventListener('change', (ev) => {
            const sel = ev.target.closest('.ugap-modeles-template-select');
            if (!sel) return;
            const mid = String(sel.getAttribute('data-modeles-template') || '').trim();
            const tid = String(sel.value || '').trim();
            void (async () => {
                try {
                    await MBO()?.assignBoatTemplate?.(mid, tid);
                    refreshCards();
                    global.showAlert?.('Template de base associé.', 'success');
                } catch (err) {
                    global.showAlert?.(err?.message || 'Erreur association template', 'error');
                    refreshCards();
                }
            })();
        });

        mount.addEventListener('input', (ev) => {
            const search = ev.target.closest('#ugap-modeles-search');
            if (search) {
                state.searchQuery = search.value;
                refreshCards();
                return;
            }
            const input = ev.target.closest('.ugap-modeles-config-name');
            if (!input) return;
            const mid = String(input.getAttribute('data-model-id') || '').trim();
            const cid = String(input.getAttribute('data-config-id') || '').trim();
            if (!mid || !cid) return;
            if (input.dataset.renameTimer) clearTimeout(Number(input.dataset.renameTimer));
            input.dataset.renameTimer = String(setTimeout(() => {
                CFG()?.renameConfiguration?.(mid, cid, input.value);
            }, 400));
        });

        mount.addEventListener('click', (ev) => {
            const addBtn = ev.target.closest('[data-modeles-add-config]');
            if (addBtn) {
                const mid = String(addBtn.getAttribute('data-modeles-add-config') || '').trim();
                const name = promptConfigurationName('');
                if (!name) return;
                try {
                    const cfg = CFG()?.createConfiguration?.(mid, name);
                    refreshCards();
                    if (cfg?.id) openEditor(mid, 'preset', cfg.id);
                    global.showAlert?.('Parcours personnalisé créé.', 'success');
                } catch (err) {
                    global.showAlert?.(err?.message || 'Erreur création configuration', 'error');
                }
                return;
            }

            const reorderBtn = ev.target.closest('[data-modeles-preset-reorder]');
            if (reorderBtn) {
                void (async () => {
                    try {
                        await ensureLoaded();
                        openEditor(
                            String(reorderBtn.getAttribute('data-modeles-preset-reorder') || '').trim(),
                            'preset_reorder',
                            String(reorderBtn.getAttribute('data-config-id') || '').trim()
                        );
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur chargement', 'error');
                    }
                })();
                return;
            }

            const presetBtn = ev.target.closest('[data-modeles-preset]');
            if (presetBtn) {
                void (async () => {
                    try {
                        await ensureLoaded();
                        openEditor(
                            String(presetBtn.getAttribute('data-modeles-preset') || '').trim(),
                            'preset',
                            String(presetBtn.getAttribute('data-config-id') || '').trim()
                        );
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur chargement', 'error');
                    }
                })();
                return;
            }

            const diagBtn = ev.target.closest('[data-modeles-diagnostic]');
            if (diagBtn) {
                void (async () => {
                    try {
                        await ensureLoaded();
                        openEditor(String(diagBtn.getAttribute('data-modeles-diagnostic') || '').trim(), 'diagnostic');
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur chargement diagnostic', 'error');
                    }
                })();
                return;
            }

            const defaultBtn = ev.target.closest('[data-modeles-set-default]');
            if (defaultBtn) {
                CFG()?.setDefaultConfiguration?.(
                    String(defaultBtn.getAttribute('data-modeles-set-default') || '').trim(),
                    String(defaultBtn.getAttribute('data-config-id') || '').trim()
                );
                refreshCards();
                return;
            }

            const delBtn = ev.target.closest('.ugap-modeles-config-delete');
            if (delBtn) {
                const mid = String(delBtn.getAttribute('data-model-id') || '').trim();
                const cid = String(delBtn.getAttribute('data-config-id') || '').trim();
                if (!global.confirm('Supprimer ce parcours personnalisé ?')) return;
                CFG()?.deleteConfiguration?.(mid, cid);
                if (state.editingConfigId === cid) closeEditor();
                refreshCards();
            }
        });
    }

    function bindEditorEvents() {
        if (global.document.body.dataset.ugapModelesEditorBound === '1') return;
        global.document.body.dataset.ugapModelesEditorBound = '1';
        global.document.addEventListener('click', (ev) => {
            if (ev.target?.closest?.('#ugap-modeles-base-close')) {
                closeEditor();
                return;
            }
            if (ev.target?.closest?.('#ugap-modeles-editor-save')) {
                void saveEditorAndClose();
                return;
            }
            const modal = global.document.getElementById(EDITOR_MODAL_ID);
            if (modal && !modal.hidden && ev.target === modal) closeEditor();
        });
        global.document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            const modal = global.document.getElementById(EDITOR_MODAL_ID);
            if (modal && !modal.hidden) closeEditor();
        });
    }

    function bindModalEvents() {
        if (global.document.body.dataset.ugapModelBaseCreateBound === '1') return;
        global.document.body.dataset.ugapModelBaseCreateBound = '1';
        global.document.addEventListener('click', (ev) => {
            if (ev.target?.id === 'ugap-model-base-create-cancel'
                || ev.target?.id === 'ugap-model-base-create-cancel2') {
                closeCreateModal();
            }
            if (ev.target?.id === 'ugap-model-base-create-submit') {
                void submitCreateModal();
            }
            const modal = global.document.getElementById('ugap-model-base-create-modal');
            if (modal && ev.target === modal) closeCreateModal();
        });
    }

    async function ensureLoaded() {
        MBO()?.clearConfiguratorContext?.();
        await global.UgapCatalogueLcState?.loadFromServer?.();
        await global.UgapBateauBaseLcState?.loadFromServer?.();
        const payload = await global.UgapCatalogueLcState?.refreshOptionsFromServer?.();
        if (payload && typeof global.setUgapCurrentData === 'function' && typeof global.getUgapCurrentData === 'function') {
            const data = global.getUgapCurrentData();
            if (data && typeof data === 'object') {
                global.setUgapCurrentData({
                    ...data,
                    categories: Array.isArray(payload.categories) ? payload.categories : data.categories,
                    models: Array.isArray(payload.models) ? payload.models : data.models,
                });
                global.UgapCatalogueLcState?.syncOptionsIndexFromPayload?.(payload);
            }
        }
    }

    async function mountModelesSection() {
        const mountEl = global.document.getElementById(MOUNT_ID);
        if (!mountEl) return;

        try {
            await ensureLoaded();
        } catch (err) {
            mountEl.innerHTML = `<p class="ugap-param-placeholder">Erreur : ${esc(err?.message || err)}</p>`;
            return;
        }

        bindEditorEvents();
        bindModalEvents();
        bindListActions(mountEl);
        refreshCards();
        if (state.editingModelId) {
            openEditor(state.editingModelId, state.editMode, state.editingConfigId);
        }
    }

    global.UgapModelesTab = { mount: mountModelesSection, refresh: mountModelesSection };
    global.openUgapModelBaseCreateModal = openCreateModal;
})(window);
