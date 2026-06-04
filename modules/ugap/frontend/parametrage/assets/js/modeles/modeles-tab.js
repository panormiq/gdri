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

    function isCatalogNodeSlot(slot) {
        return !!String(slot?.catalogNodeId || '').trim();
    }

    function isTechnicalCatalogRef(ref) {
        const r = String(ref || '').trim();
        if (!r) return false;
        return /^(BASE-|IBP-|bp_src_|opt_ibp_)/i.test(r);
    }

    function slotChoiceCount(model, slot) {
        return (MBO()?.getChoiceRows?.(model, slot, { baseOnly: true }) || []).length;
    }

    function renderCompactAddBtn(mid, slot) {
        const slotIdx = slot.__idx;
        return `<button type="button" class="btn btn-outline ugap-model-base-add ugap-model-base-add--compact" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" title="Créer une option de base">+</button>`;
    }

    function renderBaseSlotHtml(mid, model, slot) {
        const slotIdx = slot.__idx;
        const choices = MBO()?.getChoiceRows?.(model, slot, { baseOnly: true }) || [];
        const isMulti = MBO()?.isMultiChoiceSlot?.(slot) === true;
        const assignedSet = new Set(MBO()?.getAssignedOptionIds?.(mid, slot) || []);
        const catalogNode = isCatalogNodeSlot(slot);
        if (!choices.length && catalogNode) {
            return '';
        }
        const emptyHint = !choices.length
            ? `<p class="ugap-model-base-slot__empty">Aucune <strong>option de base</strong> pour ce poste sur ce nœud — cochez le modèle dans l’onglet <strong>Options</strong>, marquez la ligne en type <strong>Base</strong>, ou créez-en une avec <strong>+</strong>.</p>`
            : '';
        const modeHint = isMulti
            ? '<p class="ugap-model-base-slot__mode-hint">Choix multiple sur ce nœud</p>'
            : '<p class="ugap-model-base-slot__mode-hint">Choix unique sur ce nœud</p>';

        if (isMulti) {
            const checks = choices.map((row) => {
                const checked = assignedSet.has(row.id) ? ' checked' : '';
                const baseCls = row.isBaseOption ? ' ugap-model-base-multi-pick__item--base' : '';
                const baseTag = row.isBaseOption ? '<span class="ugap-model-base-pick__base-tag">base</span>' : '';
                const ref = row.refUgap && !isTechnicalCatalogRef(row.refUgap)
                    ? ` <span class="ugap-model-base-multi-pick__ref">${esc(row.refUgap)}</span>`
                    : '';
                const det = row.details && row.details !== row.name
                    && !isTechnicalCatalogRef(row.details)
                    ? ` <span class="ugap-model-base-multi-pick__det">${esc(row.details)}</span>`
                    : '';
                return `
                    <label class="ugap-model-base-multi-pick__item${baseCls}">
                        <input type="checkbox" class="ugap-model-base-multi-pick"
                            data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" data-option-id="${esc(row.id)}"${checked}>
                        <span class="ugap-model-base-multi-pick__label">${esc(row.name)}${baseTag}${ref}${det}</span>
                    </label>`;
            }).join('');
            return `
                <div class="ugap-model-base-slot ugap-model-base-slot--multi${catalogNode ? ' ugap-model-base-slot--catalog-node' : ''}">
                    ${catalogNode ? '' : `<div class="ugap-model-base-slot__title">${esc(MBO()?.formatSlotTitle?.(slot) || slot.groupLabel || '')}</div>`}
                    ${modeHint}
                    <div class="ugap-model-base-multi-pick__list">${checks}</div>
                    <div class="ugap-model-base-slot__row">
                        <button type="button" class="btn btn-outline ugap-model-base-add" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" title="Créer une option de base">+ Créer</button>
                    </div>
                    ${emptyHint}
                </div>`;
        }

        const assigned = assignedSet.size ? [...assignedSet][0] : '';
        const opts = choices.map((row) => {
            const sel = assigned === row.id ? ' selected' : '';
            const ref = row.refUgap ? ` — ${row.refUgap}` : '';
            const det = row.details ? ` (${row.details})` : '';
            const baseMark = row.isBaseOption ? ' ★' : '';
            return `<option value="${esc(row.id)}"${sel} data-is-base="${row.isBaseOption ? '1' : '0'}">${esc(row.name)}${esc(baseMark)}${esc(ref)}${esc(det)}</option>`;
        }).join('');
        const placeholderSelected = assigned ? '' : ' selected';
        return `
            <div class="ugap-model-base-slot${catalogNode ? ' ugap-model-base-slot--catalog-node' : ''}">
                ${catalogNode ? '' : `<div class="ugap-model-base-slot__title">${esc(MBO()?.formatSlotTitle?.(slot) || slot.groupLabel || '')}</div>`}
                ${modeHint}
                <div class="ugap-model-base-slot__row">
                    <select class="ugap-model-base-pick" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" ${choices.length ? '' : 'disabled'}>
                        <option value=""${placeholderSelected}>— Choisir une option —</option>
                        ${opts}
                    </select>
                    <button type="button" class="btn btn-outline ugap-model-base-add" data-model-id="${esc(mid)}" data-slot-idx="${slotIdx}" title="Créer une option de base">+</button>
                </div>
                ${emptyHint}
            </div>`;
    }

    function renderBaseTreeNodeHtml(treeNode, mid, model) {
        const slots = Array.isArray(treeNode.slots) ? treeNode.slots : [];
        const childrenHtml = (Array.isArray(treeNode.children) ? treeNode.children : [])
            .map((child) => renderBaseTreeNodeHtml(child, mid, model))
            .join('');
        const assignedTotal = slots.reduce(
            (n, s) => n + (MBO()?.getAssignedOptionIds?.(mid, s) || []).length,
            0
        );
        const linkedPool = slots.reduce((n, s) => n + slotChoiceCount(model, s), 0);
        const badge = assignedTotal
            ? `<span class="ugap-catalogue-tree__count ugap-catalogue-tree__count--choice">${assignedTotal} choisi(s)</span>`
            : (linkedPool
                ? `<span class="ugap-catalogue-tree__count">${linkedPool} opt.</span>`
                : '');
        const emptyAddBtns = slots
            .filter((s) => !slotChoiceCount(model, s))
            .map((s) => renderCompactAddBtn(mid, s))
            .join('');
        const kids = childrenHtml
            ? `<div class="ugap-catalogue-tree__children">${childrenHtml}</div>`
            : '';
        const bodyHtml = slots
            .map((slot) => renderBaseSlotHtml(mid, model, slot))
            .filter(Boolean)
            .join('');
        const bodyBlock = bodyHtml
            ? `<div class="ugap-model-base-tree__node-body">${bodyHtml}</div>`
            : '';
        return `
            <div class="ugap-catalogue-tree__item ugap-model-base-tree__item">
                <div class="ugap-catalogue-tree__row ugap-model-base-tree__node-head">
                    <span class="ugap-catalogue-tree__label">${esc(treeNode.label || 'Nœud')}</span>
                    ${emptyAddBtns}
                    ${badge}
                </div>
                ${bodyBlock}
                ${kids}
            </div>`;
    }

    function renderBaseEditorBodyHtml(model) {
        const mid = String(model?.id || '').trim();
        const status = MBO()?.getStatus?.(model) || { slots: [] };
        if (!status.slots.length) {
            const catalogNodes = global.UgapGroupCatalog?.resolveCatalogNodes?.({}) || [];
            if (!catalogNodes.length) {
                return `<p class="ugap-param-placeholder">Aucun nœud dans l’onglet <strong>Catalogue</strong> — créez l’arborescence, puis réouvrez cette fenêtre.</p>`;
            }
            const templateId = String(model?.boatTemplateId || '').trim();
            const tpl = templateId ? MBO()?.getTemplateById?.(templateId) : null;
            if (!tpl) {
                return `<p class="ugap-param-placeholder">Bateau de base introuvable — choisissez-en un autre dans la liste ci-dessus.</p>`;
            }
            return `<p class="ugap-param-placeholder">Impossible d’afficher le parcours (rechargez la page). Si le problème persiste, ouvrez <strong>Bateau de base</strong> et cliquez sur <strong>Enregistrer</strong> une fois.</p>`;
        }

        const tree = MBO()?.buildModelBaseEditorTree?.(model) || { roots: [], orphanSlots: status.slots };
        const rootsHtml = (tree.roots || []).map((node) => renderBaseTreeNodeHtml(node, mid, model)).join('');
        const orphanHtml = (tree.orphanSlots || []).length
            ? `<section class="ugap-model-base-tree__orphans">
                    <h4 class="ugap-model-base-tree__orphans-title">Autres nœuds</h4>
                    ${tree.orphanSlots.map((slot) => renderBaseSlotHtml(mid, model, slot)).join('')}
               </section>`
            : '';

        if (!rootsHtml && !orphanHtml) {
            return `<p class="ugap-param-placeholder">Aucun nœud catalogue dans ce template.</p>`;
        }

        return `
            <div class="ugap-model-base-tree ugap-catalogue-tree">
                ${rootsHtml || orphanHtml}
                ${rootsHtml && orphanHtml ? orphanHtml : ''}
            </div>`;
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

        let bodyHtml = '';
        if (!templateId) {
            bodyHtml = `<p class="ugap-param-placeholder">Choisissez un bateau de base pour afficher l’arbre des nœuds (comme le catalogue) et les groupes dans l’ordre du parcours.</p>`;
        } else {
            bodyHtml = renderBaseEditorBodyHtml(model);
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
                ${templateId ? `<p style="margin:10px 0 0;font-size:13px;color:#1e40af;">Bateau de base « ${esc(status.templateLabel || templateId)} » — même arbre que l’onglet <strong>Bateau de base</strong>. Pour chaque nœud : toutes les options compatibles avec ce <strong>poste</strong> (nom comme à l’import), ou créez une option de base avec <strong>+</strong>.</p>` : ''}
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
                        <div style="margin-bottom:12px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                                <label style="font-size:12px;font-weight:600;color:#334155;">Postes à assigner</label>
                                <div style="display:flex;gap:6px;">
                                    <button type="button" class="btn btn-outline" id="ugap-model-base-create-postes-all" style="font-size:12px;padding:4px 8px;">Tout cocher</button>
                                    <button type="button" class="btn btn-outline" id="ugap-model-base-create-postes-none" style="font-size:12px;padding:4px 8px;">Tout décocher</button>
                                </div>
                            </div>
                            <div id="ugap-model-base-create-postes-list" class="ugap-model-base-create-postes-list"></div>
                        </div>
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer;">
                            <input type="checkbox" id="ugap-model-base-create-per-poste-price">
                            <span>Prix différent selon le poste</span>
                        </label>
                        <div id="ugap-model-base-create-price-single-wrap">
                            <label style="display:block;font-size:12px;margin-bottom:4px;">Prix inclus (€)</label>
                            <input id="ugap-model-base-create-price" type="number" step="0.01" min="0" value="0" style="width:160px;padding:8px;border:1px solid #ddd;border-radius:6px;">
                        </div>
                        <div id="ugap-model-base-create-price-per-poste-wrap" hidden style="margin-top:4px;">
                            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Prix inclus pour chaque poste coché :</p>
                            <div id="ugap-model-base-create-price-per-poste-list"></div>
                        </div>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-model-base-create-cancel2">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-model-base-create-submit">Créer et associer</button>
                        </div>
                    </div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
    }

    function renderCreateModalPostesList(currentModelId) {
        const list = global.document.getElementById('ugap-model-base-create-postes-list');
        if (!list) return;
        const midCurrent = String(currentModelId || '').trim();
        const models = getModels().slice().sort(compareCatalogModelsByPoste);
        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            if (!mid) return '';
            const checked = mid === midCurrent ? 'checked' : '';
            return `
                <label class="ugap-model-base-create-poste-row">
                    <input type="checkbox" data-base-create-model-id="${esc(mid)}" ${checked}>
                    <span>${esc(formatCatalogModelLabel(m))}</span>
                </label>`;
        }).join('');
        syncCreateModalPerPostePriceRows();
    }

    function getCheckedCreateModalModelIds() {
        const list = global.document.getElementById('ugap-model-base-create-postes-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type="checkbox"][data-base-create-model-id]:checked'))
            .map((el) => String(el.getAttribute('data-base-create-model-id') || '').trim())
            .filter(Boolean);
    }

    function syncCreateModalPerPostePriceRows() {
        const perPoste = global.document.getElementById('ugap-model-base-create-per-poste-price');
        const wrap = global.document.getElementById('ugap-model-base-create-price-per-poste-wrap');
        const singleWrap = global.document.getElementById('ugap-model-base-create-price-single-wrap');
        const list = global.document.getElementById('ugap-model-base-create-price-per-poste-list');
        const enabled = !!perPoste?.checked;
        if (singleWrap) singleWrap.hidden = enabled;
        if (wrap) wrap.hidden = !enabled;
        if (!enabled || !list) return;
        const defaultPrice = parseMoneyInput(global.document.getElementById('ugap-model-base-create-price')?.value);
        const checkedIds = new Set(getCheckedCreateModalModelIds());
        list.innerHTML = getModels().slice().sort(compareCatalogModelsByPoste)
            .filter((m) => checkedIds.has(String(m?.id || '').trim()))
            .map((m) => {
                const mid = String(m?.id || '').trim();
                const existing = list.querySelector(`[data-base-create-price-model-id="${mid}"]`);
                const prev = existing ? parseMoneyInput(existing.value) : defaultPrice;
                return `
                    <div class="ugap-model-base-create-price-row">
                        <span class="ugap-model-base-create-price-row__label">${esc(formatCatalogModelLabel(m))}</span>
                        <input type="number" step="0.01" min="0" value="${esc(String(prev))}"
                            data-base-create-price-model-id="${esc(mid)}"
                            style="width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
                        <span style="font-size:12px;color:#64748b;">€</span>
                    </div>`;
            }).join('');
    }

    function toggleCreateModalPriceMode() {
        syncCreateModalPerPostePriceRows();
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
        const perPosteCb = global.document.getElementById('ugap-model-base-create-per-poste-price');
        const priceInput = global.document.getElementById('ugap-model-base-create-price');
        if (perPosteCb) perPosteCb.checked = false;
        if (priceInput) priceInput.value = '0';
        const nameEl = global.document.getElementById('ugap-model-base-create-name');
        const refEl = global.document.getElementById('ugap-model-base-create-ref');
        const detEl = global.document.getElementById('ugap-model-base-create-details');
        if (nameEl) nameEl.value = '';
        if (refEl) refEl.value = '';
        if (detEl) detEl.value = '';
        renderCreateModalPostesList(mid);
        toggleCreateModalPriceMode();
        if (hint) {
            const nodeLabel = String(
                slot.catalogNodeLabel || slot.categoryName || slot.groupLabel || 'Nœud'
            ).trim();
            const mode = MBO()?.isMultiChoiceSlot?.(slot) ? 'choix multiple' : 'choix unique';
            hint.innerHTML = `
                <strong>Nœud : ${esc(nodeLabel)}</strong>
                <span style="display:block;margin-top:4px;color:#64748b;">${esc(mode)} · l’option sera liée via <code>catalogObjectId</code></span>`;
        }
        if (modal) modal.hidden = false;
    }

    function closeCreateModal() {
        state.createContext = null;
        const modal = global.document.getElementById('ugap-model-base-create-modal');
        if (modal) modal.hidden = true;
    }

    function collectCreateModalPricingPayload() {
        const compatibleModelIds = getCheckedCreateModalModelIds();
        if (!compatibleModelIds.length) {
            throw new Error('Sélectionnez au moins un poste (modèle).');
        }
        const perPoste = !!global.document.getElementById('ugap-model-base-create-per-poste-price')?.checked;
        const pricesByModelId = {};
        if (perPoste) {
            compatibleModelIds.forEach((mid) => {
                const input = global.document.querySelector(
                    `[data-base-create-price-model-id="${CSS.escape(mid)}"]`
                );
                pricesByModelId[mid] = parseMoneyInput(input?.value);
            });
        } else {
            const single = parseMoneyInput(global.document.getElementById('ugap-model-base-create-price')?.value);
            compatibleModelIds.forEach((mid) => {
                pricesByModelId[mid] = single;
            });
        }
        const distinct = [...new Set(Object.values(pricesByModelId).map((v) => Number(v.toFixed(2))))];
        const pricingMode = perPoste && distinct.length > 1 ? 'per_model' : 'fixed';
        const baseIncludedPrice = distinct.length === 1 ? distinct[0] : (pricesByModelId[compatibleModelIds[0]] ?? 0);
        return {
            compatibleModelIds,
            perPostePricing: perPoste,
            pricingMode,
            pricesByModelId,
            price: baseIncludedPrice,
        };
    }

    async function submitCreateModal() {
        const ctx = state.createContext;
        if (!ctx) return;
        try {
            const pricing = collectCreateModalPricingPayload();
            await MBO()?.createBaseOption?.(ctx.modelId, ctx.slotIdx, {
                name: global.document.getElementById('ugap-model-base-create-name')?.value,
                details: global.document.getElementById('ugap-model-base-create-details')?.value,
                refUgap: global.document.getElementById('ugap-model-base-create-ref')?.value,
                price: pricing.price,
                compatibleModelIds: pricing.compatibleModelIds,
                pricingMode: pricing.pricingMode,
                pricesByModelId: pricing.pricesByModelId,
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
            void (async () => {
                try {
                    await ensureLoaded();
                    renderBaseEditor(state.editingModelId);
                } catch (err) {
                    global.showAlert?.(err?.message || 'Erreur chargement options de base', 'error');
                }
            })();
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
            const multiCb = sel?.matches?.('.ugap-model-base-multi-pick') ? sel : null;
            if (multiCb) {
                const modelId = multiCb.getAttribute('data-model-id');
                const slotIdx = multiCb.getAttribute('data-slot-idx');
                const optionId = multiCb.getAttribute('data-option-id');
                const row = multiCb.closest('.ugap-model-base-multi-pick__item');
                if (row) row.style.opacity = '0.55';
                multiCb.disabled = true;
                void (async () => {
                    try {
                        await MBO()?.toggleBaseOption?.(modelId, slotIdx, optionId, multiCb.checked);
                        refreshList();
                    } catch (err) {
                        multiCb.checked = !multiCb.checked;
                        global.showAlert?.(err?.message || 'Erreur association', 'error');
                    } finally {
                        multiCb.disabled = false;
                        if (row) row.style.opacity = '';
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
            if (ev.target?.id === 'ugap-model-base-create-postes-all') {
                global.document.querySelectorAll('#ugap-model-base-create-postes-list input[type="checkbox"]')
                    .forEach((el) => { el.checked = true; });
                syncCreateModalPerPostePriceRows();
            }
            if (ev.target?.id === 'ugap-model-base-create-postes-none') {
                global.document.querySelectorAll('#ugap-model-base-create-postes-list input[type="checkbox"]')
                    .forEach((el) => { el.checked = false; });
                syncCreateModalPerPostePriceRows();
            }
            const modal = global.document.getElementById('ugap-model-base-create-modal');
            if (modal && ev.target === modal) closeCreateModal();
        });
        global.document.addEventListener('change', (ev) => {
            const t = ev.target;
            if (t?.id === 'ugap-model-base-create-per-poste-price') {
                toggleCreateModalPriceMode();
                return;
            }
            if (t?.matches?.('#ugap-model-base-create-postes-list input[type="checkbox"][data-base-create-model-id]')) {
                syncCreateModalPerPostePriceRows();
            }
        });
    }

    async function ensureLoaded() {
        global.UgapModelBaseOptions?.clearConfiguratorContext?.();
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
            description: 'Catalogue importé par poste. Assignez un bateau de base et l’option de base par nœud catalogue.',
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
