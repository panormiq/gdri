/**
 * Section Paramétrage > Modèles (vue LC + options de base).
 */
(function initUgapModelesTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-modeles-lc-mount';
    const EDITOR_ID = 'ugap-modeles-base-editor';
    const MBO = () => global.UgapModelBaseOptions;

    const state = {
        editingModelId: '',
        createContext: null,
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

    function getRows() {
        return getModels().map((model, idx) => {
            const modelId = String(model?.id || '').trim();
            const templateId = String(model?.boatTemplateId || '').trim();
            return {
                __idx: idx,
                _modelId: modelId,
                poste: model?.posteNumber != null ? String(model.posteNumber) : '—',
                name: String(model?.name || model?.label || '—').trim() || '—',
                motorization: String(model?.motorizationBase || model?.motorization || '—').trim() || '—',
                priceClient: fmtMoney(model?.priceClient ?? model?.basePrice),
                priceUgap: fmtMoney(model?.priceUgap ?? model?.ugapPrice),
                templateSelect: templateSelectHtml(modelId, templateId),
                _actionsHtml: `
                    <button type="button" class="btn btn-primary" style="font-size:12px;padding:4px 10px;"
                        data-modeles-base="${esc(modelId)}">Définir options de base</button>
                `,
            };
        });
    }

    function templateSelectHtml(modelId, selectedId) {
        const mid = esc(modelId);
        const selected = String(selectedId || '').trim();
        const templates = MBO()?.getTemplates?.() || [];
        const opts = templates.map((tpl) => {
            const id = String(tpl?.id || '').trim();
            const label = String(tpl?.label || id).trim();
            return `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`;
        }).join('');
        return `<select class="ugap-modeles-template-select" data-model-id="${mid}" style="width:100%;max-width:240px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
            <option value="">— Choisir un bateau de base —</option>${opts}
        </select>`;
    }

    function templateOptionsHtml(selectedId) {
        const selected = String(selectedId || '').trim();
        const templates = MBO()?.getTemplates?.() || [];
        const opts = templates.map((tpl) => {
            const id = String(tpl?.id || '').trim();
            const label = String(tpl?.label || id).trim();
            return `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`;
        }).join('');
        return `<option value="">— Choisir un bateau de base —</option>${opts}`;
    }

    function renderBaseEditor(modelId) {
        const root = global.document.getElementById(EDITOR_ID);
        if (!root) return;
        const model = getModelById(modelId);
        if (!model) {
            root.hidden = true;
            return;
        }
        const mid = String(modelId || '').trim();
        const status = MBO()?.getStatus?.(model) || { slots: [], templateLabel: '' };
        const templateId = String(model?.boatTemplateId || '').trim();
        const byFamily = MBO()?.groupSlotsByFamily?.(status.slots) || new Map();

        let bodyHtml = '';
        if (!templateId) {
            bodyHtml = `<p class="ugap-param-placeholder">Choisissez un bateau de base pour afficher catégories et groupes.</p>`;
        } else if (!status.slots.length) {
            bodyHtml = `<p class="ugap-param-placeholder">Ce bateau de base ne contient aucun groupe.</p>`;
        } else {
            bodyHtml = Array.from(byFamily.entries()).map(([familyLabel, slots]) => {
                const groupsHtml = slots.map((slot) => {
                    const slotIdx = slot.__idx;
                    const assigned = MBO()?.getAssignedOptionId?.(mid, slot) || '';
                    const choices = MBO()?.getChoiceRows?.(model, slot) || [];
                    const opts = choices.map((row) => {
                        const sel = assigned === row.id ? ' selected' : '';
                        const ref = row.refUgap ? ` — ${row.refUgap}` : '';
                        return `<option value="${esc(row.id)}"${sel}>${esc(row.name)}${esc(ref)}</option>`;
                    }).join('');
                    return `
                        <div class="ugap-model-base-slot">
                            <div class="ugap-model-base-slot__title">${esc(slot.groupLabel || slot.groupId)}</div>
                            <div class="ugap-model-base-slot__row">
                                <select class="ugap-model-base-pick" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}">
                                    <option value="">— Choisir une option —</option>
                                    ${opts}
                                </select>
                                <button type="button" class="btn btn-outline ugap-model-base-add" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" title="Créer une option de base">+</button>
                            </div>
                        </div>`;
                }).join('');
                return `
                    <section class="ugap-model-base-family">
                        <h4>${esc(familyLabel)}</h4>
                        ${groupsHtml}
                    </section>`;
            }).join('');
        }

        root.innerHTML = `
            <div class="ugap-model-base-editor card">
                <div class="ugap-model-base-editor__head">
                    <div>
                        <h3 style="margin:0 0 4px;">Options de base — ${esc(model.name || mid)}</h3>
                        <p style="margin:0;font-size:13px;color:#64748b;">Poste ${esc(model.posteNumber ?? '—')} · ${esc(model.motorizationBase || '—')}</p>
                    </div>
                    <button type="button" class="btn btn-outline" id="ugap-modeles-base-close">Fermer</button>
                </div>
                <label style="display:block;margin:12px 0 8px;font-size:12px;color:#64748b;">Bateau de base</label>
                <select id="ugap-modeles-base-template" style="width:100%;max-width:420px;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    ${templateOptionsHtml(templateId)}
                </select>
                ${templateId ? `<p style="margin:10px 0 0;font-size:13px;color:#1e40af;">Template « ${esc(status.templateLabel || templateId)} » — choisissez l’option importée pour chaque groupe.</p>` : ''}
                <div class="ugap-model-base-editor__body">${bodyHtml}</div>
            </div>
        `;
        root.hidden = false;
        root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeBaseEditor() {
        state.editingModelId = '';
        const root = global.document.getElementById(EDITOR_ID);
        if (root) {
            root.hidden = true;
            root.innerHTML = '';
        }
    }

    function ensureCreateModal() {
        if (global.document.getElementById('ugap-model-base-create-modal')) return;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-model-base-create-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card">
                    <div class="ugap-model-base-modal__head">
                        <strong>Créer une option de base</strong>
                        <button type="button" class="btn btn-outline" id="ugap-model-base-create-cancel">×</button>
                    </div>
                    <div style="padding:14px;">
                        <p id="ugap-model-base-create-hint" style="margin:0 0 12px;font-size:13px;color:#64748b;"></p>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Libellé</label>
                        <input id="ugap-model-base-create-name" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;">
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Réf. UGAP (optionnel)</label>
                        <input id="ugap-model-base-create-ref" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;">
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Prix inclus (€)</label>
                        <input id="ugap-model-base-create-price" type="number" step="0.01" min="0" value="0" style="width:160px;padding:8px;border:1px solid #ddd;border-radius:6px;">
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
        state.createContext = { modelId: String(modelId), slotIdx: Number(slotIdx) };
        const modal = global.document.getElementById('ugap-model-base-create-modal');
        const hint = global.document.getElementById('ugap-model-base-create-hint');
        if (hint) {
            hint.textContent = `Groupe : ${slot.groupLabel || slot.groupId}${slot.categoryName ? ` (${slot.categoryName})` : ''}`;
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
                refUgap: global.document.getElementById('ugap-model-base-create-ref')?.value,
                price: global.document.getElementById('ugap-model-base-create-price')?.value,
            });
            closeCreateModal();
            renderBaseEditor(ctx.modelId);
            refreshList();
            global.showAlert?.('Option créée et associée.', 'success');
        } catch (err) {
            global.showAlert?.(err?.message || 'Erreur création option', 'error');
        }
    }

    function refreshList() {
        const mount = global.document.getElementById(MOUNT_ID);
        if (mount && global.UgapTemplates?.refreshVueLCList) {
            global.UgapTemplates.refreshVueLCList('modeles', mount);
        }
    }

    function bindListActions(mount) {
        if (!mount || mount.dataset.modelesBound === '1') return;
        mount.dataset.modelesBound = '1';
        mount.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-modeles-base]');
            if (!btn) return;
            ev.stopPropagation();
            state.editingModelId = String(btn.getAttribute('data-modeles-base') || '').trim();
            renderBaseEditor(state.editingModelId);
        });
        mount.addEventListener('change', (ev) => {
            const sel = ev.target.closest('.ugap-modeles-template-select');
            if (!sel) return;
            ev.stopPropagation();
            const modelId = String(sel.getAttribute('data-model-id') || '').trim();
            void (async () => {
                try {
                    await MBO()?.assignBoatTemplate?.(modelId, sel.value);
                    refreshList();
                    if (state.editingModelId === modelId) renderBaseEditor(modelId);
                    global.showAlert?.('Bateau de base assigné.', 'success');
                } catch (err) {
                    global.showAlert?.(err?.message || 'Erreur assignation template', 'error');
                    refreshList();
                }
            })();
        });
    }

    function bindEditorEvents() {
        const root = global.document.getElementById(EDITOR_ID);
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        root.addEventListener('click', (ev) => {
            if (ev.target.closest('#ugap-modeles-base-close')) {
                closeBaseEditor();
                return;
            }
            const addBtn = ev.target.closest('.ugap-model-base-add');
            if (addBtn) {
                openCreateModal(addBtn.getAttribute('data-model-id'), addBtn.getAttribute('data-slot-idx'));
            }
        });
        root.addEventListener('change', (ev) => {
            const sel = ev.target;
            if (sel?.id === 'ugap-modeles-base-template') {
                void (async () => {
                    if (!state.editingModelId) return;
                    try {
                        await MBO()?.assignBoatTemplate?.(state.editingModelId, sel.value);
                        renderBaseEditor(state.editingModelId);
                        refreshList();
                        global.showAlert?.('Bateau de base assigné.', 'success');
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur assignation template', 'error');
                    }
                })();
                return;
            }
            if (sel?.matches?.('.ugap-model-base-pick')) {
                const modelId = sel.getAttribute('data-model-id');
                const slotIdx = sel.getAttribute('data-slot-idx');
                const optionId = sel.value;
                if (!optionId) return;
                void (async () => {
                    try {
                        await MBO()?.pickBaseOption?.(modelId, slotIdx, optionId);
                        renderBaseEditor(modelId);
                        refreshList();
                        global.showAlert?.('Option de base associée.', 'success');
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur association', 'error');
                        renderBaseEditor(modelId);
                    }
                })();
            }
        });
    }

    function bindModalEvents() {
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
        global.UgapModelBaseOptions?.clearConfiguratorContext?.();
        await global.UgapFamilleLcState?.loadFromServer?.();
        await global.UgapBateauBaseLcState?.loadFromServer?.();
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

        if (mountEl.querySelector('[data-ugap-vue-lc="modeles"]')) {
            refreshList();
            if (state.editingModelId) renderBaseEditor(state.editingModelId);
            return;
        }

        if (!global.UgapTemplates?.renderVueLC) {
            mountEl.innerHTML = '<p class="ugap-param-placeholder">Module d’affichage indisponible.</p>';
            return;
        }

        const config = {
            elementKey: 'modeles',
            elementLabel: 'modèle',
            title: 'Modèles',
            description: 'Catalogue importé par poste. Assignez un bateau de base et définissez les options incluses par groupe.',
            hideCreateButton: true,
            columns: [
                { key: 'poste', label: 'Poste' },
                { key: 'name', label: 'Modèle' },
                { key: 'motorization', label: 'Motorisation' },
                { key: 'priceClient', label: 'Prix client', type: 'html' },
                { key: 'priceUgap', label: 'Prix UGAP', type: 'html' },
                { key: 'templateSelect', label: 'Bateau de base', type: 'html' },
                { key: '_actionsHtml', label: 'Actions', type: 'html' },
            ],
            getRows,
            listToolbar: {
                sortKey: 'poste',
                searchKeys: ['name', 'motorization'],
                searchPlaceholder: 'Modèle, motorisation…',
            },
            countLabel: 'modèle(s)',
            emptyMessage: 'Aucun modèle en base — validez un import d’abord.',
        };

        mountEl.innerHTML = global.UgapTemplates.renderVueLC(config);
        global.UgapTemplates.bindVueLC(mountEl, config);
        bindListActions(mountEl);
        bindEditorEvents();
        bindModalEvents();
        refreshList();
    }

    global.UgapModelesTab = { mount: mountModelesSection, refresh: mountModelesSection };
})(window);
