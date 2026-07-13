/**
 * Pont paramétrage → tableau parcours configurateur (Modèles / Templates de base).
 *
 * RÔLE : Réutiliser UgapConfiguratorTemplateTree.renderCatalogParcoursPanel
 * ENTRÉES : modèle, template brouillon, conteneur DOM, callbacks
 * SORTIES : HTML parcours + modals picker
 * DÉPEND DE : configurateur-template-tree.js, ugap-model-base-options.js
 * APPELÉ PAR : modeles-tab.js, template-bateau-tab.js
 */
(function initUgapParametrageParcoursBridge(global) {
    'use strict';

    const Tree = () => global.UgapConfiguratorTemplateTree;
    const MBO = () => global.UgapModelBaseOptions;

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function getSlotIdx(group) {
        const idx = group?._slot?.__idx;
        return Number.isFinite(Number(idx)) ? Number(idx) : -1;
    }

    function buildCategoriesFromData() {
        const data = typeof global.getUgapCurrentData === 'function' ? global.getUgapCurrentData() : null;
        return Array.isArray(data?.categories) ? data.categories : [];
    }

    function buildModelsFromData() {
        const data = MBO()?.getData?.();
        return Array.isArray(data?.models) ? data.models : [];
    }

    /** Même résolution que template-bateau-tab (LcState + uiState). */
    function resolveParametrageCatalogNodes() {
        const Cat = global.UgapGroupCatalog;
        if (Cat?.resolveCatalogNodes) {
            const fromCat = Cat.resolveCatalogNodes({}) || [];
            if (fromCat.length) return fromCat;
        }
        const St = global.UgapCatalogueLcState;
        const Core = global.UgapCatalogueNodesCore;
        let nodes = St?.getCatalog?.()?.nodes || [];
        if (!nodes.length) {
            const data = typeof global.getUgapCurrentData === 'function' ? global.getUgapCurrentData() : null;
            const raw = data?.uiState?.catalog;
            if (raw && Core?.normalizeCatalog) {
                nodes = Core.normalizeCatalog(raw).nodes || [];
            }
            if (!nodes.length && Array.isArray(data?.categories) && data.categories.length && Core?.migrateLegacyCatalog) {
                const migrated = Core.migrateLegacyCatalog({
                    categories: data.categories,
                    objects: raw?.objects,
                    nodes: raw?.nodes,
                });
                nodes = Array.isArray(migrated) ? migrated : [];
            }
        }
        if (nodes.length && Core?.normalizeCatalog) {
            return Core.normalizeCatalog({ nodes }).nodes || [];
        }
        return nodes;
    }

    function buildUiState(extraTemplates) {
        const data = typeof global.getUgapCurrentData === 'function' ? global.getUgapCurrentData() : {};
        const base = data?.uiState && typeof data.uiState === 'object' ? { ...data.uiState } : {};
        const templates = MBO()?.getTemplates?.() || [];
        const merged = [...templates];
        (Array.isArray(extraTemplates) ? extraTemplates : []).forEach((tpl) => {
            const id = String(tpl?.id || '').trim();
            if (!id || merged.some((t) => String(t?.id || '').trim() === id)) return;
            merged.push(tpl);
        });
        base.boatTemplates = merged;
        const catalogNodes = resolveParametrageCatalogNodes();
        if (catalogNodes.length) {
            const Core = global.UgapCatalogueNodesCore;
            base.catalog = Core?.normalizeCatalog
                ? Core.normalizeCatalog({ nodes: catalogNodes })
                : { nodes: catalogNodes };
        }
        return base;
    }

    function buildParcoursState(model, extraTemplates) {
        return {
            selectedModel: model,
            _parametrageAdminMode: true,
            models: buildModelsFromData(),
            categories: buildCategoriesFromData(),
            uiState: buildUiState(extraTemplates),
            selectedOptions: new Set(),
            fivePercentOptions: new Set(),
            _devisSlotNoAutoDefault: new Set(),
            isOptionCompatibleWithSelectedModel: (opt) => {
                const mid = String(model?.id || '').trim();
                if (!mid || mid.startsWith('__')) return true;
                const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
                if (!comp.length) return !!opt?.isDivers;
                return comp.includes(mid);
            },
            getCatalogOptionById: (id) => {
                const oid = String(id || '').trim();
                if (!oid) return null;
                for (const cat of buildCategoriesFromData()) {
                    const hit = (Array.isArray(cat?.options) ? cat.options : [])
                        .find((o) => String(o?.id || '') === oid);
                    if (hit) return hit;
                }
                return null;
            },
            isBaseCatalogOption: (opt) => {
                if (!opt) return false;
                return opt.isBaseOption === true || opt.baseIncluded === true || opt.manualBaseOption === true;
            },
        };
    }

    function syncConfiguratorBridge(state) {
        global.UgapConfiguratorModelBaseBridge?.sync?.(state);
    }

    function clearConfiguratorBridge() {
        global.UgapConfiguratorModelBaseBridge?.clear?.();
    }

    function ensurePickerModal() {
        if (global.document.getElementById('subcategory-modal')) return;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div class="modal" id="subcategory-modal">
                <div class="modal-content modal-picker">
                    <div class="modal-header">
                        <h2 id="subcategory-modal-title">Options</h2>
                        <button type="button" class="modal-close" id="ugap-param-subcategory-modal-close">&times;</button>
                    </div>
                    <div id="subcategory-options-list"></div>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
        global.document.getElementById('ugap-param-subcategory-modal-close')?.addEventListener('click', () => {
            global.document.getElementById('subcategory-modal')?.classList.remove('active');
        });
    }

    if (typeof global.closeSubCategoryModal !== 'function') {
        global.closeSubCategoryModal = function closeSubCategoryModal() {
            const modal = global.document.getElementById('subcategory-modal');
            if (modal) modal.classList.remove('active');
        };
    }

    async function clearBaseSlotPick(modelId, group) {
        const slot = group?._slot;
        const mid = String(modelId || '').trim();
        if (!mid || !slot) return;
        const key = MBO()?.getSlotKey?.(slot);
        const st = global.UgapBateauBaseLcState;
        if (key && st?.setModelBaseSlotPick) {
            st.setModelBaseSlotPick(mid, key, []);
        }
        if (st?.persistModelBaseSlotPicksOnly) {
            const ok = await st.persistModelBaseSlotPicksOnly();
            if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
        }
    }

    function buildModelPresetReorderHooks(state, container, configId, callbacks) {
        const modelId = String(state.selectedModel?.id || '').trim();
        const cid = String(configId || '').trim();
        const St = global.UgapBateauBaseLcState;
        return {
            parcoursReadOnly: true,
            parcoursReorderMode: true,
            showAllParcoursSlots: true,
            optionColumnLabel: 'Option',
            hideParcoursPriceColumn: true,
            tabsContainer: null,
            subcategoriesContainer: null,
            optionsContainer: container,
            getBoatTemplateLabel: () => {
                const tpl = MBO()?.resolveBoatTemplateForModel?.(state.selectedModel);
                return String(tpl?.label || '').trim();
            },
            resolveBoatTemplate: callbacks?.resolveBoatTemplate,
            resolveCatalogNodes: resolveParametrageCatalogNodes,
            resolveCatalogNodeOrder: (_st, tpl) => {
                return MBO()?.getConfigurationCatalogParcoursOrder?.(state.selectedModel, cid, tpl) || {};
            },
            onReorderCatalogNode: async (parentId, fromId, toId, mode) => {
                St?.reorderConfigurationCatalogSiblings?.(modelId, cid, parentId, fromId, toId, mode);
                await St?.persistModelConfigurationsOnly?.();
                if (typeof callbacks?.onChanged === 'function') callbacks.onChanged();
                refreshModelPresetReorderParcoursInPlace(state.selectedModel, configId, container, callbacks);
            },
            onParcoursRefresh: () => {
                refreshModelPresetReorderParcoursInPlace(state.selectedModel, configId, container, callbacks);
            },
            getCatalogOptionById: (id) => state.getCatalogOptionById(id),
            isOptionCompatibleWithModel: (opt) => state.isOptionCompatibleWithSelectedModel(opt),
            isBaseCatalogOption: (opt) => state.isBaseCatalogOption(opt),
        };
    }

    function buildModelPresetHooks(state, container, configId, callbacks) {
        const modelId = String(state.selectedModel?.id || '').trim();
        const cid = String(configId || '').trim();
        return {
            parcoursMode: 'parametrage_preset',
            optionColumnLabel: 'Option',
            hideParcoursPriceColumn: true,
            tabsContainer: null,
            subcategoriesContainer: null,
            optionsContainer: container,
            getBoatTemplateLabel: () => {
                const tpl = MBO()?.resolveBoatTemplateForModel?.(state.selectedModel);
                if (tpl) return String(tpl.label || '').trim();
                const tid = String(state.selectedModel?.boatTemplateId || '').trim();
                const legacy = MBO()?.getTemplateById?.(tid);
                return String(legacy?.label || '').trim();
            },
            resolveBoatTemplate: callbacks?.resolveBoatTemplate,
            resolveCatalogNodes: resolveParametrageCatalogNodes,
            onParcoursRefresh: () => {
                refreshModelPresetParcoursInPlace(state.selectedModel, configId, container, callbacks);
            },
            onParametragePickSingle: async (_st, group, optionId) => {
                const slotIdx = getSlotIdx(group);
                if (slotIdx < 0) return;
                await MBO()?.pickPresetOption?.(modelId, cid, slotIdx, optionId);
                MBO()?.setPresetEditContext?.(modelId, cid);
                refreshModelPresetParcoursInPlace(state.selectedModel, configId, container, callbacks);
                callbacks?.onChanged?.();
            },
            onParametrageClearSlot: async (_st, group) => {
                const slot = group?._slot;
                if (!slot) return;
                await MBO()?.clearPresetSlotPick?.(modelId, cid, slot);
                MBO()?.setPresetEditContext?.(modelId, cid);
                refreshModelPresetParcoursInPlace(state.selectedModel, configId, container, callbacks);
                callbacks?.onChanged?.();
            },
            onParametragePickMulti: async (_st, group, optionIds) => {
                const slot = group?._slot;
                const slotIdx = getSlotIdx(group);
                if (slotIdx < 0 || !slot) return;
                MBO()?.setPresetEditContext?.(modelId, cid);
                const current = new Set(MBO()?.getExplicitPickIds?.(modelId, slot) || []);
                const next = new Set((Array.isArray(optionIds) ? optionIds : []).map((x) => String(x || '').trim()).filter(Boolean));
                const tasks = [];
                current.forEach((id) => {
                    if (!next.has(id)) tasks.push(MBO()?.togglePresetOption?.(modelId, cid, slotIdx, id, false));
                });
                next.forEach((id) => {
                    if (!current.has(id)) tasks.push(MBO()?.togglePresetOption?.(modelId, cid, slotIdx, id, true));
                });
                await Promise.all(tasks);
                MBO()?.setPresetEditContext?.(modelId, cid);
                refreshModelPresetParcoursInPlace(state.selectedModel, configId, container, callbacks);
                callbacks?.onChanged?.();
            },
            getCatalogOptionById: (id) => state.getCatalogOptionById(id),
            isOptionCompatibleWithModel: (opt) => state.isOptionCompatibleWithSelectedModel(opt),
            isBaseCatalogOption: (opt) => state.isBaseCatalogOption(opt),
        };
    }

    function buildModelBaseHooks(state, container, callbacks) {
        const modelId = String(state.selectedModel?.id || '').trim();
        return {
            parcoursMode: 'parametrage_base',
            optionColumnLabel: 'Option de base',
            hideParcoursPriceColumn: true,
            tabsContainer: null,
            subcategoriesContainer: null,
            optionsContainer: container,
            getBoatTemplateLabel: () => {
                const tpl = MBO()?.resolveBoatTemplateForModel?.(state.selectedModel, { userOnly: false });
                if (tpl) return String(tpl.label || '').trim();
                const tid = String(state.selectedModel?.boatTemplateId || '').trim();
                const legacy = typeof callbacks?.resolveBoatTemplate === 'function'
                    ? callbacks.resolveBoatTemplate(state)
                    : MBO()?.getTemplateById?.(tid);
                return String(legacy?.label || '').trim();
            },
            resolveBoatTemplate: callbacks?.resolveBoatTemplate,
            resolveCatalogNodes: resolveParametrageCatalogNodes,
            onParcoursRefresh: () => {
                renderModelBaseParcours(state.selectedModel, container, callbacks);
            },
            onParametragePickSingle: async (_st, group, optionId) => {
                const slotIdx = getSlotIdx(group);
                if (slotIdx < 0) return;
                await MBO()?.pickBaseOption?.(modelId, slotIdx, optionId);
                refreshModelBaseParcoursInPlace(state.selectedModel, container, callbacks);
                callbacks?.onChanged?.();
            },
            onParametrageClearSlot: async (_st, group) => {
                await clearBaseSlotPick(modelId, group);
                refreshModelBaseParcoursInPlace(state.selectedModel, container, callbacks);
                callbacks?.onChanged?.();
            },
            onParametragePickMulti: async (_st, group, optionIds) => {
                const slot = group?._slot;
                const slotIdx = getSlotIdx(group);
                if (slotIdx < 0 || !slot) return;
                const current = new Set(MBO()?.getAssignedOptionIds?.(modelId, slot) || []);
                const next = new Set((Array.isArray(optionIds) ? optionIds : []).map((x) => String(x || '').trim()).filter(Boolean));
                const tasks = [];
                current.forEach((id) => {
                    if (!next.has(id)) tasks.push(MBO()?.toggleBaseOption?.(modelId, slotIdx, id, false));
                });
                next.forEach((id) => {
                    if (!current.has(id)) tasks.push(MBO()?.toggleBaseOption?.(modelId, slotIdx, id, true));
                });
                await Promise.all(tasks);
                refreshModelBaseParcoursInPlace(state.selectedModel, container, callbacks);
                callbacks?.onChanged?.();
            },
            getCatalogOptionById: (id) => state.getCatalogOptionById(id),
            isOptionCompatibleWithModel: (opt) => state.isOptionCompatibleWithSelectedModel(opt),
            isBaseCatalogOption: (opt) => state.isBaseCatalogOption(opt),
        };
    }

    function buildTemplateStructureHooks(state, container, label, callbacks) {
        return {
            parcoursStructureMode: true,
            parcoursReadOnly: true,
            hideParcoursModelLine: true,
            optionColumnLabel: 'Option de base',
            hideParcoursPriceColumn: true,
            tabsContainer: null,
            subcategoriesContainer: null,
            optionsContainer: container,
            getBoatTemplateLabel: () => String(label || '').trim(),
            getStructureHint: () => String(callbacks?.getHint?.() || '').trim(),
            buildStructureActionCell: (rowDef) => {
                if (typeof callbacks?.buildActionCell === 'function') {
                    return callbacks.buildActionCell(rowDef);
                }
                return '';
            },
            resolveBoatTemplate: (st) => st._previewTemplate || null,
            resolveCatalogNodes: resolveParametrageCatalogNodes,
            onParcoursRefresh: () => {
                if (typeof callbacks?.onRefreshPreview === 'function') {
                    callbacks.onRefreshPreview();
                }
            },
            getCatalogOptionById: (id) => state.getCatalogOptionById(id),
            isOptionCompatibleWithModel: () => true,
            isBaseCatalogOption: () => false,
        };
    }

    function buildTemplateEditHooks(state, container, label, callbacks) {
        return {
            parcoursReadOnly: true,
            parcoursReorderMode: true,
            showAllParcoursSlots: true,
            optionColumnLabel: 'Option de base',
            hideParcoursPriceColumn: true,
            tabsContainer: null,
            subcategoriesContainer: null,
            optionsContainer: container,
            getBoatTemplateLabel: () => String(label || '').trim(),
            resolveBoatTemplate: (st) => st._previewTemplate || null,
            resolveCatalogNodes: resolveParametrageCatalogNodes,
            onReorderCatalogNode: (parentId, fromId, toId, mode) => {
                if (typeof callbacks?.onReorder === 'function') {
                    callbacks.onReorder(parentId, fromId, toId, mode);
                }
            },
            onParcoursRefresh: () => {
                if (typeof callbacks?.onRefreshPreview === 'function') {
                    callbacks.onRefreshPreview();
                }
            },
            getCatalogOptionById: (id) => state.getCatalogOptionById(id),
            isOptionCompatibleWithModel: () => true,
            isBaseCatalogOption: () => false,
        };
    }

    function refreshTemplateStructureInPlace(draftTpl, container, label, callbacks) {
        if (!container || !Tree()?.refreshDevisTableChoiceCells) return false;
        const root = container.querySelector('#ugap-config-parcours-root');
        if (!root) return false;

        const previewId = String(draftTpl?.id || '__ugap_tpl_structure_preview__').trim();
        const tpl = {
            id: previewId,
            label: String(draftTpl?.label || label || 'Structure').trim() || 'Structure',
            snapshot: draftTpl?.snapshot || draftTpl,
        };
        const model = {
            id: '__ugap_tpl_structure_preview_model__',
            name: tpl.label,
            boatTemplateId: previewId,
        };
        const state = buildParcoursState(model, [tpl]);
        state._previewTemplate = tpl;
        syncConfiguratorBridge(state);
        const hooks = buildTemplateStructureHooks(state, container, tpl.label, callbacks);
        Tree().refreshDevisTableChoiceCells(state, hooks);
        return true;
    }

    function renderTemplateStructurePreview(draftTpl, container, label, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) {
            container.innerHTML = '<p class="ugap-param-placeholder">Éditeur structure indisponible.</p>';
            return;
        }
        const previewId = String(draftTpl?.id || '__ugap_tpl_structure_preview__').trim();
        const tpl = {
            id: previewId,
            label: String(draftTpl?.label || label || 'Structure').trim() || 'Structure',
            snapshot: draftTpl?.snapshot || draftTpl,
        };
        const model = {
            id: '__ugap_tpl_structure_preview_model__',
            name: tpl.label,
            boatTemplateId: previewId,
        };
        const state = buildParcoursState(model, [tpl]);
        state._previewTemplate = tpl;
        syncConfiguratorBridge(state);
        const hooks = buildTemplateStructureHooks(state, container, tpl.label, callbacks);
        Tree().renderCatalogParcoursPanel(state, hooks, container);
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    function refreshTemplateParcoursInPlace(draftTpl, container, label, callbacks) {
        if (!container || !Tree()?.refreshDevisTableChoiceCells) return false;
        const root = container.querySelector('#ugap-config-parcours-root');
        if (!root) return false;

        const previewId = String(draftTpl?.id || '__ugap_tpl_draft_preview__').trim();
        const tpl = {
            id: previewId,
            label: String(draftTpl?.label || label || 'Aperçu').trim() || 'Aperçu',
            snapshot: draftTpl?.snapshot || draftTpl,
        };
        const model = {
            id: '__ugap_tpl_preview_model__',
            name: tpl.label,
            boatTemplateId: previewId,
        };
        const state = buildParcoursState(model, [tpl]);
        state._previewTemplate = tpl;
        syncConfiguratorBridge(state);
        const hooks = buildTemplateEditHooks(state, container, tpl.label, callbacks);
        Tree().refreshDevisTableChoiceCells(state, hooks);
        return true;
    }

    function renderTemplateParcoursPreview(draftTpl, container, label, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) {
            container.innerHTML = '<p class="ugap-param-placeholder">Aperçu parcours indisponible.</p>';
            return;
        }
        const previewId = String(draftTpl?.id || '__ugap_tpl_draft_preview__').trim();
        const tpl = {
            id: previewId,
            label: String(draftTpl?.label || label || 'Aperçu').trim() || 'Aperçu',
            snapshot: draftTpl?.snapshot || draftTpl,
        };
        const model = {
            id: '__ugap_tpl_preview_model__',
            name: tpl.label,
            boatTemplateId: previewId,
        };
        const state = buildParcoursState(model, [tpl]);
        state._previewTemplate = tpl;
        syncConfiguratorBridge(state);
        const hooks = buildTemplateEditHooks(state, container, tpl.label, callbacks);
        Tree().renderCatalogParcoursPanel(state, hooks, container);
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    function refreshModelPresetReorderParcoursInPlace(model, configId, container, callbacks) {
        if (!container || !Tree()?.refreshDevisTableChoiceCells) return;
        const mid = String(model?.id || '').trim();
        const cid = String(configId || '').trim();
        const state = buildParcoursState(model, []);
        syncConfiguratorBridge(state);
        MBO()?.setPresetEditContext?.(mid, cid);
        const hooks = buildModelPresetReorderHooks(state, container, cid, callbacks);
        const root = container.querySelector('#ugap-config-parcours-root');
        if (root) {
            Tree().refreshDevisTableChoiceCells(state, hooks);
            return;
        }
        renderModelPresetReorderParcours(model, configId, container, callbacks);
    }

    function renderModelPresetReorderParcours(model, configId, container, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) {
            container.innerHTML = '<p class="ugap-param-placeholder">Tableau parcours indisponible.</p>';
            return;
        }
        const mid = String(model?.id || '').trim();
        const cid = String(configId || '').trim();
        const state = buildParcoursState(model, []);
        syncConfiguratorBridge(state);
        MBO()?.setPresetEditContext?.(mid, cid);
        const hooks = buildModelPresetReorderHooks(state, container, cid, callbacks);
        Tree().renderCatalogParcoursPanel(state, hooks, container);
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    function refreshModelPresetParcoursInPlace(model, configId, container, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) return;
        ensurePickerModal();
        const mid = String(model?.id || '').trim();
        const cid = String(configId || '').trim();
        MBO()?.setPresetEditContext?.(mid, cid);
        try {
            const state = buildParcoursState(model, []);
            syncConfiguratorBridge(state);
            const hooks = buildModelPresetHooks(state, container, cid, callbacks);
            const root = container.querySelector('#ugap-config-parcours-root');
            if (root && typeof Tree()?.refreshDevisTableChoiceCells === 'function') {
                Tree().refreshDevisTableChoiceCells(state, hooks);
                return;
            }
            renderModelPresetParcours(model, configId, container, callbacks);
        } finally {
            MBO()?.clearConfiguratorContext?.();
        }
    }

    function renderModelPresetParcours(model, configId, container, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) {
            container.innerHTML = '<p class="ugap-param-placeholder">Tableau parcours indisponible.</p>';
            return;
        }
        ensurePickerModal();
        const mid = String(model?.id || '').trim();
        const cid = String(configId || '').trim();
        MBO()?.setPresetEditContext?.(mid, cid);
        try {
            global.UgapModelBaseOptions?.clearConfiguratorContext?.();
            MBO()?.setPresetEditContext?.(mid, cid);
            const state = buildParcoursState(model, []);
            syncConfiguratorBridge(state);
            const hooks = buildModelPresetHooks(state, container, cid, callbacks);
            Tree().renderCatalogParcoursPanel(state, hooks, container);
            if (typeof global.scheduleParentEmbedResize === 'function') {
                global.scheduleParentEmbedResize();
            }
        } finally {
            MBO()?.clearConfiguratorContext?.();
        }
    }

    function refreshModelBaseParcoursInPlace(model, container, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) return;
        ensurePickerModal();
        MBO()?.clearConfiguratorContext?.();
        const extraTemplates = typeof callbacks?.resolveBoatTemplate === 'function'
            ? [callbacks.resolveBoatTemplate({ selectedModel: model })]
            : [];
        const state = buildParcoursState(model, extraTemplates.filter(Boolean));
        syncConfiguratorBridge(state);
        const hooks = buildModelBaseHooks(state, container, callbacks);
        const root = container.querySelector('#ugap-config-parcours-root');
        if (root && typeof Tree()?.refreshDevisTableChoiceCells === 'function') {
            Tree().refreshDevisTableChoiceCells(state, hooks);
            return;
        }
        renderModelBaseParcours(model, container, callbacks);
    }

    function renderModelBaseParcours(model, container, callbacks) {
        if (!container || !Tree()?.renderCatalogParcoursPanel) {
            container.innerHTML = '<p class="ugap-param-placeholder">Tableau parcours indisponible.</p>';
            return;
        }
        ensurePickerModal();
        global.UgapModelBaseOptions?.clearConfiguratorContext?.();
        const extraTemplates = typeof callbacks?.resolveBoatTemplate === 'function'
            ? [callbacks.resolveBoatTemplate({ selectedModel: model })]
            : [];
        const state = buildParcoursState(model, extraTemplates.filter(Boolean));
        syncConfiguratorBridge(state);
        const hooks = buildModelBaseHooks(state, container, callbacks);
        Tree().renderCatalogParcoursPanel(state, hooks, container);
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    global.UgapParametrageParcoursBridge = {
        renderModelBaseParcours,
        renderModelPresetParcours,
        renderModelPresetReorderParcours,
        refreshTemplateParcoursInPlace,
        renderTemplateParcoursPreview,
        refreshTemplateStructureInPlace,
        renderTemplateStructurePreview,
        clearConfiguratorBridge,
    };
})(window);
