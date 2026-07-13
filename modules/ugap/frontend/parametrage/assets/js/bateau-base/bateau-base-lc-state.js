/**
 * État templates bateau + configurations modèle (ui-state) — paramétrage v2.
 */
(function initUgapBateauBaseLcState(global) {
    'use strict';

    /** @type {object|null} */
    let currentData = null;
    /** @type {Array<object>} */
    let boatTemplates = [];
    /** @type {Record<string, Record<string, string>>} */
    let modelBaseSlotPicks = {};
    /** @type {Record<string, Array<object>>} */
    let modelConfigurations = {};
    let loadPromise = null;
    let persistTimer = null;
    let persistInFlight = false;
    let persistPending = false;
    let suppressPersist = false;

    function sanitizeBoatTemplates(list) {
        return (Array.isArray(list) ? list : [])
            .filter((t) => t && typeof t === 'object' && String(t.id || '').trim())
            .map((t) => ({
                ...t,
                variants: sanitizeTemplateVariants(t.variants),
            }));
    }

    function sanitizeTemplateVariants(list) {
        return (Array.isArray(list) ? list : [])
            .filter((v) => v && typeof v === 'object' && String(v.id || '').trim())
            .map((v) => ({
                id: String(v.id || '').trim(),
                label: String(v.label || 'Variant').trim() || 'Variant',
                isDefault: v.isDefault === true,
                catalogNodeOrder: normalizeCatalogNodeOrder(v.catalogNodeOrder),
            }));
    }

    function genTemplateVariantId() {
        return `tvar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function getTemplateById(templateId) {
        const id = String(templateId || '').trim();
        return getSavedBoatTemplates().find((t) => String(t?.id || '').trim() === id) || null;
    }

    function writeTemplateAtIndex(index, nextTpl) {
        const list = getSavedBoatTemplates();
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return false;
        const copy = list.slice();
        copy[idx] = nextTpl;
        setSavedBoatTemplates(copy);
        return true;
    }

    function getVariantsForTemplate(templateId) {
        const tpl = getTemplateById(templateId);
        return sanitizeTemplateVariants(tpl?.variants);
    }

    function createTemplateVariant(templateId, label) {
        const id = String(templateId || '').trim();
        const name = String(label || '').trim();
        if (!id || !name) throw new Error('Template et nom du variant requis.');
        const list = getSavedBoatTemplates();
        const idx = list.findIndex((t) => String(t?.id || '').trim() === id);
        if (idx < 0) throw new Error('Template introuvable.');
        const tpl = { ...list[idx] };
        const variants = sanitizeTemplateVariants(tpl.variants);
        if (variants.some((v) => v.label.toLowerCase() === name.toLowerCase())) {
            throw new Error('Un variant avec ce nom existe déjà.');
        }
        const variant = {
            id: genTemplateVariantId(),
            label: name,
            isDefault: variants.length === 0,
            catalogNodeOrder: {},
        };
        tpl.variants = variants.concat([variant]);
        writeTemplateAtIndex(idx, tpl);
        return variant;
    }

    function renameTemplateVariant(templateId, variantId, label) {
        const id = String(templateId || '').trim();
        const vid = String(variantId || '').trim();
        const name = String(label || '').trim();
        if (!id || !vid || !name) return false;
        const list = getSavedBoatTemplates();
        const idx = list.findIndex((t) => String(t?.id || '').trim() === id);
        if (idx < 0) return false;
        const tpl = { ...list[idx] };
        const variants = sanitizeTemplateVariants(tpl.variants);
        const vIdx = variants.findIndex((v) => v.id === vid);
        if (vIdx < 0) return false;
        variants[vIdx] = { ...variants[vIdx], label: name };
        tpl.variants = variants;
        writeTemplateAtIndex(idx, tpl);
        return true;
    }

    function deleteTemplateVariant(templateId, variantId) {
        const id = String(templateId || '').trim();
        const vid = String(variantId || '').trim();
        if (!id || !vid) return false;
        const list = getSavedBoatTemplates();
        const idx = list.findIndex((t) => String(t?.id || '').trim() === id);
        if (idx < 0) return false;
        const tpl = { ...list[idx] };
        const variants = sanitizeTemplateVariants(tpl.variants);
        const target = variants.find((v) => v.id === vid);
        if (!target) return false;
        if (target.isDefault || String(target.label || '').trim().toLowerCase() === 'standard') {
            return false;
        }
        const nextVariants = variants.filter((v) => v.id !== vid);
        if (!nextVariants.length) {
            tpl.variants = [];
        } else if (!nextVariants.some((v) => v.isDefault)) {
            nextVariants[0] = { ...nextVariants[0], isDefault: true };
            tpl.variants = nextVariants;
        } else {
            tpl.variants = nextVariants;
        }
        writeTemplateAtIndex(idx, tpl);
        return true;
    }

    function setDefaultTemplateVariant(templateId, variantId) {
        const id = String(templateId || '').trim();
        const vid = String(variantId || '').trim();
        if (!id || !vid) return false;
        const list = getSavedBoatTemplates();
        const idx = list.findIndex((t) => String(t?.id || '').trim() === id);
        if (idx < 0) return false;
        const tpl = { ...list[idx] };
        const variants = sanitizeTemplateVariants(tpl.variants).map((v) => ({
            ...v,
            isDefault: v.id === vid,
        }));
        if (!variants.some((v) => v.id === vid)) return false;
        tpl.variants = variants;
        writeTemplateAtIndex(idx, tpl);
        return true;
    }

    function getMergedTemplateVariantCatalogNodeOrder(templateId, variantId) {
        const tpl = getTemplateById(templateId);
        if (!tpl) return { order: {}, catalogNodes: [] };
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogNodes = resolveCatalogNodesForReorder();
        const BTree = global.UgapBoatTemplateTree;
        const included = BTree?.resolveIncludedCatalogNodeIds?.(snap, catalogNodes, snap.catalogNodeOrder) || [];
        let order = BTree?.applyStoredCatalogNodeOrder?.(catalogNodes, snap.catalogNodeOrder, included)
            || BTree?.normalizeCatalogNodeOrder?.(snap.catalogNodeOrder) || {};
        const vid = String(variantId || '').trim();
        const variant = sanitizeTemplateVariants(tpl.variants).find((v) => v.id === vid);
        const override = normalizeCatalogNodeOrder(variant?.catalogNodeOrder);
        Object.keys(override).forEach((pid) => {
            if (Array.isArray(override[pid]) && override[pid].length) {
                order[pid] = override[pid].slice();
            }
        });
        if (BTree?.applyStoredCatalogNodeOrder) {
            order = BTree.applyStoredCatalogNodeOrder(catalogNodes, order, included);
        }
        return { order, catalogNodes, included };
    }

    function resolveParcoursSiblingList(parentId, catalogNodes, order) {
        const pid = String(parentId ?? '').trim();
        const TplTree = global.UgapConfiguratorTemplateTree;
        if (TplTree?.getParcoursOrderedSiblings) {
            return TplTree.getParcoursOrderedSiblings(pid, catalogNodes, order).slice();
        }
        const MBO = global.UgapModelBaseOptions;
        if (MBO?.getOrderedCatalogSiblingIds) {
            return MBO.getOrderedCatalogSiblingIds(pid, catalogNodes, order).slice();
        }
        const BTree = global.UgapBoatTemplateTree;
        if (BTree?.orderedCatalogSiblingIds) {
            return BTree.orderedCatalogSiblingIds(pid, catalogNodes, order).slice();
        }
        return Array.isArray(order[pid]) ? order[pid].slice() : [];
    }

    function reorderTemplateVariantCatalogSiblings(templateId, variantId, parentId, fromKey, toKey, mode) {
        const id = String(templateId || '').trim();
        const vid = String(variantId || '').trim();
        const pid = String(parentId || '').trim();
        const fromId = String(fromKey || '').trim();
        const toId = String(toKey || '').trim();
        if (!id || !vid || !fromId || !toId) return false;

        const list = getSavedBoatTemplates();
        const idx = list.findIndex((t) => String(t?.id || '').trim() === id);
        if (idx < 0) return false;
        const tpl = { ...list[idx] };
        const variants = sanitizeTemplateVariants(tpl.variants);
        const vIdx = variants.findIndex((v) => v.id === vid);
        if (vIdx < 0) return false;

        const { order, catalogNodes } = getMergedTemplateVariantCatalogNodeOrder(id, vid);

        const siblingList = resolveParcoursSiblingList(pid, catalogNodes, order);

        const fromIdx = siblingList.findIndex((x) => String(x) === fromId);
        const toIdx = siblingList.findIndex((x) => String(x) === toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return false;

        const nextList = reorderArrayByIndex(siblingList, fromIdx, toIdx, mode);
        if (nextList.join('|') === siblingList.join('|')) return false;

        const variant = { ...variants[vIdx] };
        const nextOrder = normalizeCatalogNodeOrder(variant.catalogNodeOrder);
        nextOrder[pid] = nextList.slice();
        if (!pid) nextOrder.root = nextList.slice();
        variant.catalogNodeOrder = nextOrder;
        variants[vIdx] = variant;
        tpl.variants = variants;
        writeTemplateAtIndex(idx, tpl);
        return true;
    }

    function normalizeSlotPickValue(optionIdOrIds) {
        if (Array.isArray(optionIdOrIds)) {
            const ids = optionIdOrIds.map((x) => String(x || '').trim()).filter(Boolean);
            if (!ids.length) return null;
            return ids.length === 1 ? ids[0] : ids;
        }
        const oid = String(optionIdOrIds || '').trim();
        return oid || null;
    }

    function normalizeSlotPicksRow(raw) {
        const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const out = {};
        Object.entries(row).forEach(([key, val]) => {
            const k = String(key || '').trim();
            const normalized = normalizeSlotPickValue(val);
            if (k && normalized != null) out[k] = normalized;
        });
        return out;
    }

    function normalizeCatalogNodeOrder(raw) {
        const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const out = {};
        Object.entries(source).forEach(([key, ids]) => {
            const pid = String(key === 'root' ? '' : key).trim();
            const list = (Array.isArray(ids) ? ids : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (list.length) out[pid] = list;
        });
        return out;
    }

    function sanitizeConfigurationsList(list) {
        return (Array.isArray(list) ? list : [])
            .filter((c) => c && typeof c === 'object' && String(c.id || '').trim())
            .map((c) => {
                const vid = String(c.templateVariantId || '').trim();
                const viewMode = String(c.parcoursViewMode || '').trim() === 'custom' ? 'custom' : 'variant';
                return {
                    id: String(c.id || '').trim(),
                    label: String(c.label || 'Configuration').trim() || 'Configuration',
                    isDefault: c.isDefault === true,
                    parcoursViewMode: viewMode,
                    slotPicks: normalizeSlotPicksRow(c.slotPicks),
                    catalogNodeOrder: normalizeCatalogNodeOrder(c.catalogNodeOrder),
                    ...(vid ? { templateVariantId: vid } : {}),
                };
            });
    }

    function sanitizeModelConfigurations(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        Object.entries(source).forEach(([modelId, configs]) => {
            const mid = String(modelId || '').trim();
            if (!mid) return;
            const list = sanitizeConfigurationsList(configs);
            if (list.length) out[mid] = list;
        });
        return out;
    }

    function genConfigurationId() {
        return `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function migrateConfigurationsFromBasePicks() {
        Object.entries(modelBaseSlotPicks).forEach(([modelId, picks]) => {
            const mid = String(modelId || '').trim();
            if (!mid || modelConfigurations[mid]?.length) return;
            const row = normalizeSlotPicksRow(picks);
            if (!Object.keys(row).length) return;
            modelConfigurations[mid] = [{
                id: genConfigurationId(),
                label: 'UGAP',
                isDefault: true,
                slotPicks: row,
            }];
        });
    }

    function setData(next) {
        currentData = next && typeof next === 'object' ? next : { categories: [] };
        if (!Array.isArray(currentData.categories)) currentData.categories = [];
        patchCurrentDataUiState();
    }

    function getData() {
        return currentData;
    }

    function patchCurrentDataUiState() {
        if (!currentData || typeof currentData !== 'object') return;
        currentData.uiState = {
            ...(currentData.uiState || {}),
            boatTemplates: boatTemplates.slice(),
            modelBaseSlotPicks: { ...modelBaseSlotPicks },
            modelConfigurations: JSON.parse(JSON.stringify(modelConfigurations)),
        };
    }

    function getSavedBoatTemplates() {
        return boatTemplates.slice();
    }

    function setSavedBoatTemplates(list) {
        boatTemplates = sanitizeBoatTemplates(list);
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
        return boatTemplates.slice();
    }

    async function persistToServer() {
        if (suppressPersist || typeof global.apiCall !== 'function') return;
        if (persistInFlight) {
            persistPending = true;
            return;
        }
        persistInFlight = true;
        try {
            await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({
                    boatTemplates: boatTemplates.slice(),
                    modelBaseSlotPicks: { ...modelBaseSlotPicks },
                    modelConfigurations: JSON.parse(JSON.stringify(modelConfigurations)),
                }),
            });
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde ordre des options', 'error');
            throw error;
        } finally {
            persistInFlight = false;
            if (persistPending) {
                persistPending = false;
                schedulePersist();
            }
        }
    }

    function schedulePersist() {
        if (suppressPersist) return;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            void persistToServer();
        }, 250);
    }

    async function loadFromServer(force = false) {
        if (typeof global.apiCall !== 'function') return;
        if (loadPromise && !force) return loadPromise;

        const run = async () => {
            try {
                const [dataRes, uiRes] = await Promise.all([
                    global.apiCall('/data', { method: 'GET' }),
                    global.apiCall('/ui-state', { method: 'GET' }),
                ]);
                const data = dataRes?.data && typeof dataRes.data === 'object' ? dataRes.data : {};
                const ui = uiRes?.data && typeof uiRes.data === 'object' ? uiRes.data : {};
                data.uiState = { ...(data.uiState || {}), ...ui };

                suppressPersist = true;
                boatTemplates = sanitizeBoatTemplates(ui.boatTemplates || data.uiState?.boatTemplates);
                modelBaseSlotPicks = (ui.modelBaseSlotPicks && typeof ui.modelBaseSlotPicks === 'object')
                    ? { ...ui.modelBaseSlotPicks }
                    : (data.uiState?.modelBaseSlotPicks && typeof data.uiState.modelBaseSlotPicks === 'object'
                        ? { ...data.uiState.modelBaseSlotPicks }
                        : {});
                modelConfigurations = sanitizeModelConfigurations(
                    ui.modelConfigurations || data.uiState?.modelConfigurations
                );
                migrateConfigurationsFromBasePicks();

                setData(data);
            } catch (error) {
                global.showAlert?.(error?.message || 'Erreur chargement ordre des options', 'warning');
            } finally {
                suppressPersist = false;
            }
        };

        loadPromise = run().finally(() => {
            loadPromise = null;
        });
        return loadPromise;
    }

    async function reload() {
        loadPromise = null;
        await loadFromServer(true);
    }

    function installGlobals() {
        global.getSavedBoatTemplates = getSavedBoatTemplates;
        global.setSavedBoatTemplates = setSavedBoatTemplates;
        global.syncImportBoatTemplatesFromSaved = () => {};
        global.triggerUiStatePersistenceNow = persistToServer;
        global.getUgapCurrentData = getData;
        global.setUgapCurrentData = setData;
    }

    installGlobals();

    function getModelBaseSlotPicks() {
        return { ...modelBaseSlotPicks };
    }

    function getModelConfigurations() {
        return JSON.parse(JSON.stringify(modelConfigurations));
    }

    function getConfigurationsForModel(modelId) {
        const mid = String(modelId || '').trim();
        if (!mid) return [];
        return sanitizeConfigurationsList(modelConfigurations[mid] || []);
    }

    function getConfigurationById(modelId, configId) {
        const cid = String(configId || '').trim();
        return getConfigurationsForModel(modelId).find((c) => c.id === cid) || null;
    }

    function writeConfigurationsForModel(modelId, list) {
        const mid = String(modelId || '').trim();
        if (!mid) return [];
        const next = sanitizeConfigurationsList(list);
        if (next.length) modelConfigurations[mid] = next;
        else delete modelConfigurations[mid];
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
        return next.slice();
    }

    function setSuppressPersist(value) {
        suppressPersist = !!value;
        if (suppressPersist && persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = null;
        }
    }

    function setModelBaseSlotPick(modelId, slotKey, optionIdOrIds) {
        const mid = String(modelId || '').trim();
        const key = String(slotKey || '').trim();
        if (!mid || !key) return;
        const next = { ...modelBaseSlotPicks };
        if (!next[mid] || typeof next[mid] !== 'object') next[mid] = {};
        const row = { ...next[mid] };
        const normalized = normalizeSlotPickValue(optionIdOrIds);
        if (normalized == null) delete row[key];
        else row[key] = normalized;
        next[mid] = row;
        modelBaseSlotPicks = next;
        patchCurrentDataUiState();
        if (!suppressPersist) schedulePersist();
    }

    function setConfigurationSlotPick(modelId, configId, slotKey, optionIdOrIds) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const key = String(slotKey || '').trim();
        if (!mid || !cid || !key) return;
        const list = getConfigurationsForModel(mid);
        const idx = list.findIndex((c) => c.id === cid);
        if (idx < 0) return;
        const cfg = { ...list[idx], slotPicks: { ...list[idx].slotPicks } };
        const normalized = normalizeSlotPickValue(optionIdOrIds);
        if (normalized == null) delete cfg.slotPicks[key];
        else cfg.slotPicks[key] = normalized;
        list[idx] = cfg;
        writeConfigurationsForModel(mid, list);
    }

    function createConfiguration(modelId, label) {
        const mid = String(modelId || '').trim();
        const name = String(label || '').trim() || 'Configuration';
        if (!mid) throw new Error('Modèle introuvable.');
        const list = getConfigurationsForModel(mid);
        const seedPicks = !list.length && modelBaseSlotPicks[mid]
            ? normalizeSlotPicksRow(modelBaseSlotPicks[mid])
            : {};
        const entry = {
            id: genConfigurationId(),
            label: name,
            isDefault: list.length === 0,
            slotPicks: seedPicks,
        };
        writeConfigurationsForModel(mid, [...list, entry]);
        return entry;
    }

    function renameConfiguration(modelId, configId, label) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const name = String(label || '').trim();
        if (!mid || !cid || !name) return null;
        const list = getConfigurationsForModel(mid);
        const idx = list.findIndex((c) => c.id === cid);
        if (idx < 0) return null;
        list[idx] = { ...list[idx], label: name };
        writeConfigurationsForModel(mid, list);
        return list[idx];
    }

    function deleteConfiguration(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        if (!mid || !cid) return false;
        let list = getConfigurationsForModel(mid).filter((c) => c.id !== cid);
        if (list.length && !list.some((c) => c.isDefault)) {
            list = list.map((c, i) => ({ ...c, isDefault: i === 0 }));
        }
        writeConfigurationsForModel(mid, list);
        return true;
    }

    function setDefaultConfiguration(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        if (!mid || !cid) return;
        const list = getConfigurationsForModel(mid).map((c) => ({
            ...c,
            isDefault: c.id === cid,
        }));
        writeConfigurationsForModel(mid, list);
    }

    async function persistModelBaseSlotPicksOnly() {
        if (suppressPersist || typeof global.apiCall !== 'function') return false;
        try {
            const result = await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({ modelBaseSlotPicks: { ...modelBaseSlotPicks } }),
            });
            const serverPicks = result?.data?.modelBaseSlotPicks;
            if (serverPicks && typeof serverPicks === 'object' && !Array.isArray(serverPicks)) {
                modelBaseSlotPicks = { ...serverPicks };
                patchCurrentDataUiState();
            }
            return true;
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde des choix options de base', 'error');
            return false;
        }
    }

    async function persistModelConfigurationsOnly() {
        if (suppressPersist || typeof global.apiCall !== 'function') return false;
        try {
            const result = await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({
                    modelConfigurations: JSON.parse(JSON.stringify(modelConfigurations)),
                }),
            });
            const server = result?.data?.modelConfigurations;
            if (server && typeof server === 'object' && !Array.isArray(server)) {
                modelConfigurations = sanitizeModelConfigurations(server);
                patchCurrentDataUiState();
            }
            return true;
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde des configurations', 'error');
            return false;
        }
    }

    function reorderArrayByIndex(list, fromIdx, toIdx, mode) {
        const arr = Array.isArray(list) ? list.slice() : [];
        const from = Number(fromIdx);
        let to = Number(toIdx);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
            return arr;
        }
        if (from === to) return arr;
        const [moved] = arr.splice(from, 1);
        if (from < to) to -= 1;
        if (mode === 'after') to += 1;
        arr.splice(Math.max(0, Math.min(to, arr.length)), 0, moved);
        return arr;
    }

    function resolveCatalogNodesForReorder() {
        const Cat = global.UgapGroupCatalog;
        if (Cat?.resolveCatalogNodes) {
            const nodes = Cat.resolveCatalogNodes({}) || [];
            if (nodes.length) return nodes;
        }
        const St = global.UgapCatalogueLcState;
        return St?.getCatalog?.()?.nodes || [];
    }

    function resolveDefaultTemplateVariantId(templateId) {
        const variants = getVariantsForTemplate(templateId);
        if (!variants.length) return '';
        const def = variants.find((v) => v.isDefault === true)
            || variants.find((v) => String(v.label || '').trim().toLowerCase() === 'standard')
            || variants[0];
        return String(def?.id || '').trim();
    }

    function resolveConfigurationTemplateVariantId(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const cfg = getConfigurationById(mid, cid);
        const MBO = global.UgapModelBaseOptions;
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id || '').trim() === mid);
        const tplId = MBO?.resolveBoatTemplateIdForModel?.(model) || '';
        const variants = getVariantsForTemplate(tplId);
        if (!variants.length) return '';
        const stored = String(cfg?.templateVariantId || '').trim();
        if (stored && variants.some((v) => v.id === stored)) return stored;
        return resolveDefaultTemplateVariantId(tplId);
    }

    function configurationHasCustomParcoursOrder(cfg) {
        const order = normalizeCatalogNodeOrder(cfg?.catalogNodeOrder);
        return Object.keys(order).some((key) => Array.isArray(order[key]) && order[key].length > 0);
    }

    function resolveConfigurationParcoursViewMode(modelId, configId) {
        const cfg = getConfigurationById(modelId, configId);
        return String(cfg?.parcoursViewMode || '').trim() === 'custom' ? 'custom' : 'variant';
    }

    function setConfigurationParcoursViewMode(modelId, configId, mode) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const next = String(mode || '').trim() === 'custom' ? 'custom' : 'variant';
        if (!mid || !cid) return false;
        const list = getConfigurationsForModel(mid);
        const idx = list.findIndex((c) => c.id === cid);
        if (idx < 0) return false;
        list[idx] = { ...list[idx], parcoursViewMode: next };
        writeConfigurationsForModel(mid, list);
        return true;
    }

    function setConfigurationTemplateVariant(modelId, configId, variantId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const vid = String(variantId || '').trim();
        if (!mid || !cid) return false;
        const list = getConfigurationsForModel(mid);
        const idx = list.findIndex((c) => c.id === cid);
        if (idx < 0) return false;
        const MBO = global.UgapModelBaseOptions;
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id || '').trim() === mid);
        const tplId = MBO?.resolveBoatTemplateIdForModel?.(model) || '';
        const variants = getVariantsForTemplate(tplId);
        if (vid && !variants.some((v) => v.id === vid)) return false;
        const cfg = { ...list[idx] };
        if (vid) cfg.templateVariantId = vid;
        else delete cfg.templateVariantId;
        list[idx] = cfg;
        writeConfigurationsForModel(mid, list);
        return true;
    }

    function getMergedConfigurationCatalogNodeOrder(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const cfg = getConfigurationById(mid, cid);
        const MBO = global.UgapModelBaseOptions;
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id || '').trim() === mid);
        const tplId = MBO?.resolveBoatTemplateIdForModel?.(model) || '';
        const variantId = resolveConfigurationTemplateVariantId(mid, cid);
        let order = {};
        let catalogNodes = resolveCatalogNodesForReorder();
        if (tplId && variantId) {
            const mergedVariant = getMergedTemplateVariantCatalogNodeOrder(tplId, variantId);
            order = mergedVariant.order || {};
            catalogNodes = mergedVariant.catalogNodes?.length ? mergedVariant.catalogNodes : catalogNodes;
        } else {
            const tpl = MBO?.getTemplateById?.(tplId);
            const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
            const BTree = global.UgapBoatTemplateTree;
            const hasExplicitIncluded = Array.isArray(snap.includedCatalogNodeIds)
                && snap.includedCatalogNodeIds.length > 0;
            order = BTree?.normalizeCatalogNodeOrder?.(snap.catalogNodeOrder) || {};
            if (hasExplicitIncluded && BTree?.applyStoredCatalogNodeOrder) {
                const included = BTree.resolveIncludedCatalogNodeIds(snap, catalogNodes, order);
                order = BTree.applyStoredCatalogNodeOrder(catalogNodes, order, included);
            } else if (!Object.keys(order).length && BTree?.defaultCatalogNodeOrder) {
                order = BTree.defaultCatalogNodeOrder(catalogNodes);
            } else if (BTree?.mergeCatalogNodeOrder) {
                order = BTree.mergeCatalogNodeOrder(catalogNodes, order);
            }
        }
        const override = normalizeCatalogNodeOrder(cfg?.catalogNodeOrder);
        if (resolveConfigurationParcoursViewMode(mid, cid) === 'custom') {
            Object.keys(override).forEach((pid) => {
                if (Array.isArray(override[pid]) && override[pid].length) {
                    order[pid] = override[pid].slice();
                }
            });
        }
        return { order, catalogNodes };
    }

    function reorderConfigurationCatalogSiblings(modelId, configId, parentId, fromKey, toKey, mode) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const pid = String(parentId || '').trim();
        const fromId = String(fromKey || '').trim();
        const toId = String(toKey || '').trim();
        if (!mid || !cid || !fromId || !toId) return false;

        const list = getConfigurationsForModel(mid);
        const idx = list.findIndex((c) => c.id === cid);
        if (idx < 0) return false;

        const { order, catalogNodes } = getMergedConfigurationCatalogNodeOrder(mid, cid);

        const siblingList = resolveParcoursSiblingList(pid, catalogNodes, order);

        const fromIdx = siblingList.findIndex((id) => String(id) === fromId);
        const toIdx = siblingList.findIndex((id) => String(id) === toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return false;

        const nextList = reorderArrayByIndex(siblingList, fromIdx, toIdx, mode);
        const cfg = { ...list[idx] };
        const nextOrder = normalizeCatalogNodeOrder(cfg.catalogNodeOrder);
        nextOrder[pid] = nextList;
        if (!pid) nextOrder.root = nextList.slice();
        cfg.catalogNodeOrder = nextOrder;
        cfg.parcoursViewMode = 'custom';
        list[idx] = cfg;
        writeConfigurationsForModel(mid, list);
        return true;
    }

    global.UgapBateauBaseLcState = {
        loadFromServer,
        reload,
        getData,
        setData,
        getSavedBoatTemplates,
        setSavedBoatTemplates,
        persistToServer,
        getModelBaseSlotPicks,
        getModelConfigurations,
        getConfigurationsForModel,
        getConfigurationById,
        createConfiguration,
        renameConfiguration,
        deleteConfiguration,
        setDefaultConfiguration,
        setConfigurationTemplateVariant,
        setConfigurationParcoursViewMode,
        resolveConfigurationParcoursViewMode,
        configurationHasCustomParcoursOrder,
        resolveConfigurationTemplateVariantId,
        resolveDefaultTemplateVariantId,
        setModelBaseSlotPick,
        setConfigurationSlotPick,
        getMergedConfigurationCatalogNodeOrder,
        reorderConfigurationCatalogSiblings,
        getTemplateById,
        getVariantsForTemplate,
        createTemplateVariant,
        renameTemplateVariant,
        deleteTemplateVariant,
        setDefaultTemplateVariant,
        getMergedTemplateVariantCatalogNodeOrder,
        reorderTemplateVariantCatalogSiblings,
        setSuppressPersist,
        persistModelBaseSlotPicksOnly,
        persistModelConfigurationsOnly,
    };
})(window);
