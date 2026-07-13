/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/options/options-create-modal.js
 * RÔLE : Modal « + option » — tous types, parcours pour les bases, prix par poste.
 *
 * ENTRÉES : templates, modèle, catalogue LcState
 * SORTIES : createCatalogOption, rafraîchissement onglet Options
 *
 * DÉPEND DE : ugap-model-base-options.js, catalogue-lc-state.js
 * NE PAS : tableau options, filtres liste
 *
 * APPELÉ PAR : options-tab.js
 */
(function initUgapOptionsCreateModal(global) {
    'use strict';

    const MODAL_ID = 'ugap-options-create-modal';
    const MBO = () => global.UgapModelBaseOptions;
    const CatalogState = () => global.UgapCatalogueLcState;
    const NodesCore = () => global.UgapCatalogueNodesCore;

    const ctx = {
        data: null,
        uiState: null,
        missingRows: [],
        bound: false,
        modalBound: false,
    };

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function byId(id) {
        return global.document.getElementById(id);
    }

    function parseMoneyInput(raw) {
        const n = Number(String(raw ?? '').replace(',', '.').trim());
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    function getSelectedType() {
        return String(byId('ugap-options-create-type')?.value || 'base').trim().toLowerCase();
    }

    function getCatalogModels() {
        return Array.isArray(ctx.data?.models) ? ctx.data.models : [];
    }

    function formatModelLabel(model) {
        const st = CatalogState();
        if (st?.formatCatalogModelLabel) return st.formatCatalogModelLabel(model);
        const m = model && typeof model === 'object' ? model : {};
        const name = String(m?.name || '').trim();
        const pn = m?.posteNumber;
        const poste = pn != null && pn !== '' && Number.isFinite(Number(pn)) ? `P${pn}` : '';
        if (poste && name) return `${poste} — ${name}`;
        return poste || name || String(m?.id || '—');
    }

    function compareModelsByPoste(a, b) {
        const st = CatalogState();
        if (st?.compareCatalogModelsByPoste) return st.compareCatalogModelsByPoste(a, b);
        const na = Number(a?.posteNumber);
        const nb = Number(b?.posteNumber);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return formatModelLabel(a).localeCompare(formatModelLabel(b), 'fr', { sensitivity: 'base' });
    }

    function sortedModels() {
        return getCatalogModels().slice().sort(compareModelsByPoste);
    }

    function getModelsForTemplate(templateId) {
        const tid = String(templateId || '').trim();
        const models = sortedModels();
        if (!tid) return models;
        const linked = models.filter((m) => String(MBO()?.resolveBoatTemplateIdForModel?.(m) || '') === tid);
        return linked.length ? linked : models;
    }

    function getModelById(modelId) {
        const mid = String(modelId || '').trim();
        if (!mid) return null;
        return getCatalogModels().find((m) => String(m?.id || '').trim() === mid) || null;
    }

    function resolveModelRefUgap(model) {
        const m = model && typeof model === 'object' ? model : {};
        return String(m.refUgap || m.ref || '').trim();
    }

    function resolveCatalogNodeLabel(catalogNodeId) {
        const cnId = String(catalogNodeId || '').trim();
        if (!cnId) return '';
        const nodes = CatalogState()?.getCatalog?.()?.nodes
            || MBO()?.getCatalogNodesForRuntime?.()
            || [];
        return NodesCore()?.nodeBreadcrumb?.(nodes, cnId)
            || CatalogState()?.getNodeById?.(cnId)?.label
            || cnId;
    }

    function getTemplates() {
        const fromLc = global.UgapBateauBaseLcState?.getSavedBoatTemplates?.();
        if (Array.isArray(fromLc) && fromLc.length) return fromLc;
        const fromMbo = MBO()?.getTemplates?.();
        if (Array.isArray(fromMbo) && fromMbo.length) return fromMbo;
        const fromUi = Array.isArray(ctx.uiState?.boatTemplates) ? ctx.uiState.boatTemplates : [];
        return fromUi;
    }

    function buildRuntimeDataPayload(data, uiState) {
        const base = data && typeof data === 'object' ? { ...data } : {};
        const mergedUi = {
            ...(base.uiState && typeof base.uiState === 'object' ? base.uiState : {}),
            ...(uiState && typeof uiState === 'object' ? uiState : {}),
        };
        const catalog = CatalogState()?.getCatalog?.();
        if (catalog?.nodes?.length) mergedUi.catalog = catalog;
        const templates = global.UgapBateauBaseLcState?.getSavedBoatTemplates?.();
        if (Array.isArray(templates) && templates.length) mergedUi.boatTemplates = templates;
        const families = global.UgapFamilleLcState?.getFamilies?.();
        if (Array.isArray(families) && families.length) mergedUi.families = families;
        return { ...base, uiState: mergedUi };
    }

    function refreshRuntimeContext() {
        const current = typeof global.getUgapCurrentData === 'function'
            ? global.getUgapCurrentData()
            : ctx.data;
        syncContext(current, ctx.uiState);
    }

    function getTemplateSlots(templateId, modelId) {
        const tpl = MBO()?.getTemplateById?.(templateId);
        const model = getModelById(modelId);
        let slots = [];
        if (tpl && MBO()?.getTemplateDecisionSlots) slots = MBO().getTemplateDecisionSlots(tpl) || [];
        if (!slots.length && tpl) slots = MBO()?.enumerateCatalogParcoursSlots?.(tpl) || [];
        if (!slots.length && model) {
            const status = MBO()?.getStatus?.(model) || {};
            slots = Array.isArray(status.slots) ? status.slots : [];
        }
        return slots;
    }

    function getMissingBaseCategories(templateId, modelId) {
        const model = getModelById(modelId);
        if (!String(templateId || '').trim() || !model) return { rows: [], slotsTotal: 0 };
        const slots = getTemplateSlots(templateId, modelId);
        const seen = new Set();
        const rows = [];
        slots.forEach((slot) => {
            if (MBO()?.isMotorCatalogContainerSlot?.(slot)) return;
            if (MBO()?.isMotorGenericOptionCatalogSlot?.(slot)) return;
            const slotKey = MBO()?.getSlotKey?.(slot) || String(slot?.groupId || '').trim();
            if (!slotKey || seen.has(slotKey)) return;
            seen.add(slotKey);
            if ((MBO()?.getChoiceRows?.(model, slot, { baseOnly: true }) || []).length) return;
            const cnId = String(slot?.catalogNodeId || '').trim();
            const breadcrumb = cnId ? resolveCatalogNodeLabel(cnId) : '';
            const shortLabel = String(
                MBO()?.formatSlotTitle?.(slot)
                || slot?.groupLabel
                || slot?.catalogNodeLabel
                || breadcrumb
                || slotKey
            ).trim();
            rows.push({ catalogNodeId: cnId, label: shortLabel, breadcrumb: breadcrumb || shortLabel, canCreate: !!cnId });
        });
        rows.sort((a, b) => String(a.breadcrumb || a.label).localeCompare(String(b.breadcrumb || b.label), 'fr', { sensitivity: 'base' }));
        return { rows, slotsTotal: slots.length };
    }

    function buildCatalogNodeSelectOptions() {
        const nodes = CatalogState()?.getCatalog?.()?.nodes || MBO()?.getCatalogNodesForRuntime?.() || [];
        const options = [];
        const walk = (parentId, depth) => {
            (NodesCore()?.getChildren?.(nodes, parentId) || []).forEach((node) => {
                const path = NodesCore()?.nodeBreadcrumb?.(nodes, node.id) || node.label;
                const prefix = depth > 0 ? `${'　'.repeat(depth)}└ ` : '';
                options.push({ value: node.id, label: `${prefix}${path}` });
                walk(node.id, depth + 1);
            });
        };
        walk('', 0);
        return options;
    }

    function fillCatalogNodeSelect() {
        const sel = byId('ugap-options-create-catalog-node');
        if (!sel) return;
        const options = buildCatalogNodeSelectOptions();
        sel.innerHTML = options.length
            ? ['<option value="">Choisir un nœud catalogue…</option>', ...options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)].join('')
            : '<option value="">Aucun nœud catalogue</option>';
    }

    function guessImportCategoryId(catalogNodeId) {
        const nid = String(catalogNodeId || '').trim();
        const importCats = CatalogState()?.getImportCategories?.() || [];
        if (!nid || !importCats.length) return importCats[0]?.id || '';
        const nodes = CatalogState()?.getCatalog?.()?.nodes || [];
        const labels = [];
        const node = nodes.find((n) => String(n.id) === nid);
        if (node?.label) labels.push(String(node.label).trim());
        if (NodesCore()?.nodeBreadcrumb) {
            String(NodesCore().nodeBreadcrumb(nodes, nid)).split('›').forEach((p) => labels.push(p.trim()));
        }
        for (const raw of labels) {
            const part = String(raw || '').trim().toLowerCase();
            if (!part) continue;
            const hit = importCats.find((c) => String(c.name || '').trim().toLowerCase() === part);
            if (hit) return hit.id;
        }
        return importCats[0]?.id || '';
    }

    function fillImportCategorySelect(catalogNodeId) {
        const sel = byId('ugap-options-create-category');
        if (!sel) return;
        const cats = CatalogState()?.getImportCategories?.() || [];
        if (!cats.length) {
            sel.innerHTML = '<option value="" disabled>Aucune catégorie import</option>';
            sel.disabled = true;
            return;
        }
        sel.disabled = false;
        const pref = guessImportCategoryId(catalogNodeId);
        sel.innerHTML = cats.map((c) => {
            const selected = pref && c.id === pref ? ' selected' : '';
            return `<option value="${esc(c.id)}"${selected}>${esc(c.name || c.id)}</option>`;
        }).join('');
        if (pref && cats.some((c) => c.id === pref)) sel.value = pref;
    }

    function fillTemplateSelect() {
        const sel = byId('ugap-options-create-template');
        if (!sel) return;
        const templates = getTemplates().slice().sort((a, b) => String(a?.label || '').localeCompare(String(b?.label || ''), 'fr', { sensitivity: 'base' }));
        sel.innerHTML = templates.length
            ? templates.map((t) => `<option value="${esc(t.id)}">${esc(t.label || t.id)}</option>`).join('')
            : '<option value="">Aucun parcours</option>';
        fillModelSelect();
    }

    function fillModelSelect() {
        const sel = byId('ugap-options-create-model');
        if (!sel) return;
        const templateId = String(byId('ugap-options-create-template')?.value || '').trim();
        const models = getModelsForTemplate(templateId);
        sel.innerHTML = models.length
            ? models.map((m) => `<option value="${esc(m.id)}">${esc(formatModelLabel(m))}</option>`).join('')
            : '<option value="">Aucun modèle</option>';
        applyModelDefaults();
    }

    function formatPosteBadge(model) {
        const pn = model?.posteNumber;
        if (pn != null && pn !== '' && Number.isFinite(Number(pn))) return `P${pn}`;
        return 'P?';
    }

    function renderModelsCheckboxes(preCheckedAll) {
        const list = byId('ugap-options-create-models-list');
        if (!list) return;
        const models = sortedModels();
        const refModelId = String(byId('ugap-options-create-model')?.value || '').trim();
        if (!models.length) {
            list.innerHTML = '<p style="margin:0;font-size:12px;color:#64748b;">Aucun modèle.</p>';
            return;
        }
        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            const checked = preCheckedAll || (mid && mid === refModelId) ? 'checked' : '';
            return `
                <label class="ugap-catalogue-create-model-chip" title="${esc(formatModelLabel(m))}">
                    <input type="checkbox" data-options-create-model-id="${esc(mid)}" ${checked}>
                    <span class="ugap-catalogue-create-model-chip__poste">${esc(formatPosteBadge(m))}</span>
                </label>`;
        }).join('');
        syncPerPostePriceRows();
    }

    function setAllModelsChecked(checked) {
        global.document.querySelectorAll('[data-options-create-model-id]').forEach((el) => {
            el.checked = !!checked;
        });
        syncPerPostePriceRows();
    }

    function getCheckedModelIds() {
        return Array.from(global.document.querySelectorAll('[data-options-create-model-id]:checked'))
            .map((el) => String(el.getAttribute('data-options-create-model-id') || '').trim())
            .filter(Boolean);
    }

    function syncPerPostePriceRows() {
        const perPoste = byId('ugap-options-create-per-poste-price');
        const wrap = byId('ugap-options-create-price-per-poste-wrap');
        const singleWrap = byId('ugap-options-create-price-single-wrap');
        const list = byId('ugap-options-create-price-per-poste-list');
        const enabled = !!perPoste?.checked;
        if (singleWrap) singleWrap.hidden = enabled;
        if (wrap) wrap.hidden = !enabled;
        if (!enabled || !list) return;
        const defaultPrice = parseMoneyInput(byId('ugap-options-create-price')?.value);
        const checkedIds = new Set(getCheckedModelIds());
        list.innerHTML = sortedModels()
            .filter((m) => checkedIds.has(String(m?.id || '').trim()))
            .map((m) => {
                const mid = String(m?.id || '').trim();
                const existing = list.querySelector(`[data-options-create-price-model-id="${mid}"]`);
                const prev = existing ? parseMoneyInput(existing.value) : defaultPrice;
                return `
                    <div class="ugap-model-base-create-price-row">
                        <span class="ugap-model-base-create-price-row__label">${esc(formatModelLabel(m))}</span>
                        <input type="number" step="0.01" min="0" value="${esc(String(prev))}"
                            data-options-create-price-model-id="${esc(mid)}"
                            style="width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
                        <span style="font-size:12px;color:#64748b;">€</span>
                    </div>`;
            }).join('');
    }

    function isAllModelsMode() {
        return !!byId('ugap-options-create-all-models')?.checked;
    }

    function syncAllModelsUi() {
        const allModels = isAllModelsMode();
        const modelsWrap = byId('ugap-options-create-models-wrap');
        const modelsActions = byId('ugap-options-create-models-actions');
        const perPoste = byId('ugap-options-create-per-poste-price');
        if (modelsWrap) modelsWrap.style.opacity = allModels ? '0.45' : '1';
        if (modelsActions) modelsActions.hidden = allModels;
        global.document.querySelectorAll('[data-options-create-model-id]').forEach((el) => {
            el.disabled = allModels;
        });
        if (perPoste) {
            perPoste.disabled = allModels;
            if (allModels) perPoste.checked = false;
        }
        syncPerPostePriceRows();
    }

    function collectPricingPayload() {
        const price = parseMoneyInput(byId('ugap-options-create-price')?.value);
        if (isAllModelsMode()) {
            return {
                allModels: true,
                compatibleModels: [],
                pricingMode: 'fixed',
                pricesByModelId: {},
                price,
            };
        }
        const compatibleModels = getCheckedModelIds();
        if (!compatibleModels.length) throw new Error('Sélectionnez au moins un modèle (poste) ou cochez « Tous les modèles ».');
        const perPoste = !!byId('ugap-options-create-per-poste-price')?.checked;
        const pricesByModelId = {};
        if (perPoste) {
            compatibleModels.forEach((mid) => {
                const input = global.document.querySelector(`[data-options-create-price-model-id="${CSS.escape(mid)}"]`);
                pricesByModelId[mid] = parseMoneyInput(input?.value);
            });
        } else {
            compatibleModels.forEach((mid) => { pricesByModelId[mid] = price; });
        }
        const distinct = [...new Set(Object.values(pricesByModelId).map((v) => Number(v.toFixed(2))))];
        const pricingMode = perPoste && distinct.length > 1 ? 'per_model' : 'fixed';
        const resolvedPrice = distinct.length === 1 ? distinct[0] : (pricesByModelId[compatibleModels[0]] ?? price);
        return { compatibleModels, pricingMode, pricesByModelId, price: resolvedPrice, allModels: false };
    }

    function applyModelDefaults() {
        const type = getSelectedType();
        const model = getModelById(byId('ugap-options-create-model')?.value);
        const refInput = byId('ugap-options-create-ref');
        if (refInput) refInput.value = type === 'base' ? resolveModelRefUgap(model) : '';
        const priceInput = byId('ugap-options-create-price');
        if (priceInput && type === 'base') priceInput.value = '0';
        renderModelsCheckboxes(type === 'base');
        syncAllModelsUi();
    }

    function setModalHint(message, type = 'info') {
        const el = byId('ugap-options-create-hint');
        if (!el) return;
        el.textContent = String(message || '');
        el.dataset.statusType = type;
        el.hidden = !message;
    }

    function renderCategorySelect(result) {
        const sel = byId('ugap-options-create-category-node');
        if (!sel) return;
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        const slotsTotal = Number(result?.slotsTotal) || 0;
        ctx.missingRows = rows;
        if (!slotsTotal) {
            sel.innerHTML = '<option value="">Parcours illisible</option>';
            setModalHint('Aucune catégorie lue dans ce parcours.', 'warning');
            return;
        }
        if (!rows.length) {
            sel.innerHTML = '<option value="">Toutes les catégories ont une option de base</option>';
            setModalHint('Aucune catégorie sans option de base pour ce modèle.', 'success');
            return;
        }
        sel.innerHTML = [
            '<option value="">Choisir une catégorie…</option>',
            ...rows.filter((r) => r.canCreate).map((row) => {
                const label = row.breadcrumb || row.label || row.catalogNodeId;
                return `<option value="${esc(row.catalogNodeId)}">${esc(label)}</option>`;
            }),
        ].join('');
        setModalHint(`${rows.filter((r) => r.canCreate).length} catégorie(s) sans option de base.`, 'info');
        applyCategorySelection();
    }

    function getActiveCatalogNodeId() {
        if (getSelectedType() === 'base') {
            return String(byId('ugap-options-create-category-node')?.value || '').trim();
        }
        return String(byId('ugap-options-create-catalog-node')?.value || '').trim();
    }

    function applyCategorySelection() {
        const cnId = getActiveCatalogNodeId();
        const row = ctx.missingRows.find((r) => String(r.catalogNodeId) === cnId);
        const nameInput = byId('ugap-options-create-name');
        if (nameInput && row?.label) nameInput.value = row.label;
        fillImportCategorySelect(cnId);
    }

    async function refreshBasePanel() {
        const templateId = String(byId('ugap-options-create-template')?.value || '').trim();
        const modelId = String(byId('ugap-options-create-model')?.value || '').trim();
        if (!templateId || !modelId) {
            renderCategorySelect({ rows: [], slotsTotal: 0 });
            return;
        }
        try {
            if (!CatalogState()?.getCatalog?.()?.nodes?.length) await CatalogState()?.loadFromServer?.(true);
            if (!global.UgapBateauBaseLcState?.getSavedBoatTemplates?.()?.length) await global.UgapBateauBaseLcState?.loadFromServer?.(true);
        } catch (_e) { /* ignore */ }
        refreshRuntimeContext();
        renderCategorySelect(getMissingBaseCategories(templateId, modelId));
    }

    function syncTypePanels() {
        const type = getSelectedType();
        const parcoursPanel = byId('ugap-options-create-parcours-panel');
        const nodeWrap = byId('ugap-options-create-node-wrap');
        const refLabel = byId('ugap-options-create-ref-label');
        if (parcoursPanel) parcoursPanel.hidden = type !== 'base';
        if (nodeWrap) nodeWrap.hidden = type === 'base';
        if (refLabel) refLabel.textContent = type === 'base' ? 'Réf. UGAP (modèle)' : 'Réf. UGAP';
        if (type === 'base') {
            void refreshBasePanel();
        } else {
            fillCatalogNodeSelect();
            setModalHint('');
        }
        applyModelDefaults();
    }

    function ensureModal() {
        let modal = byId(MODAL_ID);
        if (modal) return modal;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${MODAL_ID}" class="ugap-model-base-modal" hidden role="dialog" aria-modal="true"
                aria-labelledby="ugap-options-create-title">
                <div class="ugap-model-base-modal__panel card ugap-catalogue-create-panel" style="width:min(680px,96vw);max-height:90vh;overflow:auto;">
                    <div class="ugap-model-base-modal__head">
                        <strong id="ugap-options-create-title">Créer une option</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-create-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <label class="ugap-catalogue-modal__field">
                            <span>Type d'option</span>
                            <select id="ugap-options-create-type">
                                <option value="base" selected>Option de base</option>
                                <option value="catalogue">Catalogue</option>
                                <option value="mino">MINO</option>
                                <option value="majo">MAJO</option>
                                <option value="pr">PR</option>
                            </select>
                        </label>

                        <div id="ugap-options-create-parcours-panel">
                            <p id="ugap-options-create-hint" hidden aria-live="polite" style="margin:0 0 10px;font-size:12px;color:#64748b;"></p>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                                <label class="ugap-catalogue-modal__field">
                                    <span>Parcours</span>
                                    <select id="ugap-options-create-template"></select>
                                </label>
                                <label class="ugap-catalogue-modal__field">
                                    <span>Modèle / poste</span>
                                    <select id="ugap-options-create-model"></select>
                                </label>
                            </div>
                            <label class="ugap-catalogue-modal__field">
                                <span>Catégorie sans option de base</span>
                                <select id="ugap-options-create-category-node"><option value="">—</option></select>
                            </label>
                        </div>

                        <label id="ugap-options-create-node-wrap" class="ugap-catalogue-modal__field" hidden>
                            <span>Nœud catalogue <span class="ugap-catalogue-muted">*</span></span>
                            <select id="ugap-options-create-catalog-node"><option value="">—</option></select>
                        </label>

                        <label class="ugap-catalogue-modal__field">
                            <span>Libellé <span class="ugap-catalogue-muted">*</span></span>
                            <input type="text" id="ugap-options-create-name" autocomplete="off" required>
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Détails</span>
                            <textarea id="ugap-options-create-details" rows="2" placeholder="Complément / libellé Excel"></textarea>
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span id="ugap-options-create-ref-label">Réf. UGAP (modèle)</span>
                            <input type="text" id="ugap-options-create-ref" autocomplete="off">
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Catégorie import <span class="ugap-catalogue-muted">*</span></span>
                            <select id="ugap-options-create-category" required></select>
                        </label>
                        <div class="ugap-catalogue-modal__field" id="ugap-options-create-models-wrap">
                            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:8px;">
                                <input type="checkbox" id="ugap-options-create-all-models">
                                <span><strong>Tous les modèles</strong> — compatible avec les postes actuels et futurs</span>
                            </label>
                            <div class="ugap-catalogue-create-models__head">
                                <span>Modèles utilisables <span class="ugap-catalogue-muted">*</span></span>
                                <div class="ugap-catalogue-create-models__actions" id="ugap-options-create-models-actions">
                                    <button type="button" class="btn btn-outline" id="ugap-options-create-models-all">Tout cocher</button>
                                    <button type="button" class="btn btn-outline" id="ugap-options-create-models-none">Tout décocher</button>
                                </div>
                            </div>
                            <div class="ugap-catalogue-create-models-grid-wrap">
                                <div id="ugap-options-create-models-list" class="ugap-catalogue-create-models-grid"></div>
                            </div>
                        </div>
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:10px;">
                            <input type="checkbox" id="ugap-options-create-per-poste-price">
                            <span>Prix différent selon le poste</span>
                        </label>
                        <div id="ugap-options-create-price-single-wrap">
                            <label class="ugap-catalogue-modal__field">
                                <span id="ugap-options-create-price-label">Prix (€)</span>
                                <input type="number" id="ugap-options-create-price" step="0.01" min="0" value="0">
                            </label>
                        </div>
                        <div id="ugap-options-create-price-per-poste-wrap" hidden>
                            <p class="ugap-catalogue-muted" style="margin:0 0 8px;font-size:12px;">Prix pour chaque modèle coché :</p>
                            <div id="ugap-options-create-price-per-poste-list"></div>
                        </div>
                    </div>
                    <div style="padding:12px 14px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end;">
                        <button type="button" class="btn btn-outline" id="ugap-options-create-cancel">Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-options-create-submit">Créer</button>
                    </div>
                </div>
            </div>`;
        modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);
        return modal;
    }

    function bindModalEvents() {
        if (ctx.modalBound) return;
        ctx.modalBound = true;
        byId('ugap-options-create-close')?.addEventListener('click', close);
        byId('ugap-options-create-cancel')?.addEventListener('click', close);
        byId('ugap-options-create-type')?.addEventListener('change', () => syncTypePanels());
        byId('ugap-options-create-template')?.addEventListener('change', () => { fillModelSelect(); void refreshBasePanel(); });
        byId('ugap-options-create-model')?.addEventListener('change', () => { applyModelDefaults(); void refreshBasePanel(); });
        byId('ugap-options-create-category-node')?.addEventListener('change', () => applyCategorySelection());
        byId('ugap-options-create-catalog-node')?.addEventListener('change', () => applyCategorySelection());
        byId('ugap-options-create-all-models')?.addEventListener('change', () => syncAllModelsUi());
        byId('ugap-options-create-models-all')?.addEventListener('click', () => setAllModelsChecked(true));
        byId('ugap-options-create-models-none')?.addEventListener('click', () => setAllModelsChecked(false));
        byId('ugap-options-create-per-poste-price')?.addEventListener('change', () => syncPerPostePriceRows());
        byId('ugap-options-create-price')?.addEventListener('input', () => {
            if (!byId('ugap-options-create-per-poste-price')?.checked) return;
            syncPerPostePriceRows();
        });
        global.document.getElementById('ugap-options-create-models-list')?.addEventListener('change', (ev) => {
            if (!ev.target.matches('[data-options-create-model-id]')) return;
            syncPerPostePriceRows();
        });
        byId('ugap-options-create-submit')?.addEventListener('click', () => { void submit(); });
        global.document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            const m = byId(MODAL_ID);
            if (m && !m.hidden) close();
        });
    }

    async function submit() {
        const type = getSelectedType();
        const catalogObjectId = getActiveCatalogNodeId();
        const name = String(byId('ugap-options-create-name')?.value || '').trim();
        const categoryId = String(byId('ugap-options-create-category')?.value || '').trim();
        const refUgap = String(byId('ugap-options-create-ref')?.value || '').trim();
        const details = String(byId('ugap-options-create-details')?.value || '').trim();

        if (!catalogObjectId) {
            global.showAlert?.(type === 'base' ? 'Sélectionnez une catégorie sans option de base.' : 'Sélectionnez un nœud catalogue.', 'warning');
            return;
        }
        if (!name) { global.showAlert?.('Libellé requis.', 'warning'); return; }
        if (!categoryId) { global.showAlert?.('Choisissez une catégorie import.', 'warning'); return; }

        let pricing;
        try { pricing = collectPricingPayload(); }
        catch (err) { global.showAlert?.(err?.message || String(err), 'warning'); return; }

        const btn = byId('ugap-options-create-submit');
        if (btn) btn.disabled = true;
        try {
            await CatalogState().createCatalogOption({
                optionType: type,
                categoryId,
                name,
                details,
                refUgap,
                price: pricing.price,
                pricingMode: pricing.pricingMode,
                pricesByModelId: pricing.pricesByModelId,
                compatibleModels: pricing.compatibleModels,
                allModels: pricing.allModels,
                catalogObjectId,
            });
            global.showAlert?.(`Option « ${name} » créée.`, 'success');
            close();
            await CatalogState()?.reload?.();
            if (typeof global.UgapOptionsTab?.refresh === 'function') await global.UgapOptionsTab.refresh();
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function open() {
        ensureModal();
        bindModalEvents();
        try {
            if (!CatalogState()?.getCatalog?.()?.nodes?.length) await CatalogState()?.loadFromServer?.(true);
            if (!global.UgapBateauBaseLcState?.getSavedBoatTemplates?.()?.length) await global.UgapBateauBaseLcState?.loadFromServer?.(true);
        } catch (_e) { /* ignore */ }
        if (!ctx.data && typeof global.getUgapCurrentData === 'function') {
            syncContext(global.getUgapCurrentData(), ctx.uiState);
        } else {
            refreshRuntimeContext();
        }
        byId('ugap-options-create-type').value = 'base';
        byId('ugap-options-create-name').value = '';
        byId('ugap-options-create-details').value = '';
        byId('ugap-options-create-price').value = '0';
        const perPoste = byId('ugap-options-create-per-poste-price');
        if (perPoste) perPoste.checked = false;
        const allModelsCb = byId('ugap-options-create-all-models');
        if (allModelsCb) allModelsCb.checked = false;
        fillTemplateSelect();
        syncTypePanels();
        const modal = byId(MODAL_ID);
        if (modal) modal.hidden = false;
        byId('ugap-options-create-name')?.focus();
    }

    function close() {
        const modal = byId(MODAL_ID);
        if (modal) modal.hidden = true;
        setModalHint('');
    }

    function bindEvents() {
        if (ctx.bound) return;
        if (!byId('ugap-section-options')) return;
        ctx.bound = true;
        byId('ugap-options-add')?.addEventListener('click', () => { void open(); });
    }

    function syncContext(data, uiState) {
        ctx.uiState = uiState && typeof uiState === 'object' ? uiState : null;
        ctx.data = buildRuntimeDataPayload(data, uiState);
        if (ctx.data && typeof global.setUgapCurrentData === 'function') global.setUgapCurrentData(ctx.data);
    }

    function mount() { bindEvents(); }

    global.UgapOptionsCreateModal = { mount, open, close, syncContext };
})(window);
