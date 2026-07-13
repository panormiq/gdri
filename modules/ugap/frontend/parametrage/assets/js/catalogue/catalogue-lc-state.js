/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-lc-state.js
 * RÔLE : État catalogue v2 (nodes[]) + index options import (/data).
 *
 * SORTIES : UgapCatalogueLcState (CRUD nœuds, options liées via catalogObjectId)
 * APPELÉ PAR : catalogue-tab.js, modales liaison / création option
 */
(function initUgapCatalogueLcState(global) {
    'use strict';

    const Core = () => global.UgapCatalogueNodesCore;
    const Types = () => global.UgapCatalogueTypes;
    const LS_BACKUP_KEY = 'ugap.param.catalog.backup';

    let catalog = Core()?.emptyCatalog?.() || { nodes: [], tagRegistry: [] };
    let optionsIndex = new Map();
    let importCategories = [];
    let catalogModels = [];
    let hasLoaded = false;
    let loadPromise = null;
    let persistTimer = null;
    let persistInFlight = false;
    let persistPending = false;
    let suppressPersist = false;

    function normalizeCatalog(raw) {
        return Core()?.normalizeCatalog?.(raw) || { nodes: [], tagRegistry: [] };
    }

    function getCatalog() {
        return {
            nodes: catalog.nodes.slice(),
            tagRegistry: catalog.tagRegistry.slice(),
        };
    }

    function catalogCounts(c) {
        return Core()?.catalogCounts?.(c) || { nodes: 0 };
    }

    function writeLocalBackup(payload) {
        try {
            global.localStorage?.setItem(LS_BACKUP_KEY, JSON.stringify(payload));
        } catch (_) { /* ignore */ }
    }

    function readLocalBackup() {
        try {
            const raw = global.localStorage?.getItem(LS_BACKUP_KEY);
            if (!raw) return null;
            return normalizeCatalog(JSON.parse(raw));
        } catch (_) {
            return null;
        }
    }

    function resolveCatalogFromResponses(uiRes, dataRes) {
        const ui = uiRes?.data && typeof uiRes.data === 'object' ? uiRes.data : {};
        const dataUi = dataRes?.data?.uiState && typeof dataRes.data.uiState === 'object'
            ? dataRes.data.uiState
            : {};
        const fromUi = normalizeCatalog(ui.catalog || Core()?.emptyCatalog?.());
        const fromData = normalizeCatalog(dataUi.catalog || Core()?.emptyCatalog?.());
        const score = (c) => catalogCounts(c).nodes;
        const uiScore = score(fromUi);
        const dataScore = score(fromData);
        // GET /ui-state est la source dédiée du catalogue paramétrage (évite un vieux snapshot /data).
        let best = fromUi;
        if (uiScore === 0 && dataScore > 0) best = fromData;
        else if (uiScore > 0 && dataScore > uiScore) best = fromData;
        const backup = readLocalBackup();
        if (backup && score(backup) > score(best)) best = backup;
        return best;
    }

    function applyCatalogFromServer(resolved, options = {}) {
        catalog = normalizeCatalog(resolved);
        if (options.writeBackup !== false) writeLocalBackup(getCatalog());
    }

    function setCatalog(next, options = {}) {
        catalog = normalizeCatalog(next);
        if (options.persist !== false) schedulePersist();
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

    function rebuildOptionsIndex(data) {
        optionsIndex = new Map();
        catalogModels = (Array.isArray(data?.models) ? data.models : [])
            .filter((m) => String(m?.id || '').trim());
        importCategories = (Array.isArray(data?.categories) ? data.categories : []).map((cat) => ({
            id: String(cat?.id || '').trim(),
            name: String(cat?.name || cat?.objectName || '').trim(),
        })).filter((c) => c.id);
        (Array.isArray(data?.categories) ? data.categories : []).forEach((cat) => {
            const catName = String(cat?.name || cat?.objectName || '').trim();
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id) return;
                optionsIndex.set(id, {
                    option: opt,
                    categoryId: String(cat?.id || '').trim(),
                    categoryName: catName,
                });
            });
        });
    }

    function getAllOptions() {
        return Array.from(optionsIndex.entries()).map(([id, row]) => {
            const opt = row?.option && typeof row.option === 'object' ? row.option : {};
            return {
                ...opt,
                id: String(opt.id || id).trim(),
                name: String(opt.name || opt.importOptionLabel || opt.label || '').trim(),
                details: String(opt.details || opt.importExcelLabel || '').trim(),
                importExcelLabel: String(opt.importExcelLabel || opt.details || '').trim(),
                importOptionLabel: String(opt.importOptionLabel || '').trim(),
                refUgap: String(opt.refUgap || opt.baseRefUgap || '').trim(),
                catalogObjectId: String(opt.catalogObjectId || '').trim(),
                categoryName: String(row.categoryName || '').trim(),
            };
        });
    }

    function catalogNodeIdAliases(nodeId, catalogNodes) {
        const nid = String(nodeId || '').trim();
        const ids = new Set();
        if (!nid) return ids;
        ids.add(nid);
        const Core = global.UgapCatalogueNodesCore;
        const list = Array.isArray(catalogNodes) ? catalogNodes : [];
        list.forEach((raw) => {
            const rid = Core?.resolveNodeId?.(raw) || String(raw?.id || '').trim();
            if (!rid) return;
            if (rid === nid || String(raw?.id || '').trim() === nid) {
                ids.add(rid);
                ids.add(String(raw?.id || '').trim());
            }
        });
        return ids;
    }

    function getOptionsForNode(nodeId, catalogNodes) {
        const aliasIds = catalogNodeIdAliases(nodeId, catalogNodes);
        if (!aliasIds.size) return [];
        return getAllOptions().filter((o) => aliasIds.has(String(o.catalogObjectId || '').trim()));
    }

    /** Options sur ce nœud + options liées à un sous-nœud (dossiers parents). */
    function getOptionsLinkSummaryForNode(nodeId, catalogNodes) {
        const nid = String(nodeId || '').trim();
        const nodes = Array.isArray(catalogNodes) ? catalogNodes : [];
        const Core = global.UgapCatalogueNodesCore;
        const direct = getOptionsForNode(nid, nodes);
        const onDescendants = [];
        (Core?.collectDescendantIds?.(nodes, nid) || new Set()).forEach((descId) => {
            getOptionsForNode(descId, nodes).forEach((opt) => {
                onDescendants.push({ option: opt, viaNodeId: descId });
            });
        });
        return { direct, onDescendants };
    }

    function extractDataPayload(apiRes) {
        const res = apiRes && typeof apiRes === 'object' ? apiRes : {};
        if (res.data && typeof res.data === 'object' && Array.isArray(res.data.categories)) {
            return res.data;
        }
        if (Array.isArray(res.categories)) return res;
        return null;
    }

    async function refreshOptionsFromServer() {
        const dataRes = await global.apiCall('/data', { method: 'GET', cache: 'no-store' });
        const payload = extractDataPayload(dataRes);
        if (!payload) throw new Error('Réponse /data invalide — impossible de rafraîchir les options.');
        rebuildOptionsIndex(payload);
        return payload;
    }

    function upsertOptionInIndex(optionRow, categoryId, categoryName) {
        const id = String(optionRow?.id || '').trim();
        if (!id) return;
        const existing = optionsIndex.get(id);
        optionsIndex.set(id, {
            option: { ...(existing?.option || {}), ...optionRow, id },
            categoryId: String(categoryId || existing?.categoryId || '').trim(),
            categoryName: String(categoryName || existing?.categoryName || '').trim(),
        });
    }

    async function persistCatalog() {
        if (suppressPersist || typeof global.apiCall !== 'function') return;
        if (persistInFlight) {
            persistPending = true;
            return;
        }
        persistInFlight = true;
        try {
            const payload = getCatalog();
            writeLocalBackup(payload);
            const res = await global.apiCall('/ui-state', {
                method: 'PUT',
                body: JSON.stringify({ catalog: payload }),
            });
            const saved = res?.data?.catalog ? normalizeCatalog(res.data.catalog) : null;
            if (saved) {
                const local = catalogCounts(payload);
                const remote = catalogCounts(saved);
                if (remote.nodes >= local.nodes) {
                    catalog = saved;
                    writeLocalBackup(getCatalog());
                } else if (local.nodes > 0) {
                    console.warn('[UgapCatalogue] Réponse serveur plus vide que le local — conservation locale.', {
                        local,
                        remote,
                    });
                }
            }
        } catch (error) {
            global.showAlert?.(error?.message || 'Erreur sauvegarde catalogue', 'error');
            throw error;
        } finally {
            persistInFlight = false;
            if (persistPending) {
                persistPending = false;
                schedulePersist();
            }
        }
    }

    function schedulePersist(options = {}) {
        if (suppressPersist) return;
        if (options.immediate) {
            if (persistTimer) {
                clearTimeout(persistTimer);
                persistTimer = null;
            }
            return persistCatalog();
        }
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            void persistCatalog();
        }, 300);
    }

    async function persistNow() {
        if (persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = null;
        }
        if (persistInFlight) {
            persistPending = true;
            await new Promise((resolve) => {
                const tick = () => {
                    if (!persistInFlight) {
                        resolve();
                        return;
                    }
                    setTimeout(tick, 50);
                };
                tick();
            });
            if (persistPending) {
                persistPending = false;
                return persistCatalog();
            }
            return;
        }
        return persistCatalog();
    }

    function installUnloadFlush() {
        if (global.window.__ugapCatalogueUnloadFlush) return;
        global.window.__ugapCatalogueUnloadFlush = true;
        global.window.addEventListener('beforeunload', () => {
            if (suppressPersist || !catalog.nodes.length) return;
            try {
                const url = `${global.UgapShared?.resolveUgapApiBase?.() || ''}/ui-state`;
                const body = JSON.stringify({ catalog: getCatalog() });
                global.fetch(url, {
                    method: 'PUT',
                    body,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    keepalive: true,
                });
            } catch (_) { /* ignore */ }
        });
    }

    async function loadFromServer(force = false) {
        if (force) {
            hasLoaded = false;
            loadPromise = null;
        }
        if (hasLoaded && !force) return;
        if (loadPromise && !force) return loadPromise;

        loadPromise = (async () => {
            try {
                const [uiRes, dataRes] = await Promise.all([
                    global.apiCall('/ui-state', { method: 'GET', cache: 'no-store' }),
                    global.apiCall('/data', { method: 'GET', cache: 'no-store' }),
                ]);
                suppressPersist = true;
                applyCatalogFromServer(resolveCatalogFromResponses(uiRes, dataRes), { writeBackup: true });
                rebuildOptionsIndex(extractDataPayload(dataRes) || dataRes?.data);
                hasLoaded = true;
                installUnloadFlush();
                const backup = readLocalBackup();
                const cnt = catalogCounts(catalog);
                const backupCnt = backup ? catalogCounts(backup) : { nodes: 0 };
                if (backupCnt.nodes > cnt.nodes) {
                    applyCatalogFromServer(backup, { writeBackup: false });
                    suppressPersist = false;
                    await persistCatalog();
                    suppressPersist = true;
                }
            } catch (error) {
                global.showAlert?.(error?.message || 'Erreur chargement catalogue', 'warning');
            } finally {
                suppressPersist = false;
            }
        })().finally(() => {
            loadPromise = null;
        });
        return loadPromise;
    }

    async function reload() {
        hasLoaded = false;
        loadPromise = null;
        await loadFromServer(true);
    }

    function getImportCategories() {
        return importCategories.slice();
    }

    function getCatalogModels() {
        return catalogModels.slice();
    }

    function getNodeById(nodeId) {
        const id = String(nodeId || '').trim();
        if (!id) return null;
        const idx = catalog.nodes.findIndex((n) => String(n?.id || '') === id);
        if (idx < 0) return null;
        return Core()?.normalizeNode?.(catalog.nodes[idx], idx) || null;
    }

    function addNode({ parentId, label }) {
        const row = Core()?.normalizeNode?.({
            id: Core()?.newId?.('node'),
            parentId: String(parentId || '').trim(),
            label: String(label || '').trim() || 'Nœud',
            sortOrder: catalog.nodes.length * 10,
            hideMinorationInChoices: Core()?.isMotorCatalogNodeLabel?.({ label, keywords: '' }) === true,
        });
        if (!row) return null;
        catalog.nodes.push(row);
        schedulePersist();
        return row;
    }

    function updateNode(nodeId, patch) {
        const id = String(nodeId || '').trim();
        const idx = catalog.nodes.findIndex((n) => String(n.id) === id);
        if (idx < 0) return false;

        if (Object.prototype.hasOwnProperty.call(patch, 'parentId')) {
            const check = Core()?.canSetNodeParent?.(
                catalog.nodes,
                id,
                patch.parentId
            );
            if (check && !check.ok) {
                throw new Error(check.message || 'Parent invalide.');
            }
        }

        catalog.nodes[idx] = Core()?.normalizeNode?.(
            { ...catalog.nodes[idx], ...patch, id },
            idx
        );
        schedulePersist();
        return true;
    }

    function deleteNode(nodeId) {
        const id = String(nodeId || '').trim();
        if (!id) return false;
        const drop = new Set([id, ...Core()?.collectDescendantIds?.(catalog.nodes, id)]);
        catalog.nodes = catalog.nodes.filter((n) => !drop.has(String(n.id)));
        schedulePersist();
        return true;
    }

    function allocateNextOptionId() {
        const ids = new Set(Array.from(optionsIndex.keys()));
        let n = 1;
        while (ids.has(`opt_${n}`)) n += 1;
        return `opt_${n}`;
    }

    async function createCatalogOption(fields) {
        const optionType = String(fields?.optionType || 'catalogue').trim().toLowerCase();
        const categoryId = String(fields?.categoryId || importCategories[0]?.id || '').trim();
        const name = String(fields?.name || '').trim();
        const catalogObjectId = String(fields?.catalogObjectId || '').trim();
        if (!categoryId) throw new Error('Aucune catégorie import disponible.');
        if (!name) throw new Error('Libellé requis.');
        if (!catalogObjectId) throw new Error('Nœud catalogue requis.');

        const baseTag = Types()?.BASE_OPTION_TAG_ID || 'option_de_base';
        const details = String(fields?.details || '').trim();
        let refUgap = String(fields?.refUgap || '').trim();
        const priceN = Number(String(fields?.price ?? '').replace(',', '.'));
        const resolvedPrice = Number.isFinite(priceN) ? priceN : 0;
        const allModels = fields?.allModels === true || fields?.isDivers === true;
        const compatibleModels = allModels ? [] : (Array.isArray(fields?.compatibleModels) ? fields.compatibleModels : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!allModels && !compatibleModels.length) {
            throw new Error('Sélectionnez au moins un modèle (poste) ou cochez « Tous les modèles ».');
        }
        const id = allocateNextOptionId();
        if (!refUgap && optionType === 'base') refUgap = `BASE-${id}`;

        const pricesRaw = fields?.pricesByModelId && typeof fields.pricesByModelId === 'object'
            ? fields.pricesByModelId
            : {};
        const pricesByModelId = {};
        let pricingMode = 'fixed';
        let mainPrice = resolvedPrice;
        if (!allModels) {
            compatibleModels.forEach((cid) => {
                const v = Number(pricesRaw[cid]);
                pricesByModelId[cid] = Number.isFinite(v) ? v : resolvedPrice;
            });
            const priceVals = compatibleModels
                .map((cid) => pricesByModelId[cid])
                .filter((v) => Number.isFinite(v));
            const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
            pricingMode = String(fields?.pricingMode || '').trim() === 'per_model'
                || (distinct.length > 1)
                ? 'per_model'
                : 'fixed';
            mainPrice = distinct.length === 1 ? distinct[0] : resolvedPrice;
        }

        const typePatch = (() => {
            if (optionType === 'base') {
                return {
                    tags: [baseTag],
                    manualBaseOption: true,
                    baseIncluded: true,
                    isBaseOption: true,
                    isMinoration: false,
                    isSparePart: false,
                    importOptionLineKind: 'option',
                    manualMinorationAssignment: false,
                    manualMajorationAssignment: false,
                    inclusionKind: 'inclus',
                    baseIncludedPrice: mainPrice,
                    importBaseProductPricingMode: pricingMode,
                };
            }
            if (optionType === 'mino') {
                return {
                    tags: [],
                    manualBaseOption: false,
                    baseIncluded: false,
                    isBaseOption: false,
                    isMinoration: true,
                    isSparePart: false,
                    importOptionLineKind: 'minoration',
                    manualMinorationAssignment: true,
                    manualMajorationAssignment: false,
                };
            }
            if (optionType === 'majo') {
                return {
                    tags: [],
                    manualBaseOption: false,
                    baseIncluded: false,
                    isBaseOption: false,
                    isMinoration: false,
                    isSparePart: false,
                    importOptionLineKind: 'majoration',
                    manualMajorationAssignment: true,
                    manualMinorationAssignment: false,
                };
            }
            if (optionType === 'pr') {
                return {
                    tags: [],
                    manualBaseOption: false,
                    baseIncluded: false,
                    isBaseOption: false,
                    isMinoration: false,
                    isSparePart: true,
                    importOptionLineKind: 'pr',
                    manualMajorationAssignment: false,
                    manualMinorationAssignment: false,
                };
            }
            return {
                tags: [],
                manualBaseOption: false,
                baseIncluded: false,
                isBaseOption: false,
                isMinoration: false,
                isSparePart: false,
                importOptionLineKind: 'option',
                manualMajorationAssignment: false,
                manualMinorationAssignment: false,
            };
        })();

        const body = {
            id,
            categoryId,
            name,
            refUgap,
            details,
            importExcelLabel: details || name,
            catalogObjectId,
            priceUgap: mainPrice,
            priceClient: 0,
            compatibleModels,
            isDivers: allModels,
            ...typePatch,
        };
        if (optionType === 'base') {
            body.baseRefUgap = refUgap;
            if (allModels) body.importBaseProductPricingMode = 'fixed';
        }
        if (pricingMode === 'per_model' && !allModels) {
            if (optionType === 'base') {
                body.importBaseProductPricesByModelId = pricesByModelId;
            } else {
                body.pricesByModelId = pricesByModelId;
            }
        }

        const res = await global.apiCall('/options', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        const createdId = String(res?.id || id).trim();
        if (!createdId) throw new Error('Création option : id non retourné.');

        const putPayload = { catalogObjectId };
        if (typePatch.tags?.length) putPayload.tags = typePatch.tags;
        await global.apiCall(`/options/${encodeURIComponent(createdId)}`, {
            method: 'PUT',
            body: JSON.stringify(putPayload),
        });

        const catName = importCategories.find((c) => c.id === categoryId)?.name || '';
        upsertOptionInIndex({ ...body, id: createdId, catalogObjectId }, categoryId, catName);
        await refreshOptionsFromServer();
        return createdId;
    }

    async function createBaseCatalogOption(fields) {
        return createCatalogOption({ ...fields, optionType: 'base' });
    }

    function patchLocalOptionFields(id, payload) {
        let row = optionsIndex.get(id);
        if (row?.option) {
            if (payload.catalogObjectId !== undefined) row.option.catalogObjectId = payload.catalogObjectId;
            if (payload.tags) row.option.tags = payload.tags.slice();
        } else {
            const data = typeof global.getUgapCurrentData === 'function'
                ? global.getUgapCurrentData()
                : null;
            for (const cat of Array.isArray(data?.categories) ? data.categories : []) {
                const hit = (Array.isArray(cat?.options) ? cat.options : [])
                    .find((o) => String(o?.id || '').trim() === id);
                if (!hit) continue;
                upsertOptionInIndex(
                    {
                        ...hit,
                        ...(payload.catalogObjectId !== undefined ? { catalogObjectId: payload.catalogObjectId } : {}),
                        ...(payload.tags ? { tags: payload.tags.slice() } : {}),
                        id,
                    },
                    String(cat?.id || '').trim(),
                    String(cat?.name || cat?.objectName || '').trim()
                );
                row = optionsIndex.get(id);
                break;
            }
        }
        if (typeof global.getUgapCurrentData === 'function' && typeof global.setUgapCurrentData === 'function') {
            const data = global.getUgapCurrentData();
            if (data && Array.isArray(data.categories)) {
                let patched = false;
                const categories = data.categories.map((cat) => {
                    const opts = Array.isArray(cat?.options) ? cat.options : [];
                    let catPatched = false;
                    const nextOpts = opts.map((opt) => {
                        if (String(opt?.id || '').trim() !== id) return opt;
                        catPatched = true;
                        return {
                            ...opt,
                            ...(payload.catalogObjectId !== undefined
                                ? { catalogObjectId: payload.catalogObjectId }
                                : {}),
                            ...(payload.tags ? { tags: payload.tags.slice() } : {}),
                        };
                    });
                    if (catPatched) patched = true;
                    return catPatched ? { ...cat, options: nextOpts } : cat;
                });
                if (patched) global.setUgapCurrentData({ ...data, categories });
            }
        }
    }

    async function updateOptionFieldsBulk(assignments) {
        if (typeof global.apiCall !== 'function') return { updatedCount: 0 };
        const items = (Array.isArray(assignments) ? assignments : [])
            .map((item) => {
                const optionId = String(item?.optionId || item?.id || '').trim();
                if (!optionId) return null;
                const out = { optionId };
                if (Object.prototype.hasOwnProperty.call(item, 'catalogObjectId')) {
                    out.catalogObjectId = String(item.catalogObjectId || '').trim();
                }
                if (Object.prototype.hasOwnProperty.call(item, 'tags')) {
                    out.tags = (Array.isArray(item.tags) ? item.tags : [])
                        .map((x) => String(x || '').trim()).filter(Boolean);
                }
                return out;
            })
            .filter(Boolean);
        if (!items.length) return { updatedCount: 0 };

        const catalogItems = items.filter((item) =>
            Object.prototype.hasOwnProperty.call(item, 'catalogObjectId'));
        const tagOnlyItems = items.filter((item) =>
            Object.prototype.hasOwnProperty.call(item, 'tags')
            && !Object.prototype.hasOwnProperty.call(item, 'catalogObjectId'));

        let updatedCount = 0;
        if (catalogItems.length) {
            const res = await global.apiCall('/options/assign-catalog-bulk', {
                method: 'POST',
                body: JSON.stringify({ assignments: catalogItems }),
            });
            updatedCount = Number(res?.data?.updatedCount) || 0;
            catalogItems.forEach((item) => {
                patchLocalOptionFields(item.optionId, {
                    catalogObjectId: item.catalogObjectId,
                });
            });
        }

        for (const item of tagOnlyItems) {
            await global.apiCall(`/options/${encodeURIComponent(item.optionId)}`, {
                method: 'PUT',
                body: JSON.stringify({ tags: item.tags }),
            });
            patchLocalOptionFields(item.optionId, { tags: item.tags });
            updatedCount += 1;
        }

        return { updatedCount };
    }

    async function updateOptionFields(optionId, fields) {
        const id = String(optionId || '').trim();
        if (!id || typeof global.apiCall !== 'function') return false;
        const payload = {};
        if (Object.prototype.hasOwnProperty.call(fields, 'catalogObjectId')) {
            payload.catalogObjectId = String(fields.catalogObjectId || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(fields, 'tags')) {
            payload.tags = (Array.isArray(fields.tags) ? fields.tags : [])
                .map((x) => String(x || '').trim()).filter(Boolean);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'catalogObjectId') && !Object.prototype.hasOwnProperty.call(payload, 'tags')) {
            await updateOptionFieldsBulk([{ optionId: id, catalogObjectId: payload.catalogObjectId }]);
            return true;
        }
        await global.apiCall(`/options/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        patchLocalOptionFields(id, payload);
        return true;
    }

    function syncOptionsIndexFromPayload(data) {
        if (data && typeof data === 'object') rebuildOptionsIndex(data);
    }

    global.UgapCatalogueLcState = {
        emptyCatalog: () => Core()?.emptyCatalog?.() || { nodes: [], tagRegistry: [] },
        newId: (prefix) => Core()?.newId?.(prefix) || `${prefix}_${Date.now()}`,
        getCatalog,
        setCatalog,
        loadFromServer,
        reload,
        getAllOptions,
        getImportCategories,
        getCatalogModels,
        formatCatalogModelLabel,
        compareCatalogModelsByPoste,
        refreshOptionsFromServer,
        syncOptionsIndexFromPayload,
        allocateNextOptionId,
        createBaseCatalogOption,
        createCatalogOption,
        getOptionsForNode,
        getOptionsForObject: getOptionsForNode,
        getOptionsLinkSummaryForNode,
        getNodeById,
        addNode,
        updateNode,
        deleteNode,
        updateOptionFields,
        updateOptionFieldsBulk,
        persistNow,
        hasLoadedFromServer: () => hasLoaded,
        normalizeCatalog,
    };
})(window);
